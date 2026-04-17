import { Router } from "express";
import { db } from "@workspace/db";
import { delegadosTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";

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
  const nombreNorm = apellidosNombres.trim().replace(/\s+/g, " ").toUpperCase();
  const correoNorm = correo?.trim().toLowerCase() || null;
  try {
    // Verificar duplicados por nombre o correo
    const existentes = await db
      .select()
      .from(delegadosTable)
      .where(
        correoNorm
          ? sql`UPPER(REGEXP_REPLACE(TRIM(${delegadosTable.apellidosNombres}), '\\s+', ' ', 'g')) = ${nombreNorm} OR LOWER(${delegadosTable.correo}) = ${correoNorm}`
          : sql`UPPER(REGEXP_REPLACE(TRIM(${delegadosTable.apellidosNombres}), '\\s+', ' ', 'g')) = ${nombreNorm}`
      );

    if (existentes.length > 0) {
      const e = existentes[0];
      const matchPorCorreo = correoNorm && e.correo?.toLowerCase() === correoNorm;
      const motivo = matchPorCorreo
        ? `Este correo ya fue registrado como ${e.tipo} en ${e.carrera} – Ciclo ${e.ciclo} – Sección ${e.seccion} (${e.apellidosNombres}).`
        : `${e.apellidosNombres} ya fue registrado/a como ${e.tipo} en ${e.carrera} – Ciclo ${e.ciclo} – Sección ${e.seccion}.`;
      return res.status(409).json({ error: motivo });
    }

    const [row] = await db
      .insert(delegadosTable)
      .values({
        tipo:             tipoVal,
        apellidosNombres: nombreNorm,
        carrera:          carrera.trim().toUpperCase(),
        ciclo:            ciclo.trim(),
        seccion:          seccion.trim().toUpperCase(),
        numero:           numero?.trim() || null,
        correo:           correoNorm,
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
