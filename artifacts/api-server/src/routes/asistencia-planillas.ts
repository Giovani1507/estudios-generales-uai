import { Router } from "express";
import { db } from "@workspace/db";
import { asistenciaPlanillasTable } from "@workspace/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth);

const requireWriter = requireRole("administrador", "coordinador");

/* Lista de planillas. Filtros opcionales: ?docente=...&codigoCurso=...&carrera=...&ciclo=...&seccion=... */
router.get("/", async (req, res) => {
  try {
    const { docente, codigoCurso, carrera, ciclo, seccion } = req.query as {
      docente?: string; codigoCurso?: string; carrera?: string; ciclo?: string; seccion?: string;
    };
    const conds = [];
    if (docente) conds.push(eq(asistenciaPlanillasTable.docente, String(docente).toUpperCase().trim()));
    if (codigoCurso) conds.push(eq(asistenciaPlanillasTable.codigoCurso, String(codigoCurso).trim()));
    if (carrera) conds.push(eq(asistenciaPlanillasTable.carrera, String(carrera).trim()));
    if (ciclo) conds.push(eq(asistenciaPlanillasTable.ciclo, String(ciclo).trim()));
    if (seccion) conds.push(eq(asistenciaPlanillasTable.seccion, String(seccion).trim()));
    const rows = await db
      .select({
        id: asistenciaPlanillasTable.id,
        docente: asistenciaPlanillasTable.docente,
        carrera: asistenciaPlanillasTable.carrera,
        ciclo: asistenciaPlanillasTable.ciclo,
        seccion: asistenciaPlanillasTable.seccion,
        turno: asistenciaPlanillasTable.turno,
        sede: asistenciaPlanillasTable.sede,
        modalidad: asistenciaPlanillasTable.modalidad,
        dia: asistenciaPlanillasTable.dia,
        codigoCurso: asistenciaPlanillasTable.codigoCurso,
        nombreCurso: asistenciaPlanillasTable.nombreCurso,
        encabezadoCrudo: asistenciaPlanillasTable.encabezadoCrudo,
        createdAt: asistenciaPlanillasTable.createdAt,
        updatedAt: asistenciaPlanillasTable.updatedAt,
        totalAlumnos: sql<number>`jsonb_array_length(${asistenciaPlanillasTable.alumnos})`.as("total_alumnos"),
      })
      .from(asistenciaPlanillasTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(asistenciaPlanillasTable.updatedAt));
    res.json(rows);
  } catch (err) {
    console.error("[asistencia-planillas] GET error:", err);
    res.status(500).json({ error: "Error al obtener planillas" });
  }
});

/* Devuelve TODAS las planillas con datos completos (weeks + alumnos + totales) en una sola query */
router.get("/all-full", async (_req, res) => {
  try {
    const rows = await db.select().from(asistenciaPlanillasTable).orderBy(desc(asistenciaPlanillasTable.updatedAt));
    res.json(rows);
  } catch (err) {
    console.error("[asistencia-planillas] GET /all-full error:", err);
    res.status(500).json({ error: "Error al obtener planillas completas" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });
    const [row] = await db.select().from(asistenciaPlanillasTable).where(eq(asistenciaPlanillasTable.id, id));
    if (!row) return res.status(404).json({ error: "Planilla no encontrada" });
    res.json(row);
  } catch (err) {
    console.error("[asistencia-planillas] GET /:id error:", err);
    res.status(500).json({ error: "Error al obtener planilla" });
  }
});

router.post("/", requireWriter, async (req, res) => {
  const user = (req as any).currentUser;
  const {
    docente, carrera, ciclo, seccion, turno, sede, modalidad, dia,
    codigoCurso, nombreCurso, encabezadoCrudo,
    weeks, alumnos, totales,
  } = req.body || {};
  if (!Array.isArray(alumnos)) return res.status(400).json({ error: "Lista de alumnos inválida" });
  try {
    const [row] = await db.insert(asistenciaPlanillasTable).values({
      docente: docente ? String(docente).toUpperCase().trim() : null,
      carrera: carrera ?? null,
      ciclo: ciclo ?? null,
      seccion: seccion ?? null,
      turno: turno ?? null,
      sede: sede ?? null,
      modalidad: modalidad ?? null,
      dia: dia ?? null,
      codigoCurso: codigoCurso ?? null,
      nombreCurso: nombreCurso ?? null,
      encabezadoCrudo: encabezadoCrudo ?? null,
      weeks: weeks ?? [],
      alumnos: alumnos ?? [],
      totales: totales ?? {},
      createdBy: user?.id ?? null,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[asistencia-planillas] POST error:", err);
    res.status(500).json({ error: "Error al guardar planilla" });
  }
});

router.put("/:id", requireWriter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });
    const { weeks, alumnos, totales, modalidad, sede, turno, dia, seccion, encabezadoCrudo } = req.body || {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (weeks !== undefined) patch.weeks = weeks;
    if (alumnos !== undefined) patch.alumnos = alumnos;
    if (totales !== undefined) patch.totales = totales;
    if (modalidad !== undefined) patch.modalidad = modalidad;
    if (sede !== undefined) patch.sede = sede;
    if (turno !== undefined) patch.turno = turno;
    if (dia !== undefined) patch.dia = dia;
    if (seccion !== undefined) patch.seccion = seccion;
    if (encabezadoCrudo !== undefined) patch.encabezadoCrudo = encabezadoCrudo;
    const [row] = await db.update(asistenciaPlanillasTable).set(patch).where(eq(asistenciaPlanillasTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Planilla no encontrada" });
    res.json(row);
  } catch (err) {
    console.error("[asistencia-planillas] PUT error:", err);
    res.status(500).json({ error: "Error al actualizar planilla" });
  }
});

router.delete("/:id", requireWriter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });
    await db.delete(asistenciaPlanillasTable).where(eq(asistenciaPlanillasTable.id, id));
    res.status(204).end();
  } catch (err) {
    console.error("[asistencia-planillas] DELETE error:", err);
    res.status(500).json({ error: "Error al eliminar planilla" });
  }
});

/* DELETE /api/asistencia-planillas — borra TODAS las planillas */
router.delete("/", requireRole("administrador", "coordinador"), async (_req, res) => {
  try {
    const result = await db.delete(asistenciaPlanillasTable);
    res.json({ deleted: true });
  } catch (err) {
    console.error("[asistencia-planillas] DELETE ALL error:", err);
    res.status(500).json({ error: "Error al limpiar planillas" });
  }
});

export default router;
