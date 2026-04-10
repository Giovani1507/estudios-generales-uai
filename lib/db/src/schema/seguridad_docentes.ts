import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const seguridadDocentesTable = pgTable("seguridad_docentes", {
  id:           serial("id").primaryKey(),
  nombre:       text("nombre").notNull(),
  tipo:         text("tipo").notNull(),
  observacion:  text("observacion"),
  registradoEn: timestamp("registrado_en").notNull().defaultNow(),
  registradoPor: text("registrado_por"),
});

export type SeguridadDocente = typeof seguridadDocentesTable.$inferSelect;
export type InsertSeguridadDocente = typeof seguridadDocentesTable.$inferInsert;
