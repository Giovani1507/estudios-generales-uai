import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const studentProblemTypeEnum = pgEnum("student_problem_type", [
  "plataforma",
  "cursos_no_aparecen",
  "no_aparece_lista_docente",
  "aula_virtual",
  "otros",
]);

export const studentProblemsTable = pgTable("student_problems", {
  id: serial("id").primaryKey(),
  apellidosNombres: text("apellidos_nombres").notNull(),
  carrera: text("carrera").notNull(),
  ciclo: text("ciclo").notNull(),
  seccion: text("seccion").notNull(),
  problema: studentProblemTypeEnum("problema").notNull(),
  descripcion: text("descripcion"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type StudentProblem = typeof studentProblemsTable.$inferSelect;
