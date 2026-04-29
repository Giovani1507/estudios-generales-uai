import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const nominasTable = pgTable("nominas", {
  id:             serial("id").primaryKey(),
  periodo:        text("periodo").notNull(),
  codigoCarrera:  text("codigo_carrera").notNull(),
  carrera:        text("carrera").notNull(),
  data:           jsonb("data").notNull().$type<NominaData>(),
  estado:         text("estado").notNull().default("BORRADOR"),
  createdById:    integer("created_by_id"),
  createdByName:  text("created_by_name"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
});

export type NominaCurso = {
  nombre: string;
  codigo: string;
  seccion: string;
  matriculados: number;
  retOctda: number;
  retInasist: number;
  totalActivos: number;
};

export type NominaGrupo = {
  ciclo: 1 | 2;
  carrera: string;
  modalidad: "PRESENCIAL" | "VIRTUAL";
  local: string;
  seccion: string;
  turno: "DIURNO" | "NOCTURNO" | "";
  matriculados: number;
  retOctda: number;
  retInasist: number;
  totalActivos: number;
  cursos: NominaCurso[];
};

export type NominaData = {
  grupos: NominaGrupo[];
};

export type Nomina = typeof nominasTable.$inferSelect;
export type InsertNomina = typeof nominasTable.$inferInsert;
