import { Request } from "express";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db/schema";
import { eq, lt } from "drizzle-orm";

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: "administrador" | "coordinador" | "administrativo";
  isActive: boolean;
  cargo?: string | null;
  avatarUrl?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      session?: { userId?: number };
    }
  }
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// Periodically clean expired sessions (every 30 min)
let cleanupScheduled = false;
function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setInterval(async () => {
    try {
      await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
    } catch {}
  }, 30 * 60 * 1000);
}

export async function createSession(token: string, user: SessionUser): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({
    token,
    userId:    user.id,
    username:  user.username,
    fullName:  user.fullName,
    email:     user.email,
    role:      user.role,
    isActive:  user.isActive ? "true" : "false",
    cargo:     user.cargo ?? null,
    avatarUrl: user.avatarUrl ?? null,
    expiresAt,
  }).onConflictDoUpdate({
    target: sessionsTable.token,
    set: { expiresAt },
  });
  scheduleCleanup();
}

export async function getSession(token: string): Promise<SessionUser | undefined> {
  try {
    const rows = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.token, token))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    if (row.expiresAt < new Date()) {
      await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
      return undefined;
    }
    return {
      id:        row.userId,
      username:  row.username,
      fullName:  row.fullName,
      email:     row.email,
      role:      row.role as SessionUser["role"],
      isActive:  row.isActive === "true",
      cargo:     row.cargo ?? null,
      avatarUrl: row.avatarUrl ?? null,
    };
  } catch {
    return undefined;
  }
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export function getTokenFromRequest(req: Request): string | undefined {
  return req.cookies?.["session_token"];
}
