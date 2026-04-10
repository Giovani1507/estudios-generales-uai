import { Router } from "express";
import { db } from "@workspace/db";
import { seguridadIncidenciasTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(seguridadIncidenciasTable)
      .orderBy(desc(seguridadIncidenciasTable.registradoEn));
    res.json(rows);
  } catch (err) {
    console.error("[seguridad-incidencias] GET error:", err);
    res.status(500).json({ error: "Error al obtener incidencias" });
  }
});

router.post("/", async (req, res) => {
  const { tipo, curso, seccion, aula, estado, prioridad, observacion, registradoPor } = req.body;
  if (!tipo?.trim() || !curso?.trim()) {
    return res.status(400).json({ error: "tipo y curso son requeridos" });
  }
  try {
    const [row] = await db
      .insert(seguridadIncidenciasTable)
      .values({
        tipo:         tipo.trim(),
        curso:        curso.trim().toUpperCase(),
        seccion:      seccion?.trim() || null,
        aula:         aula?.trim() || null,
        estado:       estado?.trim() || "PENDIENTE",
        prioridad:    prioridad?.trim() || "NORMAL",
        observacion:  observacion?.trim() || null,
        registradoPor: registradoPor?.trim() || null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[seguridad-incidencias] POST error:", err);
    res.status(500).json({ error: "Error al crear incidencia" });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { tipo, curso, seccion, aula, estado, prioridad, observacion, resolucion, resueltaPor } = req.body;
  try {
    const updates: Record<string, unknown> = {};
    if (tipo !== undefined)        updates.tipo        = tipo.trim();
    if (curso !== undefined)       updates.curso       = curso.trim().toUpperCase();
    if (seccion !== undefined)     updates.seccion     = seccion?.trim() || null;
    if (aula !== undefined)        updates.aula        = aula?.trim() || null;
    if (estado !== undefined)      updates.estado      = estado.trim();
    if (prioridad !== undefined)   updates.prioridad   = prioridad.trim();
    if (observacion !== undefined) updates.observacion = observacion?.trim() || null;
    if (resolucion !== undefined)  updates.resolucion  = resolucion?.trim() || null;
    if (estado === "RESUELTO") {
      updates.resueltaEn  = new Date();
      updates.resueltaPor = resueltaPor?.trim() || null;
    }
    const [row] = await db
      .update(seguridadIncidenciasTable)
      .set(updates)
      .where(eq(seguridadIncidenciasTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "No encontrado" });
    res.json(row);
  } catch (err) {
    console.error("[seguridad-incidencias] PUT error:", err);
    res.status(500).json({ error: "Error al actualizar" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(seguridadIncidenciasTable).where(eq(seguridadIncidenciasTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[seguridad-incidencias] DELETE error:", err);
    res.status(500).json({ error: "Error al eliminar" });
  }
});

export default router;
