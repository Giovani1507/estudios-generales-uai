import { Router } from "express";
import { db } from "@workspace/db";
import { nominasTable, type NominaData } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id:            nominasTable.id,
        periodo:       nominasTable.periodo,
        codigoCarrera: nominasTable.codigoCarrera,
        carrera:       nominasTable.carrera,
        estado:        nominasTable.estado,
        createdById:   nominasTable.createdById,
        createdByName: nominasTable.createdByName,
        createdAt:     nominasTable.createdAt,
        updatedAt:     nominasTable.updatedAt,
      })
      .from(nominasTable)
      .orderBy(desc(nominasTable.updatedAt));
    res.json(rows);
  } catch (err) {
    console.error("[nominas] GET error:", err);
    res.status(500).json({ error: "Error al obtener nóminas" });
  }
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  try {
    const [row] = await db.select().from(nominasTable).where(eq(nominasTable.id, id));
    if (!row) return res.status(404).json({ error: "Nómina no encontrada" });
    res.json(row);
  } catch (err) {
    console.error("[nominas] GET id error:", err);
    res.status(500).json({ error: "Error al obtener nómina" });
  }
});

router.post("/", requireAuth, async (req: any, res) => {
  try {
    const { periodo, codigoCarrera, carrera, data, estado } = req.body as {
      periodo: string;
      codigoCarrera: string;
      carrera: string;
      data: NominaData;
      estado?: string;
    };
    if (!periodo?.trim())       return res.status(400).json({ error: "Periodo requerido" });
    if (!codigoCarrera?.trim()) return res.status(400).json({ error: "Código de carrera requerido" });
    if (!carrera?.trim())       return res.status(400).json({ error: "Carrera requerida" });
    if (!data || !Array.isArray(data.grupos)) return res.status(400).json({ error: "Datos inválidos" });

    const user = (req as any).currentUser;
    const [row] = await db
      .insert(nominasTable)
      .values({
        periodo: periodo.trim(),
        codigoCarrera: codigoCarrera.trim().toUpperCase(),
        carrera: carrera.trim().toUpperCase(),
        data,
        estado: estado || "BORRADOR",
        createdById: user?.id ?? null,
        createdByName: user?.fullName || user?.username || null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[nominas] POST error:", err);
    res.status(500).json({ error: "Error al guardar nómina" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  try {
    const { data, estado, periodo, carrera } = req.body as {
      data?: NominaData;
      estado?: string;
      periodo?: string;
      carrera?: string;
    };
    const update: Record<string, any> = { updatedAt: new Date() };
    if (data && Array.isArray(data.grupos)) update.data = data;
    if (estado) update.estado = estado;
    if (periodo) update.periodo = periodo.trim();
    if (carrera) update.carrera = carrera.trim().toUpperCase();

    const [row] = await db
      .update(nominasTable)
      .set(update)
      .where(eq(nominasTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Nómina no encontrada" });
    res.json(row);
  } catch (err) {
    console.error("[nominas] PUT error:", err);
    res.status(500).json({ error: "Error al actualizar nómina" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  try {
    await db.delete(nominasTable).where(eq(nominasTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[nominas] DELETE error:", err);
    res.status(500).json({ error: "Error al eliminar" });
  }
});

export default router;
