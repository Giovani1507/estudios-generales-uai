import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const rectificacionesTable = pgTable("rectificaciones", {
  id:              serial("id").primaryKey(),
  apellidosNombres: text("apellidos_nombres").notNull(),
  celular:         text("celular").notNull(),
  atendidoPor:     text("atendido_por").notNull(),
  fotoPago:        text("foto_pago"),
  observaciones:   text("observaciones"),
  registradoEn:    timestamp("registrado_en").notNull().defaultNow(),
});

export type Rectificacion = typeof rectificacionesTable.$inferSelect;
export type InsertRectificacion = typeof rectificacionesTable.$inferInsert;
