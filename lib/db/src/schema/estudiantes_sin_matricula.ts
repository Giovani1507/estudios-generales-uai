import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const estudiantesSinMatriculaTable = pgTable("estudiantes_sin_matricula", {
  id:               serial("id").primaryKey(),
  apellidosNombres: text("apellidos_nombres").notNull(),
  dni:              text("dni"),
  codigo:           text("codigo"),
  carrera:          text("carrera"),
  registradoEn:     timestamp("registrado_en").notNull().defaultNow(),
  registradoPor:    text("registrado_por"),
  registradoVia:    text("registrado_via").notNull().default("admin"),
});

export type EstudianteSinMatricula = typeof estudiantesSinMatriculaTable.$inferSelect;
export type InsertEstudianteSinMatricula = typeof estudiantesSinMatriculaTable.$inferInsert;
