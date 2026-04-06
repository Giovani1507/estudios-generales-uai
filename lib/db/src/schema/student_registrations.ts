import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const studentRegistrationsTable = pgTable("student_registrations", {
  id:          serial("id").primaryKey(),
  apellidos:   text("apellidos").notNull(),
  nombres:     text("nombres").notNull(),
  telefono:    text("telefono").notNull(),
  carrera:     text("carrera").notNull(),
  ciclo:       text("ciclo"),
  matriculado: boolean("matriculado").notNull().default(false),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export type StudentRegistration = typeof studentRegistrationsTable.$inferSelect;
export type InsertStudentRegistration = typeof studentRegistrationsTable.$inferInsert;
