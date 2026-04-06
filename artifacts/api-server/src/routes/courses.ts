import { Router } from "express";
import { db } from "@workspace/db";
import { coursesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  try {
    const courses = await db.select().from(coursesTable);
    res.json(courses);
  } catch {
    res.status(500).json({ error: "Error al obtener cursos" });
  }
});

router.post("/", requireRole("administrador"), async (req, res) => {
  try {
    const { name, code, description, credits } = req.body;
    const [course] = await db.insert(coursesTable).values({ name, code, description, credits }).returning();
    res.status(201).json(course);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(400).json({ error: "Código de curso ya existe" });
    } else {
      res.status(500).json({ error: "Error al crear curso" });
    }
  }
});

router.put("/:id", requireRole("administrador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, code, description, credits } = req.body;
    const [course] = await db.update(coursesTable).set({ name, code, description, credits }).where(eq(coursesTable.id, id)).returning();
    if (!course) {
      res.status(404).json({ error: "Curso no encontrado" });
      return;
    }
    res.json(course);
  } catch {
    res.status(500).json({ error: "Error al actualizar curso" });
  }
});

router.delete("/:id", requireRole("administrador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(coursesTable).where(eq(coursesTable.id, id));
    res.json({ message: "Curso eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar curso" });
  }
});

export default router;
