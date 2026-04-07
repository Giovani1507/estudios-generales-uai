import { db } from "@workspace/db";
import { usersTable, ingresantesPagosTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import ingresantesData from "../data/ingresantes-seed.json";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "iuac_salt_2026").digest("hex");
}

const DEFAULT_USERS = [
  {
    username: "admin",
    fullName: "Administrador Principal",
    email: "admin@uai.edu.pe",
    passwordHash: hashPassword("admin123"),
    role: "administrador" as const,
    cargo: "Administrador del Sistema",
    isActive: true,
  },
  {
    username: "coord1",
    fullName: "Coordinador FCS",
    email: "coord1@uai.edu.pe",
    passwordHash: hashPassword("coord123"),
    role: "coordinador" as const,
    cargo: "Coordinador Académico",
    isActive: true,
  },
  {
    username: "administ1",
    fullName: "Personal Administrativo",
    email: "administ1@uai.edu.pe",
    passwordHash: hashPassword("admin456"),
    role: "administrativo" as const,
    cargo: "Personal Administrativo",
    isActive: true,
  },
];

export async function seedDefaultUsers() {
  try {
    for (const user of DEFAULT_USERS) {
      await db
        .insert(usersTable)
        .values(user)
        .onConflictDoNothing({ target: usersTable.username });
    }
    console.log("[seed] Usuarios base verificados/creados correctamente.");
  } catch (err) {
    console.error("[seed] Error al inicializar usuarios base:", err);
  }
}

export async function seedIngresantes() {
  try {
    console.log(`[seed] Sincronizando ${(ingresantesData as any[]).length} ingresantes...`);
    const BATCH = 100;
    const data = ingresantesData as {
      dni: string; apellidos_nombres: string; carrera: string | null;
      sede: string | null; modalidad_ingreso: string | null; modalidad_estudio: string | null;
      turno: string | null; seccion: string | null; codigo_estudiante: string | null;
      celular: string | null; correo: string | null;
    }[];
    for (let i = 0; i < data.length; i += BATCH) {
      const batch = data.slice(i, i + BATCH).map(r => ({
        dni:              r.dni,
        apellidosNombres: r.apellidos_nombres,
        carrera:          r.carrera,
        sede:             r.sede,
        modalidadIngreso: r.modalidad_ingreso,
        modalidadEstudio: r.modalidad_estudio,
        turno:            r.turno,
        seccion:          r.seccion,
        codigoEstudiante: r.codigo_estudiante,
        celular:          r.celular,
        correo:           r.correo,
      }));
      await db.insert(ingresantesPagosTable).values(batch)
        .onConflictDoUpdate({
          target: ingresantesPagosTable.dni,
          set: {
            apellidosNombres: sql`excluded.apellidos_nombres`,
            carrera:          sql`excluded.carrera`,
            sede:             sql`excluded.sede`,
            modalidadIngreso: sql`excluded.modalidad_ingreso`,
            modalidadEstudio: sql`excluded.modalidad_estudio`,
            turno:            sql`excluded.turno`,
            seccion:          sql`excluded.seccion`,
            codigoEstudiante: sql`excluded.codigo_estudiante`,
            celular:          sql`excluded.celular`,
            correo:           sql`excluded.correo`,
          },
        });
    }
    console.log("[seed] ingresantes_pagos sincronizado correctamente.");
  } catch (err) {
    console.error("[seed] Error al sembrar ingresantes:", err);
  }
}
