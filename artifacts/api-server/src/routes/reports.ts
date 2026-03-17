import { Router } from "express";
import { db } from "@workspace/db";
import { teachersTable, coursesTable, sectionsTable, schedulesTable, announcementsTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/summary", async (_req, res) => {
  try {
    const [teacherCount] = await db.select({ count: count() }).from(teachersTable);
    const [courseCount] = await db.select({ count: count() }).from(coursesTable);
    const [sectionCount] = await db.select({ count: count() }).from(sectionsTable);
    const [scheduleCount] = await db.select({ count: count() }).from(schedulesTable);
    const [announcementCount] = await db.select({ count: count() }).from(announcementsTable);

    res.json({
      totalTeachers: Number(teacherCount.count),
      totalStudents: 0,
      totalCourses: Number(courseCount.count),
      totalSections: Number(sectionCount.count),
      schedulesThisWeek: Number(scheduleCount.count),
      activeAnnouncements: Number(announcementCount.count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener reporte" });
  }
});

export default router;
