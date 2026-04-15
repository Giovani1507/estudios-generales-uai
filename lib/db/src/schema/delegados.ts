import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const delegadosTable = pgTable("delegados", {
  id:               serial("id").primaryKey(),
  tipo:             text("tipo").notNull().default("DELEGADO"),
  apellidosNombres: text("apellidos_nombres").notNull(),
  carrera:          text("carrera").notNull(),
  ciclo:            text("ciclo").notNull(),
  seccion:          text("seccion").notNull(),
  numero:           text("numero"),
  correo:           text("correo"),
  registradoEn:     timestamp("registrado_en").notNull().defaultNow(),
});

export type Delegado = typeof delegadosTable.$inferSelect;
export type InsertDelegado = typeof delegadosTable.$inferInsert;
