import { Request, Response, NextFunction } from "express";
import { getTokenFromRequest, getSession } from "../lib/session.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const user = getSession(token);
  if (!user) {
    res.status(401).json({ error: "Sesión inválida o expirada" });
    return;
  }
  if (!user.isActive) {
    res.status(401).json({ error: "Usuario desactivado" });
    return;
  }
  (req as any).currentUser = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).currentUser;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "Sin permisos suficientes" });
      return;
    }
    next();
  };
}
