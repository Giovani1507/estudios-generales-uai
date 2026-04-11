import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const mapeoCambiosTable = pgTable("mapeo_cambios", {
  id:               serial("id").primaryKey(),
  codigoEstudiante: text("codigo_estudiante").notNull(),
  apellidosNombres: text("apellidos_nombres"),
  dni:              text("dni"),
  tipoCambio:       text("tipo_cambio").notNull(),
  campoModificado:  text("campo_modificado"),
  valorAnterior:    text("valor_anterior"),
  valorNuevo:       text("valor_nuevo"),
  matriculadoPor:   text("matriculado_por"),
  observaciones:    text("observaciones"),
  registradoPor:    text("registrado_por"),
  registradoEn:     timestamp("registrado_en").notNull().defaultNow(),
  resuelto:         boolean("resuelto").notNull().default(false),
  resueltaEn:       timestamp("resuelta_en"),
  resueltaPor:      text("resuelta_por"),
});

export type MapeoCambio = typeof mapeoCambiosTable.$inferSelect;
export type InsertMapeoCambio = typeof mapeoCambiosTable.$inferInsert;
