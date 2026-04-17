import { Router } from "express";
import { db } from "@workspace/db";
import { studentProblemsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

const PROBLEM_TYPES = [
  "plataforma",
  "cursos_no_aparecen",
  "no_aparece_lista_docente",
  "aula_virtual",
  "otros",
] as const;

type ProblemType = (typeof PROBLEM_TYPES)[number];

router.post("/", async (req, res) => {
  try {
    const {
      apellidosNombres,
      carrera,
      ciclo,
      seccion,
      problema,
      descripcion,
    } = req.body ?? {};

    if (
      typeof apellidosNombres !== "string" ||
      !apellidosNombres.trim() ||
      typeof carrera !== "string" ||
      !carrera.trim() ||
      typeof ciclo !== "string" ||
      !["1", "2"].includes(ciclo) ||
      typeof seccion !== "string" ||
      !seccion.trim() ||
      typeof problema !== "string" ||
      !PROBLEM_TYPES.includes(problema as ProblemType)
    ) {
      res.status(400).json({ error: "Datos incompletos o inválidos" });
      return;
    }

    if (problema === "otros" && (typeof descripcion !== "string" || !descripcion.trim())) {
      res.status(400).json({ error: "Describe tu problema" });
      return;
    }

    // Defense-in-depth: strip leading characters that could be interpreted as
    // formulas if the data is later opened in spreadsheet software.
    const sanitize = (s: string) => s.replace(/^[=+\-@\t\r]+/, "").slice(0, 500);

    const [row] = await db
      .insert(studentProblemsTable)
      .values({
        apellidosNombres: sanitize(apellidosNombres.trim()),
        carrera: sanitize(carrera.trim()),
        ciclo,
        seccion: sanitize(seccion.trim().toUpperCase()).slice(0, 5),
        problema: problema as ProblemType,
        descripcion: descripcion ? sanitize(descripcion.trim()).slice(0, 2000) : null,
      })
      .returning();

    res.status(201).json({ id: row.id, createdAt: row.createdAt.toISOString() });
  } catch (err) {
    console.error("[student-problems] error al registrar:", err);
    res.status(500).json({ error: "Error al registrar el reporte" });
  }
});

router.get("/", requireAuth, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(studentProblemsTable)
      .orderBy(desc(studentProblemsTable.createdAt));
    res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Error al obtener reportes" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    await db.delete(studentProblemsTable).where(eq(studentProblemsTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al eliminar" });
  }
});

export default router;
