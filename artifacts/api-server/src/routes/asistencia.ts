import { Router } from "express";
import { db } from "@workspace/db";
import { asistenciaSesionesTable, asistenciaRegistrosTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// GET /api/asistencia/sesiones — list all sessions (protected)
router.get("/sesiones", requireAuth, async (_req, res) => {
  try {
    const sesiones = await db
      .select()
      .from(asistenciaSesionesTable)
      .orderBy(desc(asistenciaSesionesTable.createdAt));
    res.json(sesiones);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener sesiones" });
  }
});

// POST /api/asistencia/sesiones — create session (protected)
router.post("/sesiones", requireAuth, async (req, res) => {
  const { docente, curso, carrera, ciclo, seccion, dia, fecha } = req.body;
  if (!docente || !curso || !carrera || !ciclo || !seccion || !dia || !fecha) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }
  try {
    const [sesion] = await db
      .insert(asistenciaSesionesTable)
      .values({ docente, curso, carrera, ciclo, seccion, dia, fecha })
      .returning();
    res.status(201).json(sesion);
  } catch (err) {
    res.status(500).json({ error: "Error al crear sesión" });
  }
});

// GET /api/asistencia/sesiones/:id — get session (public, for student form)
router.get("/sesiones/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const [sesion] = await db
      .select()
      .from(asistenciaSesionesTable)
      .where(eq(asistenciaSesionesTable.id, id))
      .limit(1);
    if (!sesion) return res.status(404).json({ error: "Sesión no encontrada" });
    res.json(sesion);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener sesión" });
  }
});

// DELETE /api/asistencia/sesiones/:id (protected)
router.delete("/sesiones/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    await db.delete(asistenciaSesionesTable).where(eq(asistenciaSesionesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar sesión" });
  }
});

// GET /api/asistencia/sesiones/:id/registros — get attendance records for a session (protected)
router.get("/sesiones/:id/registros", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const registros = await db
      .select()
      .from(asistenciaRegistrosTable)
      .where(eq(asistenciaRegistrosTable.sesionId, id))
      .orderBy(asistenciaRegistrosTable.createdAt);
    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener registros" });
  }
});

// POST /api/asistencia/sesiones/:id/registros — student submits attendance (public)
router.post("/sesiones/:id/registros", async (req, res) => {
  const sesionId = Number(req.params.id);
  if (isNaN(sesionId)) return res.status(400).json({ error: "ID inválido" });
  const { apellidos, nombres } = req.body;
  if (!apellidos?.trim() || !nombres?.trim()) {
    return res.status(400).json({ error: "Apellidos y nombres son obligatorios" });
  }
  try {
    const [sesion] = await db
      .select()
      .from(asistenciaSesionesTable)
      .where(eq(asistenciaSesionesTable.id, sesionId))
      .limit(1);
    if (!sesion) return res.status(404).json({ error: "Sesión no encontrada" });

    const [registro] = await db
      .insert(asistenciaRegistrosTable)
      .values({ sesionId, apellidos: apellidos.trim(), nombres: nombres.trim() })
      .returning();
    res.status(201).json(registro);
  } catch (err) {
    res.status(500).json({ error: "Error al registrar asistencia" });
  }
});

// GET /api/asistencia/reporte — aggregate stats (protected)
router.get("/reporte", requireAuth, async (_req, res) => {
  try {
    const sesiones = await db.select().from(asistenciaSesionesTable);
    const registros = await db.select().from(asistenciaRegistrosTable);

    // Per carrera
    const porCarrera: Record<string, number> = {};
    const porCurso: Record<string, number> = {};
    const porDocente: Record<string, number> = {};

    for (const s of sesiones) {
      const count = registros.filter((r) => r.sesionId === s.id).length;
      porCarrera[s.carrera] = (porCarrera[s.carrera] || 0) + count;
      porCurso[s.curso] = (porCurso[s.curso] || 0) + count;
      porDocente[s.docente] = (porDocente[s.docente] || 0) + count;
    }

    res.json({
      totalSesiones: sesiones.length,
      totalRegistros: registros.length,
      porCarrera: Object.entries(porCarrera).map(([name, value]) => ({ name, value })),
      porCurso: Object.entries(porCurso).map(([name, value]) => ({ name, value })),
      porDocente: Object.entries(porDocente).map(([name, value]) => ({ name, value })),
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener reporte" });
  }
});

export default router;
