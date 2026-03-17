import { pgTable, text, serial, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { sectionsTable } from "./sections";
import { coursesTable } from "./courses";

export const dayOfWeekEnum = pgEnum("day_of_week", ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]);

export const schedulesTable = pgTable("schedules", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id),
  sectionId: integer("section_id").notNull().references(() => sectionsTable.id),
  courseId: integer("course_id").notNull().references(() => coursesTable.id),
  dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  classroom: text("classroom").notNull(),
});

export const insertScheduleSchema = createInsertSchema(schedulesTable).omit({ id: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedulesTable.$inferSelect;
