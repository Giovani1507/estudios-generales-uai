import { Router } from "express";
import { db } from "@workspace/db";
import { seguridadDocentesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(seguridadDocentesTable)
      .orderBy(desc(seguridadDocentesTable.registradoEn));
    res.json(rows);
  } catch (err) {
    console.error("[seguridad-docentes] GET error:", err);
    res.status(500).json({ error: "Error al obtener registros" });
  }
});

router.post("/", async (req, res) => {
  const { nombre, tipo, estado, prioridad, observacion, registradoPor } = req.body;
  if (!nombre?.trim() || !tipo?.trim()) {
    return res.status(400).json({ error: "nombre y tipo son requeridos" });
  }
  try {
    const [row] = await db
      .insert(seguridadDocentesTable)
      .values({
        nombre:       nombre.trim().toUpperCase(),
        tipo:         tipo.trim(),
        estado:       estado?.trim() || "PENDIENTE",
        prioridad:    prioridad?.trim() || "NORMAL",
        observacion:  observacion?.trim() || null,
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
  const { observacion, tipo, estado, prioridad, resolucion, resueltaPor } = req.body;
  try {
    const updates: Record<string, unknown> = {};
    if (tipo !== undefined)         updates.tipo        = tipo.trim();
    if (estado !== undefined)       updates.estado      = estado.trim();
    if (prioridad !== undefined)    updates.prioridad   = prioridad.trim();
    if (observacion !== undefined)  updates.observacion = observacion?.trim() || null;
    if (resolucion !== undefined)   updates.resolucion  = resolucion?.trim() || null;
    if (estado === "RESUELTO") {
      updates.resueltaEn  = new Date();
      updates.resueltaPor = resueltaPor?.trim() || null;
    }
    const [row] = await db
      .update(seguridadDocentesTable)
      .set(updates)
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
