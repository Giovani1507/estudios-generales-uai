import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const estudiantesSinVacanteTable = pgTable("estudiantes_sin_vacante", {
  id:               serial("id").primaryKey(),
  codigo:           text("codigo"),
  apellidosNombres: text("apellidos_nombres"),
  carrera:          text("carrera"),
  turno:            text("turno"),
  seccion:          text("seccion"),
  lugar:            text("lugar"),
  registradoEn:     timestamp("registrado_en").notNull().defaultNow(),
  registradoPor:    text("registrado_por"),
});

export type EstudianteSinVacante = typeof estudiantesSinVacanteTable.$inferSelect;
export type InsertEstudianteSinVacante = typeof estudiantesSinVacanteTable.$inferInsert;
