import { Request } from "express";

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: "administrador" | "coordinador" | "administrativo";
  isActive: boolean;
  avatarUrl?: string | null;
}

declare module "express-serve-static-core" {
  interface Request {
    session?: {
      userId?: number;
    };
  }
}

const sessions = new Map<string, SessionUser>();

export function createSession(token: string, user: SessionUser): void {
  sessions.set(token, user);
}

export function getSession(token: string): SessionUser | undefined {
  return sessions.get(token);
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

export function getTokenFromRequest(req: Request): string | undefined {
  return req.cookies?.["session_token"];
}
