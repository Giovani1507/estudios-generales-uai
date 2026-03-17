import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { createSession, deleteSession, getTokenFromRequest, getSession } from "../lib/session.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "iuac_salt_2026").digest("hex");
}

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Usuario y contraseña son requeridos" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    const user = users[0];

    if (!user || user.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({ error: "Usuario desactivado. Contacte al administrador." });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    createSession(token, {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });

    res.cookie("session_token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.json({
      message: "Inicio de sesión exitoso",
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/logout", (req, res) => {
  const token = getTokenFromRequest(req);
  if (token) {
    deleteSession(token);
  }
  res.clearCookie("session_token");
  res.json({ message: "Sesión cerrada" });
});

router.get("/me", requireAuth, (req, res) => {
  const user = (req as any).currentUser;
  res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: new Date().toISOString(),
  });
});

export { hashPassword };
export default router;
