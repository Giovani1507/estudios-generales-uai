import { pgTable, serial, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const codigosVerificadosTable = pgTable("codigos_verificados", {
  id:               serial("id").primaryKey(),
  codigoEstudiante: varchar("codigo_estudiante", { length: 20 }).notNull().unique(),
  apellidosNombres: varchar("apellidos_nombres", { length: 200 }),
  dni:              varchar("dni", { length: 8 }),
  carrera:          varchar("carrera", { length: 200 }),
  sede:             varchar("sede", { length: 100 }),
  modalidadEstudio: varchar("modalidad_estudio", { length: 100 }),
  turno:            varchar("turno", { length: 50 }),
  seccion:          varchar("seccion", { length: 20 }),
  celular:          varchar("celular", { length: 20 }),
  encontrado:       boolean("encontrado").notNull().default(false),
  tieneHorario:     boolean("tiene_horario").notNull().default(false),
  verificadoEn:     timestamp("verificado_en").notNull().defaultNow(),
});
