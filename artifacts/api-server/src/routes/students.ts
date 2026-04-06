import { Router } from "express";
import { db } from "@workspace/db";
import { studentRegistrationsTable, ingresantesPagosTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (req.currentUser?.role !== "administrador") {
    res.status(403).json({ error: "Acceso restringido al administrador" });
    return;
  }
  next();
}

// GET /api/students/lookup?dni=XXXXXXXX — public, looks up ingresantes_pagos by DNI
router.get("/lookup", async (req, res) => {
  try {
    const dni = String(req.query.dni || "").replace(/\D/g, "").padStart(8, "0");
    if (dni.length !== 8) {
      res.status(400).json({ error: "DNI inválido" });
      return;
    }
    const rows = await db
      .select()
      .from(ingresantesPagosTable)
      .where(eq(ingresantesPagosTable.dni, dni))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ encontrado: false });
      return;
    }
    const r = rows[0];
    res.json({
      encontrado: true,
      dni:              r.dni,
      apellidosNombres: r.apellidosNombres,
      carrera:          r.carrera,
      sede:             r.sede,
      modalidadIngreso: r.modalidadIngreso,
      modalidadEstudio: r.modalidadEstudio,
      turno:            r.turno,
      seccion:          r.seccion,
    });
  } catch (err) {
    console.error("Lookup error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/students/register — public, only requires DNI (auto-fills from ingresantes_pagos)
router.post("/register", async (req, res) => {
  try {
    const { dni } = req.body;
    const dniClean = dni ? String(dni).replace(/\D/g, "").padStart(8, "0") : null;
    if (!dniClean || dniClean.length !== 8) {
      res.status(400).json({ error: "DNI inválido o faltante" });
      return;
    }

    // Look up ingresantes_pagos for auto-fill
    let apellidos = "";
    let nombres = "";
    let carrera = "";
    const rows = await db
      .select()
      .from(ingresantesPagosTable)
      .where(eq(ingresantesPagosTable.dni, dniClean))
      .limit(1);

    if (rows.length > 0) {
      const r = rows[0];
      const partes = (r.apellidosNombres || "").split(" ");
      apellidos = partes.slice(0, 2).join(" ");
      nombres   = partes.slice(2).join(" ");
      carrera   = r.carrera || "";
    }

    const [record] = await db
      .insert(studentRegistrationsTable)
      .values({
        dni:             dniClean,
        apellidos:       apellidos,
        nombres:         nombres,
        telefono:        "",
        carrera:         carrera,
        ciclo:           null,
        horarioAsignado: false,
      })
      .returning();
    res.json({ ok: true, id: record.id });
  } catch (err) {
    console.error("Student register error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/students/register — admin only, with ingresantes_pagos cross-reference
router.get("/register", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id:                 studentRegistrationsTable.id,
        dni:                studentRegistrationsTable.dni,
        apellidos:          studentRegistrationsTable.apellidos,
        nombres:            studentRegistrationsTable.nombres,
        telefono:           studentRegistrationsTable.telefono,
        carrera:            studentRegistrationsTable.carrera,
        ciclo:              studentRegistrationsTable.ciclo,
        horarioAsignado:    studentRegistrationsTable.horarioAsignado,
        createdAt:          studentRegistrationsTable.createdAt,
        _ingresanteDni:     ingresantesPagosTable.dni,
        apellidosNombres:   ingresantesPagosTable.apellidosNombres,
        carreraIngresante:  ingresantesPagosTable.carrera,
        modalidadEstudio:   ingresantesPagosTable.modalidadEstudio,
        turno:              ingresantesPagosTable.turno,
        seccion:            ingresantesPagosTable.seccion,
        sede:               ingresantesPagosTable.sede,
      })
      .from(studentRegistrationsTable)
      .leftJoin(
        ingresantesPagosTable,
        eq(studentRegistrationsTable.dni, ingresantesPagosTable.dni)
      )
      .orderBy(desc(studentRegistrationsTable.createdAt));

    const result = rows.map(({ _ingresanteDni, ...r }) => ({
      ...r,
      pagado: _ingresanteDni !== null,
    }));

    res.json(result);
  } catch (err) {
    console.error("Student list error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/students/register/:id/horario
router.patch("/register/:id/horario", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
    const { horarioAsignado } = req.body;
    if (typeof horarioAsignado !== "boolean") {
      res.status(400).json({ error: "horarioAsignado debe ser boolean" });
      return;
    }
    await db
      .update(studentRegistrationsTable)
      .set({ horarioAsignado })
      .where(eq(studentRegistrationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Horario update error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/students/register/:id
router.delete("/register/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
    await db.delete(studentRegistrationsTable).where(eq(studentRegistrationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
