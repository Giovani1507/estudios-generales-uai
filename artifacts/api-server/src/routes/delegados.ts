import { Router } from "express";
import { db } from "@workspace/db";
import { delegadosTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(delegadosTable)
      .orderBy(desc(delegadosTable.registradoEn));
    res.json(rows);
  } catch (err) {
    console.error("[delegados] GET error:", err);
    res.status(500).json({ error: "Error al obtener delegados" });
  }
});

router.post("/", async (req, res) => {
  const { tipo, apellidosNombres, carrera, ciclo, seccion, numero, correo } = req.body;
  if (!apellidosNombres?.trim()) return res.status(400).json({ error: "Apellidos y nombres es requerido" });
  if (!carrera?.trim())          return res.status(400).json({ error: "Carrera es requerida" });
  if (!ciclo?.trim())            return res.status(400).json({ error: "Ciclo es requerido" });
  if (!seccion?.trim())          return res.status(400).json({ error: "Sección es requerida" });
  const tipoVal = tipo === "SUB DELEGADO" ? "SUB DELEGADO" : "DELEGADO";
  try {
    const [row] = await db
      .insert(delegadosTable)
      .values({
        tipo:             tipoVal,
        apellidosNombres: apellidosNombres.trim().toUpperCase(),
        carrera:          carrera.trim().toUpperCase(),
        ciclo:            ciclo.trim(),
        seccion:          seccion.trim().toUpperCase(),
        numero:           numero?.trim() || null,
        correo:           correo?.trim().toLowerCase() || null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[delegados] POST error:", err);
    res.status(500).json({ error: "Error al guardar" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  try {
    await db.delete(delegadosTable).where(eq(delegadosTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[delegados] DELETE error:", err);
    res.status(500).json({ error: "Error al eliminar" });
  }
});

export default router;
