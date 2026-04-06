import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { hashPassword } from "./auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable);
    res.json(users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

router.post("/", requireRole("administrador"), async (req, res) => {
  try {
    const { username, fullName, email, password, role } = req.body;
    if (!username || !fullName || !email || !password || !role) {
      res.status(400).json({ error: "Todos los campos son requeridos" });
      return;
    }
    const [user] = await db.insert(usersTable).values({
      username,
      fullName,
      email,
      passwordHash: hashPassword(password),
      role,
    }).returning();
    res.status(201).json({ ...user, createdAt: user.createdAt.toISOString() });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(400).json({ error: "Usuario o email ya existe" });
    } else {
      res.status(500).json({ error: "Error al crear usuario" });
    }
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const users = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!users[0]) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    const u = users[0];
    res.json({ ...u, createdAt: u.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

router.put("/:id", requireRole("administrador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { username, fullName, email, password, role, isActive } = req.body;
    const updates: any = {};
    if (username !== undefined) updates.username = username;
    if (fullName !== undefined) updates.fullName = fullName;
    if (email !== undefined) updates.email = email;
    if (password !== undefined) updates.passwordHash = hashPassword(password);
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    res.json({ ...user, createdAt: user.createdAt.toISOString() });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(400).json({ error: "Usuario o email ya existe" });
    } else {
      res.status(500).json({ error: "Error al actualizar usuario" });
    }
  }
});

router.delete("/:id", requireRole("administrador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ message: "Usuario eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

export default router;
