import { Router } from "express";
import { db } from "@workspace/db";
import { estudiantesSinMatriculaTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

// GET — listar todos
router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(estudiantesSinMatriculaTable)
      .orderBy(desc(estudiantesSinMatriculaTable.registradoEn));
    res.json(rows);
  } catch (err) {
    console.error("[sin-matricula] GET error:", err);
    res.status(500).json({ error: "Error al obtener registros" });
  }
});

// POST — crear (admin o QR público)
router.post("/", async (req, res) => {
  const { apellidosNombres, dni, codigo, carrera, registradoPor, registradoVia } = req.body;
  if (!apellidosNombres?.trim()) {
    return res.status(400).json({ error: "Apellidos y nombres es requerido" });
  }
  try {
    const [row] = await db
      .insert(estudiantesSinMatriculaTable)
      .values({
        apellidosNombres: apellidosNombres.trim().toUpperCase(),
        dni:              dni?.trim()              || null,
        codigo:           codigo?.trim().toUpperCase() || null,
        carrera:          carrera?.trim().toUpperCase() || null,
        registradoPor:    registradoPor?.trim()    || null,
        registradoVia:    registradoVia?.trim()    || "admin",
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[sin-matricula] POST error:", err);
    res.status(500).json({ error: "Error al guardar" });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  try {
    await db.delete(estudiantesSinMatriculaTable).where(eq(estudiantesSinMatriculaTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[sin-matricula] DELETE error:", err);
    res.status(500).json({ error: "Error al eliminar" });
  }
});

export default router;
