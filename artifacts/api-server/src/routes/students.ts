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

// POST /api/students/register — public
router.post("/register", async (req, res) => {
  try {
    const { dni, apellidos, nombres, telefono, carrera, ciclo } = req.body;
    if (!apellidos || !nombres || !telefono || !carrera) {
      res.status(400).json({ error: "Faltan campos obligatorios" });
      return;
    }
    const dniClean = dni ? String(dni).replace(/\D/g, "").padStart(8, "0") : null;
    const [record] = await db
      .insert(studentRegistrationsTable)
      .values({
        dni:             dniClean,
        apellidos:       apellidos.trim().toUpperCase(),
        nombres:         nombres.trim().toUpperCase(),
        telefono:        telefono.trim(),
        carrera:         carrera.trim(),
        ciclo:           ciclo?.trim() || null,
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
        id:              studentRegistrationsTable.id,
        dni:             studentRegistrationsTable.dni,
        apellidos:       studentRegistrationsTable.apellidos,
        nombres:         studentRegistrationsTable.nombres,
        telefono:        studentRegistrationsTable.telefono,
        carrera:         studentRegistrationsTable.carrera,
        ciclo:           studentRegistrationsTable.ciclo,
        horarioAsignado: studentRegistrationsTable.horarioAsignado,
        createdAt:       studentRegistrationsTable.createdAt,
        _ingresanteDni:  ingresantesPagosTable.dni,
        modalidadEstudio: ingresantesPagosTable.modalidadEstudio,
        turno:           ingresantesPagosTable.turno,
        seccion:         ingresantesPagosTable.seccion,
        sede:            ingresantesPagosTable.sede,
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
