import { Router } from "express";
import { db } from "@workspace/db";
import { teachersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  try {
    const teachers = await db.select().from(teachersTable);
    res.json(teachers);
  } catch {
    res.status(500).json({ error: "Error al obtener docentes" });
  }
});

router.post("/", requireRole("administrador", "coordinador"), async (req, res) => {
  try {
    const { fullName, email, specialty, phone } = req.body;
    const [teacher] = await db.insert(teachersTable).values({ fullName, email, specialty, phone }).returning();
    res.status(201).json(teacher);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(400).json({ error: "Email ya existe" });
    } else {
      res.status(500).json({ error: "Error al crear docente" });
    }
  }
});

router.put("/:id", requireRole("administrador", "coordinador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fullName, email, specialty, phone } = req.body;
    const [teacher] = await db.update(teachersTable).set({ fullName, email, specialty, phone }).where(eq(teachersTable.id, id)).returning();
    if (!teacher) {
      res.status(404).json({ error: "Docente no encontrado" });
      return;
    }
    res.json(teacher);
  } catch {
    res.status(500).json({ error: "Error al actualizar docente" });
  }
});

router.delete("/:id", requireRole("administrador"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(teachersTable).where(eq(teachersTable.id, id));
    res.json({ message: "Docente eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar docente" });
  }
});

export default router;
