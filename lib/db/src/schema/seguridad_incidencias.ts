import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const seguridadIncidenciasTable = pgTable("seguridad_incidencias", {
  id:            serial("id").primaryKey(),
  tipo:          text("tipo").notNull(),
  curso:         text("curso").notNull(),
  seccion:       text("seccion"),
  aula:          text("aula"),
  estado:        text("estado").notNull().default("PENDIENTE"),
  prioridad:     text("prioridad").notNull().default("NORMAL"),
  observacion:   text("observacion"),
  resolucion:    text("resolucion"),
  registradoEn:  timestamp("registrado_en").notNull().defaultNow(),
  registradoPor: text("registrado_por"),
  resueltaEn:    timestamp("resuelta_en"),
  resueltaPor:   text("resuelta_por"),
});

export type SeguridadIncidencia = typeof seguridadIncidenciasTable.$inferSelect;
export type InsertSeguridadIncidencia = typeof seguridadIncidenciasTable.$inferInsert;
