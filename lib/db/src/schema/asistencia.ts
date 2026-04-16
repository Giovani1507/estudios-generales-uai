import { pgTable, serial, text, date, timestamp, integer } from "drizzle-orm/pg-core";

export const asistenciaSesionesTable = pgTable("asistencia_sesiones", {
  id: serial("id").primaryKey(),
  docente: text("docente").notNull(),
  curso: text("curso").notNull(),
  carrera: text("carrera").notNull(),
  ciclo: text("ciclo").notNull(),
  seccion: text("seccion").notNull(),
  dia: text("dia").notNull(),
  fecha: date("fecha").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const asistenciaRegistrosTable = pgTable("asistencia_registros", {
  id: serial("id").primaryKey(),
  sesionId: integer("sesion_id").notNull().references(() => asistenciaSesionesTable.id, { onDelete: "cascade" }),
  apellidos: text("apellidos").notNull(),
  nombres: text("nombres").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
