import { Router } from "express";
import { db } from "@workspace/db";
import { studentRegistrationsTable, ingresantesPagosTable, codigosVerificadosTable } from "@workspace/db/schema";
import { desc, eq, inArray, sql, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (req.currentUser?.role !== "administrador") {
    res.status(403).json({ error: "Acceso restringido al administrador" });
    return;
  }
  next();
}

// GET /api/students/lookup?dni=XXXXXXXX — public, looks up ingresantes_pagos by DNI
router.get("/lookup", async (req, res) => {
  try {
    const raw = String(req.query.dni || "").replace(/\D/g, "");
    const dni = raw.padStart(8, "0");
    if (raw.length < 7 || raw.length > 9) {
      res.status(400).json({ error: "DNI inválido" });
      return;
    }
    const rows = await db
      .select()
      .from(ingresantesPagosTable)
      .where(eq(ingresantesPagosTable.dni, dni))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ encontrado: false });
      return;
    }
    const r = rows[0];
    res.json({
      encontrado:       true,
      dni:              r.dni,
      apellidosNombres: r.apellidosNombres,
      codigoEstudiante: r.codigoEstudiante,
      carrera:          r.carrera,
      sede:             r.sede,
      modalidadIngreso: r.modalidadIngreso,
      modalidadEstudio: r.modalidadEstudio,
      turno:            r.turno,
      seccion:          r.seccion,
      celular:          r.celular,
      correo:           r.correo,
    });
  } catch (err) {
    console.error("Lookup error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/students/register — public, only requires DNI (auto-fills from ingresantes_pagos)
router.post("/register", async (req, res) => {
  try {
    const { dni } = req.body;
    const raw = dni ? String(dni).replace(/\D/g, "") : "";
    const dniClean = raw.padStart(8, "0");
    if (raw.length < 7 || raw.length > 9) {
      res.status(400).json({ error: "DNI inválido o faltante" });
      return;
    }

    // Check for duplicate registration
    const existing = await db
      .select({ id: studentRegistrationsTable.id })
      .from(studentRegistrationsTable)
      .where(eq(studentRegistrationsTable.dni, dniClean))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "DNI ya registrado" });
      return;
    }

    // Look up ingresantes_pagos for auto-fill
    let apellidos = "";
    let nombres = "";
    let carrera = "";
    const rows = await db
      .select()
      .from(ingresantesPagosTable)
      .where(eq(ingresantesPagosTable.dni, dniClean))
      .limit(1);

    if (rows.length > 0) {
      const r = rows[0];
      const partes = (r.apellidosNombres || "").split(" ");
      apellidos = partes.slice(0, 2).join(" ");
      nombres   = partes.slice(2).join(" ");
      carrera   = r.carrera || "";
    }

    const [record] = await db
      .insert(studentRegistrationsTable)
      .values({
        dni:             dniClean,
        apellidos:       apellidos,
        nombres:         nombres,
        telefono:        "",
        carrera:         carrera,
        ciclo:           "1",
        horarioAsignado: false,
      })
      .returning();
    res.json({ ok: true, id: record.id });
  } catch (err) {
    console.error("Student register error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/students/register — admin only, with ingresantes_pagos cross-reference
router.get("/register", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id:                 studentRegistrationsTable.id,
        dni:                studentRegistrationsTable.dni,
        apellidos:          studentRegistrationsTable.apellidos,
        nombres:            studentRegistrationsTable.nombres,
        telefono:           studentRegistrationsTable.telefono,
        carrera:            studentRegistrationsTable.carrera,
        ciclo:              studentRegistrationsTable.ciclo,
        horarioAsignado:    studentRegistrationsTable.horarioAsignado,
        createdAt:          studentRegistrationsTable.createdAt,
        _ingresanteDni:     ingresantesPagosTable.dni,
        apellidosNombres:   ingresantesPagosTable.apellidosNombres,
        codigoEstudiante:   ingresantesPagosTable.codigoEstudiante,
        carreraIngresante:  ingresantesPagosTable.carrera,
        modalidadEstudio:   ingresantesPagosTable.modalidadEstudio,
        turno:              ingresantesPagosTable.turno,
        seccion:            ingresantesPagosTable.seccion,
        sede:               ingresantesPagosTable.sede,
        celular:            ingresantesPagosTable.celular,
        correo:             ingresantesPagosTable.correo,
      })
      .from(studentRegistrationsTable)
      .leftJoin(
        ingresantesPagosTable,
        eq(studentRegistrationsTable.dni, ingresantesPagosTable.dni)
      )
      .orderBy(desc(studentRegistrationsTable.createdAt));

    const result = rows.map(({ _ingresanteDni, ...r }) => ({
      ...r,
      pagado: _ingresanteDni !== null,
    }));

    res.json(result);
  } catch (err) {
    console.error("Student list error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/students/register/:id/horario
router.patch("/register/:id/horario", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
    const { horarioAsignado } = req.body;
    if (typeof horarioAsignado !== "boolean") {
      res.status(400).json({ error: "horarioAsignado debe ser boolean" });
      return;
    }
    await db
      .update(studentRegistrationsTable)
      .set({ horarioAsignado })
      .where(eq(studentRegistrationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Horario update error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/students/register/:id
router.delete("/register/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
    await db.delete(studentRegistrationsTable).where(eq(studentRegistrationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/students/lookup-codes — auth required, cross-checks codes against ingresantes_pagos
router.post("/lookup-codes", requireAuth, async (req, res) => {
  try {
    const raw: unknown = req.body.codigos;
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: "Se requiere un arreglo de códigos" });
      return;
    }
    const rawCodigos: string[] = (raw as unknown[])
      .map((c: unknown) => String(c ?? "").trim().toUpperCase())
      .filter(s => s.length > 0)
      .slice(0, 2000);

    const totalInput = rawCodigos.length;
    // Deduplicate keeping order (first occurrence wins)
    const codigos = [...new Set(rawCodigos)];

    if (codigos.length === 0) {
      res.json({ found: [], notFound: [], totalInput: 0 });
      return;
    }

    // Use ANY with a raw text array to avoid drizzle nullable-column type issues
    const rows = await db
      .select()
      .from(ingresantesPagosTable)
      .where(sql`UPPER(${ingresantesPagosTable.codigoEstudiante}) = ANY(${sql.raw("ARRAY[" + codigos.map(c => `'${c.replace(/'/g, "''")}'`).join(",") + "]::text[]")})`);

    const foundCodes = new Set(rows.map(r => (r.codigoEstudiante ?? "").toUpperCase()));
    const notFound   = codigos.filter(c => !foundCodes.has(c));

    res.json({ found: rows, notFound, totalInput });
  } catch (err) {
    console.error("Lookup-codes error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ── Códigos Verificados (persistentes) ────────────────────────────────────────

// GET /api/students/codigos-verificados — returns all saved verification rows
router.get("/codigos-verificados", requireAuth, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(codigosVerificadosTable)
      .orderBy(asc(codigosVerificadosTable.id));
    res.json(rows);
  } catch (err) {
    console.error("Codigos-verificados get error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/students/codigos-verificados/merge — upserts found + not-found rows
router.post("/codigos-verificados/merge", requireAuth, async (req, res) => {
  try {
    const { found, notFound } = req.body as {
      found: Array<{
        codigoEstudiante?: string | null;
        apellidosNombres?: string | null;
        dni?: string | null;
        carrera?: string | null;
        sede?: string | null;
        modalidadEstudio?: string | null;
        turno?: string | null;
        seccion?: string | null;
        celular?: string | null;
      }>;
      notFound: string[];
    };

    const toUpsert: typeof codigosVerificadosTable.$inferInsert[] = [];

    for (const r of (found ?? [])) {
      if (!r.codigoEstudiante) continue;
      toUpsert.push({
        codigoEstudiante: r.codigoEstudiante.toUpperCase(),
        apellidosNombres: r.apellidosNombres ?? null,
        dni:              r.dni ?? null,
        carrera:          r.carrera ?? null,
        sede:             r.sede ?? null,
        modalidadEstudio: r.modalidadEstudio ?? null,
        turno:            r.turno ?? null,
        seccion:          r.seccion ?? null,
        celular:          r.celular ?? null,
        encontrado:       true,
      });
    }

    for (const code of (notFound ?? [])) {
      if (!code) continue;
      toUpsert.push({
        codigoEstudiante: code.toUpperCase(),
        encontrado:       false,
      });
    }

    // Deduplicate by codigoEstudiante — found rows take priority over notFound
    // (found rows were pushed first, so we iterate in order and last write wins;
    //  reverse so found rows overwrite notFound entries for the same code)
    const seen = new Map<string, typeof codigosVerificadosTable.$inferInsert>();
    for (const row of toUpsert) {
      const key = row.codigoEstudiante!;
      if (!seen.has(key) || row.encontrado) {
        seen.set(key, row);
      }
    }
    const uniqueToUpsert = Array.from(seen.values());

    if (uniqueToUpsert.length > 0) {
      await db
        .insert(codigosVerificadosTable)
        .values(uniqueToUpsert)
        .onConflictDoUpdate({
          target: codigosVerificadosTable.codigoEstudiante,
          set: {
            apellidosNombres: sql`EXCLUDED.apellidos_nombres`,
            dni:              sql`EXCLUDED.dni`,
            carrera:          sql`EXCLUDED.carrera`,
            sede:             sql`EXCLUDED.sede`,
            modalidadEstudio: sql`EXCLUDED.modalidad_estudio`,
            turno:            sql`EXCLUDED.turno`,
            seccion:          sql`EXCLUDED.seccion`,
            celular:          sql`EXCLUDED.celular`,
            encontrado:       sql`EXCLUDED.encontrado`,
            verificadoEn:     sql`now()`,
          },
        });
    }

    const all = await db
      .select()
      .from(codigosVerificadosTable)
      .orderBy(asc(codigosVerificadosTable.id));
    res.json(all);
  } catch (err) {
    console.error("Codigos-verificados merge error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /api/students/codigos-verificados/:id/horario — toggle tieneHorario
router.patch("/codigos-verificados/:id/horario", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
    const { tieneHorario } = req.body;
    if (typeof tieneHorario !== "boolean") {
      res.status(400).json({ error: "tieneHorario debe ser boolean" });
      return;
    }
    await db
      .update(codigosVerificadosTable)
      .set({ tieneHorario })
      .where(eq(codigosVerificadosTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Codigos-verificados horario error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/students/codigos-verificados/all — clears all rows
router.delete("/codigos-verificados/all", requireAuth, async (_req, res) => {
  try {
    await db.delete(codigosVerificadosTable);
    res.json({ ok: true });
  } catch (err) {
    console.error("Codigos-verificados delete-all error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/students/codigos-verificados/:id — deletes one row
router.delete("/codigos-verificados/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
    await db.delete(codigosVerificadosTable).where(eq(codigosVerificadosTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Codigos-verificados delete error:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
