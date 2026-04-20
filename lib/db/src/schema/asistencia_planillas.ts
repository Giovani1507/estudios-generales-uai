import { pgTable, serial, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";

export const asistenciaPlanillasTable = pgTable("asistencia_planillas", {
  id:               serial("id").primaryKey(),
  docente:          text("docente"),
  carrera:          text("carrera"),
  ciclo:            text("ciclo"),
  seccion:          text("seccion"),
  turno:            text("turno"),
  sede:             text("sede"),
  modalidad:        text("modalidad"),
  dia:              text("dia"),
  codigoCurso:      text("codigo_curso"),
  nombreCurso:      text("nombre_curso"),
  encabezadoCrudo:  text("encabezado_crudo"),
  weeks:            jsonb("weeks").notNull().default([]),
  alumnos:          jsonb("alumnos").notNull().default([]),
  totales:          jsonb("totales").notNull().default({}),
  createdBy:        integer("created_by"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
});

export type AsistenciaPlanilla = typeof asistenciaPlanillasTable.$inferSelect;
export type InsertAsistenciaPlanilla = typeof asistenciaPlanillasTable.$inferInsert;

export type PlanillaWeek = { label: string; fecha: string; dia: string };
export type PlanillaAlumno = { numero: string; nombre: string; marcas: string[]; porcentaje: number };
export type PlanillaTotales = { asistencias: number[]; inasistencias: number[] };
