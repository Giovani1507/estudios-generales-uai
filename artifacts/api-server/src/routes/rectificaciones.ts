import { Router } from "express";
import { db } from "@workspace/db";
import { rectificacionesTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// POST /api/rectificaciones — public (student self-registration via QR)
router.post("/", async (req, res) => {
  try {
    const { apellidosNombres, celular, atendidoPor, fotoPago, observaciones } = req.body;
    if (!apellidosNombres?.trim()) { res.status(400).json({ error: "Apellidos y nombres requeridos" }); return; }
    if (!celular?.trim())          { res.status(400).json({ error: "Celular requerido" }); return; }
    if (!atendidoPor?.trim())      { res.status(400).json({ error: "Selecciona quién te atendió" }); return; }

    const [row] = await db.insert(rectificacionesTable).values({
      apellidosNombres: apellidosNombres.trim().toUpperCase(),
      celular:          celular.trim(),
      atendidoPor:      atendidoPor.trim(),
      fotoPago:         fotoPago ?? null,
      observaciones:    observaciones?.trim() ?? null,
    }).returning();

    res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    console.error("Rectificacion insert error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/rectificaciones — auth required (admin view)
router.get("/", requireAuth, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(rectificacionesTable)
      .orderBy(desc(rectificacionesTable.registradoEn));
    res.json(rows);
  } catch (err) {
    console.error("Rectificaciones list error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/rectificaciones/:id — auth required
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    await db.delete(rectificacionesTable).where(eq(rectificacionesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Rectificacion delete error:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
