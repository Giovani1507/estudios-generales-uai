import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const justificacionesTable = pgTable("justificaciones", {
  id: serial("id").primaryKey(),
  apellidoNombre: text("apellido_nombre").notNull(),
  curso: text("curso").notNull(),
  ciclo: text("ciclo").notNull(),
  docente: text("docente").notNull(),
  dia: text("dia").notNull(),
  descripcion: text("descripcion"),
  justificado: boolean("justificado").notNull().default(false),
  justificadoAt: timestamp("justificado_at"),
  justificadoPor: text("justificado_por"),
  createdByUserId: integer("created_by_user_id"),
  createdByUsername: text("created_by_username"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Justificacion = typeof justificacionesTable.$inferSelect;
export type InsertJustificacion = typeof justificacionesTable.$inferInsert;
