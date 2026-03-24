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
      cargo: user.cargo,
      avatarUrl: user.avatarUrl,
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
        cargo: user.cargo ?? null,
        avatarUrl: user.avatarUrl ?? null,
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

router.get("/me", requireAuth, async (req, res) => {
  const sessionUser = (req as any).currentUser;
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, sessionUser.id)).limit(1);
    const user = users[0];
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      cargo: user.cargo ?? null,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.patch("/me/cargo", requireAuth, async (req, res) => {
  const sessionUser = (req as any).currentUser;
  const { cargo } = req.body;
  if (typeof cargo !== "string") {
    res.status(400).json({ error: "cargo requerido" });
    return;
  }
  try {
    await db.update(usersTable).set({ cargo: cargo.trim() || null }).where(eq(usersTable.id, sessionUser.id));
    res.json({ message: "Cargo actualizado correctamente" });
  } catch (err) {
    console.error("Cargo update error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.patch("/me/avatar", requireAuth, async (req, res) => {
  const sessionUser = (req as any).currentUser;
  const { avatarDataUrl } = req.body;
  if (!avatarDataUrl || typeof avatarDataUrl !== "string") {
    res.status(400).json({ error: "avatarDataUrl requerido" });
    return;
  }
  if (!avatarDataUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "Formato de imagen inválido" });
    return;
  }
  try {
    await db.update(usersTable).set({ avatarUrl: avatarDataUrl }).where(eq(usersTable.id, sessionUser.id));
    res.json({ message: "Foto actualizada correctamente", avatarUrl: avatarDataUrl });
  } catch (err) {
    console.error("Avatar update error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export { hashPassword };
export default router;
