import { Router } from "express";
import { db } from "@workspace/db";
import { announcementsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  try {
    const announcements = await db
      .select({
        id: announcementsTable.id,
        title: announcementsTable.title,
        content: announcementsTable.content,
        authorName: usersTable.fullName,
        priority: announcementsTable.priority,
        createdAt: announcementsTable.createdAt,
      })
      .from(announcementsTable)
      .leftJoin(usersTable, eq(announcementsTable.authorId, usersTable.id));
    res.json(announcements.map(a => ({ ...a, createdAt: a.createdAt?.toISOString() })));
  } catch {
    res.status(500).json({ error: "Error al obtener avisos" });
  }
});

router.post("/", requireRole("administrador", "coordinador"), async (req, res) => {
  try {
    const currentUser = (req as any).currentUser;
    const { title, content, priority } = req.body;
    const [announcement] = await db.insert(announcementsTable).values({
      title,
      content,
      authorId: currentUser.id,
      priority,
    }).returning();
    res.status(201).json({
      ...announcement,
      authorName: currentUser.fullName,
      createdAt: announcement.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Error al crear aviso" });
  }
});

router.put("/:id", requireRole("administrador", "coordinador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { title, content, priority } = req.body;
    const [announcement] = await db.update(announcementsTable).set({ title, content, priority }).where(eq(announcementsTable.id, id)).returning();
    if (!announcement) {
      res.status(404).json({ error: "Aviso no encontrado" });
      return;
    }
    res.json({ ...announcement, authorName: "Sistema", createdAt: announcement.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Error al actualizar aviso" });
  }
});

router.delete("/:id", requireRole("administrador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
    res.json({ message: "Aviso eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar aviso" });
  }
});

export default router;
