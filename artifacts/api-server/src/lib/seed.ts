import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import crypto from "crypto";

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
