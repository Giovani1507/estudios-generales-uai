import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const seguridadDocentesTable = pgTable("seguridad_docentes", {
  id:            serial("id").primaryKey(),
  nombre:        text("nombre").notNull(),
  tipo:          text("tipo").notNull(),
  estado:        text("estado").notNull().default("PENDIENTE"),
  prioridad:     text("prioridad").notNull().default("NORMAL"),
  observacion:   text("observacion"),
  resolucion:    text("resolucion"),
  registradoEn:  timestamp("registrado_en").notNull().defaultNow(),
  registradoPor: text("registrado_por"),
  resueltaEn:    timestamp("resuelta_en"),
  resueltaPor:   text("resuelta_por"),
});

export type SeguridadDocente = typeof seguridadDocentesTable.$inferSelect;
export type InsertSeguridadDocente = typeof seguridadDocentesTable.$inferInsert;
