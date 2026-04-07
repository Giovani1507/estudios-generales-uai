import { Router } from "express";
import { db } from "@workspace/db";
import { studentRegistrationsTable, ingresantesPagosTable } from "@workspace/db/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";
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
    const raw = String(req.query.dni || "").replace(/\D/g, "");
    const dni = raw.padStart(8, "0");
    if (raw.length < 7 || raw.length > 9) {
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
      encontrado:       true,
      dni:              r.dni,
      apellidosNombres: r.apellidosNombres,
      codigoEstudiante: r.codigoEstudiante,
      carrera:          r.carrera,
      sede:             r.sede,
      modalidadIngreso: r.modalidadIngreso,
      modalidadEstudio: r.modalidadEstudio,
      turno:            r.turno,
      seccion:          r.seccion,
      celular:          r.celular,
      correo:           r.correo,
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
    const raw = dni ? String(dni).replace(/\D/g, "") : "";
    const dniClean = raw.padStart(8, "0");
    if (raw.length < 7 || raw.length > 9) {
      res.status(400).json({ error: "DNI inválido o faltante" });
      return;
    }

    // Check for duplicate registration
    const existing = await db
      .select({ id: studentRegistrationsTable.id })
      .from(studentRegistrationsTable)
      .where(eq(studentRegistrationsTable.dni, dniClean))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "DNI ya registrado" });
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
        ciclo:           "1",
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
        codigoEstudiante:   ingresantesPagosTable.codigoEstudiante,
        carreraIngresante:  ingresantesPagosTable.carrera,
        modalidadEstudio:   ingresantesPagosTable.modalidadEstudio,
        turno:              ingresantesPagosTable.turno,
        seccion:            ingresantesPagosTable.seccion,
        sede:               ingresantesPagosTable.sede,
        celular:            ingresantesPagosTable.celular,
        correo:             ingresantesPagosTable.correo,
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

// POST /api/students/lookup-codes — auth required, cross-checks codes against ingresantes_pagos
router.post("/lookup-codes", requireAuth, async (req, res) => {
  try {
    const raw: unknown = req.body.codigos;
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: "Se requiere un arreglo de códigos" });
      return;
    }
    const codigos: string[] = (raw as unknown[])
      .map((c: unknown) => String(c ?? "").trim().toUpperCase())
      .filter(s => s.length > 0)
      .slice(0, 2000);

    if (codigos.length === 0) {
      res.json({ found: [], notFound: [], totalInput: 0 });
      return;
    }

    // Use ANY with a raw text array to avoid drizzle nullable-column type issues
    const rows = await db
      .select()
      .from(ingresantesPagosTable)
      .where(sql`UPPER(${ingresantesPagosTable.codigoEstudiante}) = ANY(${sql.raw("ARRAY[" + codigos.map(c => `'${c.replace(/'/g, "''")}'`).join(",") + "]::text[]")})`);

    const foundCodes = new Set(rows.map(r => (r.codigoEstudiante ?? "").toUpperCase()));
    const notFound   = codigos.filter(c => !foundCodes.has(c));

    res.json({ found: rows, notFound, totalInput: codigos.length });
  } catch (err) {
    console.error("Lookup-codes error:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
