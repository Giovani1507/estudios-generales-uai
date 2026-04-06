import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const ingresantesPagosTable = pgTable("ingresantes_pagos", {
  id:               serial("id").primaryKey(),
  dni:              text("dni").notNull(),
  apellidosNombres: text("apellidos_nombres").notNull(),
  carrera:          text("carrera"),
  sede:             text("sede"),
  modalidadIngreso: text("modalidad_ingreso"),
  modalidadEstudio: text("modalidad_estudio"),
  turno:            text("turno"),
  seccion:          text("seccion"),
});

export type IngresantePago = typeof ingresantesPagosTable.$inferSelect;
