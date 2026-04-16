import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";

export const asistenciaRegistrosTable = pgTable("asistencia_registros", {
  id: serial("id").primaryKey(),
  apellidos: text("apellidos").notNull(),
  nombres: text("nombres").notNull(),
  docente: text("docente").notNull(),
  curso: text("curso").notNull(),
  carrera: text("carrera").notNull(),
  ciclo: text("ciclo").notNull(),
  seccion: text("seccion").notNull(),
  dia: text("dia").notNull(),
  fecha: date("fecha").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
