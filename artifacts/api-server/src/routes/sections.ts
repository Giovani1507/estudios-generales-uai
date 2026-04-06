import { Router } from "express";
import { db } from "@workspace/db";
import { sectionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  try {
    const sections = await db.select().from(sectionsTable);
    res.json(sections);
  } catch {
    res.status(500).json({ error: "Error al obtener secciones" });
  }
});

router.post("/", requireRole("administrador", "coordinador"), async (req, res) => {
  try {
    const { name, grade, shift, capacity } = req.body;
    const [section] = await db.insert(sectionsTable).values({ name, grade, shift, capacity }).returning();
    res.status(201).json(section);
  } catch {
    res.status(500).json({ error: "Error al crear sección" });
  }
});

router.put("/:id", requireRole("administrador", "coordinador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, grade, shift, capacity } = req.body;
    const [section] = await db.update(sectionsTable).set({ name, grade, shift, capacity }).where(eq(sectionsTable.id, id)).returning();
    if (!section) {
      res.status(404).json({ error: "Sección no encontrada" });
      return;
    }
    res.json(section);
  } catch {
    res.status(500).json({ error: "Error al actualizar sección" });
  }
});

router.delete("/:id", requireRole("administrador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(sectionsTable).where(eq(sectionsTable.id, id));
    res.json({ message: "Sección eliminada" });
  } catch {
    res.status(500).json({ error: "Error al eliminar sección" });
  }
});

export default router;
