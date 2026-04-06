import { Router } from "express";
import { db } from "@workspace/db";
import { studentRegistrationsTable } from "@workspace/db/schema";
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

// POST /api/students/register — public, no auth required
router.post("/register", async (req, res) => {
  try {
    const { apellidos, nombres, dni, carrera, ciclo, matriculado } = req.body;
    if (!apellidos || !nombres || !dni || !carrera) {
      res.status(400).json({ error: "Faltan campos obligatorios" });
      return;
    }
    const [record] = await db
      .insert(studentRegistrationsTable)
      .values({
        apellidos: apellidos.trim().toUpperCase(),
        nombres:   nombres.trim().toUpperCase(),
        dni:       dni.trim(),
        carrera:   carrera.trim(),
        ciclo:     ciclo?.trim() || null,
        matriculado: matriculado === true || matriculado === "true",
      })
      .returning();
    res.json({ ok: true, id: record.id });
  } catch (err) {
    console.error("Student register error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/students/register — admin only
router.get("/register", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(studentRegistrationsTable)
      .orderBy(desc(studentRegistrationsTable.createdAt));
    res.json(rows);
  } catch (err) {
    console.error("Student list error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/students/register/:id — admin only
router.delete("/register/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
    await db.delete(studentRegistrationsTable).where(eq(studentRegistrationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
