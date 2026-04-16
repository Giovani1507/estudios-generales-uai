import { Router } from "express";
import { db } from "@workspace/db";
import { asistenciaRegistrosTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// POST /api/asistencia/registros — student submits attendance (public)
router.post("/registros", async (req, res) => {
  const { apellidos, nombres, docente, curso, carrera, ciclo, seccion, dia, fecha } = req.body;
  if (!apellidos?.trim() || !nombres?.trim() || !docente?.trim() || !curso?.trim() ||
      !carrera?.trim() || !ciclo?.trim() || !seccion?.trim() || !dia?.trim() || !fecha?.trim()) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }
  try {
    const [registro] = await db
      .insert(asistenciaRegistrosTable)
      .values({
        apellidos: apellidos.trim().toUpperCase(),
        nombres: nombres.trim().toUpperCase(),
        docente: docente.trim().toUpperCase(),
        curso: curso.trim().toUpperCase(),
        carrera: carrera.trim().toUpperCase(),
        ciclo: ciclo.trim().toUpperCase(),
        seccion: seccion.trim().toUpperCase(),
        dia: dia.trim(),
        fecha: fecha.trim(),
      })
      .returning();
    res.status(201).json(registro);
  } catch (err) {
    res.status(500).json({ error: "Error al registrar asistencia" });
  }
});

// GET /api/asistencia/registros — get all records (protected)
router.get("/registros", requireAuth, async (_req, res) => {
  try {
    const registros = await db
      .select()
      .from(asistenciaRegistrosTable)
      .orderBy(desc(asistenciaRegistrosTable.createdAt));
    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener registros" });
  }
});

// DELETE /api/asistencia/registros/:id — delete a record (protected)
router.delete("/registros/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    await db.delete(asistenciaRegistrosTable).where(eq(asistenciaRegistrosTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar registro" });
  }
});

// GET /api/asistencia/reporte — aggregate data for charts (protected)
router.get("/reporte", requireAuth, async (_req, res) => {
  try {
    const registros = await db.select().from(asistenciaRegistrosTable);

    const porCarrera: Record<string, number> = {};
    const porCurso: Record<string, number> = {};
    const porDocente: Record<string, number> = {};
    const porDia: Record<string, number> = {};

    for (const r of registros) {
      porCarrera[r.carrera] = (porCarrera[r.carrera] || 0) + 1;
      porCurso[r.curso] = (porCurso[r.curso] || 0) + 1;
      porDocente[r.docente] = (porDocente[r.docente] || 0) + 1;
      porDia[r.dia] = (porDia[r.dia] || 0) + 1;
    }

    res.json({
      totalRegistros: registros.length,
      porCarrera: Object.entries(porCarrera).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      porCurso: Object.entries(porCurso).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      porDocente: Object.entries(porDocente).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      porDia: Object.entries(porDia).map(([name, value]) => ({ name, value })),
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener reporte" });
  }
});

export default router;
