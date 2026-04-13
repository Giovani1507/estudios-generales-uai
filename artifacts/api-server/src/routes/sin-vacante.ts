import { Router } from "express";
import { db } from "@workspace/db";
import { estudiantesSinVacanteTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(estudiantesSinVacanteTable)
      .orderBy(desc(estudiantesSinVacanteTable.registradoEn));
    res.json(rows);
  } catch (err) {
    console.error("[sin-vacante] GET error:", err);
    res.status(500).json({ error: "Error al obtener registros" });
  }
});

router.post("/", async (req, res) => {
  const { codigo, apellidosNombres, carrera, turno, seccion, lugar, registradoPor } = req.body;
  try {
    const [row] = await db
      .insert(estudiantesSinVacanteTable)
      .values({
        codigo:           codigo?.trim().toUpperCase()           || null,
        apellidosNombres: apellidosNombres?.trim().toUpperCase() || null,
        carrera:          carrera?.trim().toUpperCase()          || null,
        turno:            turno?.trim()                          || null,
        seccion:          seccion?.trim().toUpperCase()          || null,
        lugar:            lugar?.trim()                          || null,
        registradoPor:    registradoPor?.trim()                  || null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[sin-vacante] POST error:", err);
    res.status(500).json({ error: "Error al guardar" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  try {
    await db.delete(estudiantesSinVacanteTable).where(eq(estudiantesSinVacanteTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[sin-vacante] DELETE error:", err);
    res.status(500).json({ error: "Error al eliminar" });
  }
});

export default router;
