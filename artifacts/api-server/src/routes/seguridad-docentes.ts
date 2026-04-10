import { Router } from "express";
import { db } from "@workspace/db";
import { seguridadDocentesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(seguridadDocentesTable)
      .orderBy(seguridadDocentesTable.registradoEn);
    res.json(rows);
  } catch (err) {
    console.error("[seguridad-docentes] GET error:", err);
    res.status(500).json({ error: "Error al obtener registros" });
  }
});

router.post("/", async (req, res) => {
  const { nombre, tipo, observacion, registradoPor } = req.body;
  if (!nombre?.trim() || !tipo?.trim()) {
    return res.status(400).json({ error: "nombre y tipo son requeridos" });
  }
  try {
    const [row] = await db
      .insert(seguridadDocentesTable)
      .values({
        nombre: nombre.trim().toUpperCase(),
        tipo: tipo.trim(),
        observacion: observacion?.trim() || null,
        registradoPor: registradoPor?.trim() || null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[seguridad-docentes] POST error:", err);
    res.status(500).json({ error: "Error al crear registro" });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { observacion, tipo } = req.body;
  try {
    const [row] = await db
      .update(seguridadDocentesTable)
      .set({
        ...(tipo ? { tipo: tipo.trim() } : {}),
        ...(observacion !== undefined ? { observacion: observacion?.trim() || null } : {}),
      })
      .where(eq(seguridadDocentesTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "No encontrado" });
    res.json(row);
  } catch (err) {
    console.error("[seguridad-docentes] PUT error:", err);
    res.status(500).json({ error: "Error al actualizar" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(seguridadDocentesTable).where(eq(seguridadDocentesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[seguridad-docentes] DELETE error:", err);
    res.status(500).json({ error: "Error al eliminar" });
  }
});

export default router;
