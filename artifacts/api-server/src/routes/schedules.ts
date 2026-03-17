import { Router } from "express";
import { db } from "@workspace/db";
import { schedulesTable, teachersTable, sectionsTable, coursesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const { teacherId, sectionId } = req.query;

    const conditions: any[] = [];
    if (teacherId) {
      conditions.push(eq(schedulesTable.teacherId, parseInt(teacherId as string)));
    }
    if (sectionId) {
      conditions.push(eq(schedulesTable.sectionId, parseInt(sectionId as string)));
    }

    const query = db
      .select({
        id: schedulesTable.id,
        teacherId: schedulesTable.teacherId,
        teacherName: teachersTable.fullName,
        sectionId: schedulesTable.sectionId,
        sectionName: sectionsTable.name,
        courseId: schedulesTable.courseId,
        courseName: coursesTable.name,
        dayOfWeek: schedulesTable.dayOfWeek,
        startTime: schedulesTable.startTime,
        endTime: schedulesTable.endTime,
        classroom: schedulesTable.classroom,
      })
      .from(schedulesTable)
      .leftJoin(teachersTable, eq(schedulesTable.teacherId, teachersTable.id))
      .leftJoin(sectionsTable, eq(schedulesTable.sectionId, sectionsTable.id))
      .leftJoin(coursesTable, eq(schedulesTable.courseId, coursesTable.id));

    const schedules = conditions.length > 0
      ? await query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : await query;

    res.json(schedules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener horarios" });
  }
});

router.post("/", requireRole("administrador", "coordinador"), async (req, res) => {
  try {
    const { teacherId, sectionId, courseId, dayOfWeek, startTime, endTime, classroom } = req.body;
    const [schedule] = await db.insert(schedulesTable).values({
      teacherId, sectionId, courseId, dayOfWeek, startTime, endTime, classroom
    }).returning();

    const [full] = await db
      .select({
        id: schedulesTable.id,
        teacherId: schedulesTable.teacherId,
        teacherName: teachersTable.fullName,
        sectionId: schedulesTable.sectionId,
        sectionName: sectionsTable.name,
        courseId: schedulesTable.courseId,
        courseName: coursesTable.name,
        dayOfWeek: schedulesTable.dayOfWeek,
        startTime: schedulesTable.startTime,
        endTime: schedulesTable.endTime,
        classroom: schedulesTable.classroom,
      })
      .from(schedulesTable)
      .leftJoin(teachersTable, eq(schedulesTable.teacherId, teachersTable.id))
      .leftJoin(sectionsTable, eq(schedulesTable.sectionId, sectionsTable.id))
      .leftJoin(coursesTable, eq(schedulesTable.courseId, coursesTable.id))
      .where(eq(schedulesTable.id, schedule.id));

    res.status(201).json(full);
  } catch {
    res.status(500).json({ error: "Error al crear horario" });
  }
});

router.put("/:id", requireRole("administrador", "coordinador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { teacherId, sectionId, courseId, dayOfWeek, startTime, endTime, classroom } = req.body;
    await db.update(schedulesTable).set({
      teacherId, sectionId, courseId, dayOfWeek, startTime, endTime, classroom
    }).where(eq(schedulesTable.id, id));

    const [full] = await db
      .select({
        id: schedulesTable.id,
        teacherId: schedulesTable.teacherId,
        teacherName: teachersTable.fullName,
        sectionId: schedulesTable.sectionId,
        sectionName: sectionsTable.name,
        courseId: schedulesTable.courseId,
        courseName: coursesTable.name,
        dayOfWeek: schedulesTable.dayOfWeek,
        startTime: schedulesTable.startTime,
        endTime: schedulesTable.endTime,
        classroom: schedulesTable.classroom,
      })
      .from(schedulesTable)
      .leftJoin(teachersTable, eq(schedulesTable.teacherId, teachersTable.id))
      .leftJoin(sectionsTable, eq(schedulesTable.sectionId, sectionsTable.id))
      .leftJoin(coursesTable, eq(schedulesTable.courseId, coursesTable.id))
      .where(eq(schedulesTable.id, id));

    if (!full) {
      res.status(404).json({ error: "Horario no encontrado" });
      return;
    }
    res.json(full);
  } catch {
    res.status(500).json({ error: "Error al actualizar horario" });
  }
});

router.delete("/:id", requireRole("administrador", "coordinador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(schedulesTable).where(eq(schedulesTable.id, id));
    res.json({ message: "Horario eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar horario" });
  }
});

export default router;
