import { Router } from "express";
import { db } from "@workspace/db";
import { asistenciaPlanillasTable, docentesExternosTable } from "@workspace/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { Agent, fetch as undiciFetch } from "undici";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const router = Router();
const tlsAgent = new Agent({ connect: { rejectUnauthorized: false } });
const BASE_URL = "https://intranet.autonomadeica.edu.pe";
const DEFAULT_TERM = "08de1730-801b-4d3d-81a8-e840d74c49fa";

/* ─── Set de combinaciones válidas según planificación 2026-1 ─── */
function buildPlanningSet(): Set<string> {
  const set = new Set<string>();
  // Busca desde process.cwd() (raíz del workspace) — funciona tanto en dev (tsx) como en prod (CJS bundle)
  const candidates = [
    path.resolve(process.cwd(), "artifacts/school-portal/public"),
    // fallback: ruta relativa al archivo actual (solo dev)
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../school-portal/public"),
  ];
  const publicDir = candidates.find(d => fs.existsSync(path.join(d, "planificacion-fica-2026-1.json"))) ?? candidates[0];
  const files = [
    "planificacion-fica-2026-1.json",
    "planificacion-fcs-2026-1.json",
  ];
  for (const f of files) {
    const fpath = path.join(publicDir, f);
    if (!fs.existsSync(fpath)) { console.warn(`[sync] Planning file not found: ${fpath}`); continue; }
    try {
      const rows: Array<{ docente?: string; codigo?: string; seccion?: string }> = JSON.parse(fs.readFileSync(fpath, "utf-8"));
      for (const r of rows) {
        if (!r.docente || !r.codigo || !r.seccion) continue;
        const key = [
          r.docente.trim().toUpperCase(),
          r.codigo.trim().toUpperCase(),
          r.seccion.trim().toUpperCase().replace(/[PV]$/, ""),
        ].join("|");
        set.add(key);
      }
    } catch (e) { console.error(`[sync] Error loading ${f}:`, e); }
  }
  console.log(`[sync] Planning set cargado: ${set.size} combos válidos`);
  return set;
}

function getIntranetHeaders(cookie: string, referer?: string) {
  return {
    Cookie: cookie,
    Accept: "application/json, */*",
    "User-Agent": "Mozilla/5.0",
    Referer: referer || `${BASE_URL}/`,
  };
}

/* ─── Parser del Excel de Asistencia (portado del frontend) ─── */
type PlanillaWeek = { label: string; fecha: string; dia: string; slots?: 1 | 2 };
type PlanillaAlumno = { numero: string; nombre: string; marcas: string[]; porcentaje: number };
type PlanillaTotales = { asistencias: number[]; inasistencias: number[] };
type ParsedXlsx = {
  encabezadoCrudo: string;
  weeks: PlanillaWeek[];
  alumnos: PlanillaAlumno[];
  totales: PlanillaTotales;
};

function parseAttendanceXlsx(buf: Buffer): ParsedXlsx {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as string[][];

  const cell = (r: number, c: number) => String(aoa[r]?.[c] ?? "").trim();

  const encabezadoCrudo = cell(4, 0);

  let headerRow = -1;
  for (let r = 0; r < Math.min(aoa.length, 14); r++) {
    const v0 = cell(r, 0).toLowerCase();
    const v1 = cell(r, 1).toLowerCase();
    const looksLikeNumeroHdr = v0.length <= 8 && (
      v0 === "n°" || v0 === "nº" || v0 === "nª" || v0 === "no" || v0 === "n" ||
      v0.startsWith("n°") || v0.startsWith("nº") || v0.startsWith("nª") ||
      v0 === "#" || v0 === "num" || v0 === "número" || v0 === "numero"
    );
    if (looksLikeNumeroHdr && v1.includes("apellidos")) { headerRow = r; break; }
    if (!v0 && v1.includes("apellidos") && v1.includes("nombres")) { headerRow = r; break; }
  }
  if (headerRow === -1) headerRow = 6;

  const scanRows = [headerRow, headerRow + 1, headerRow + 2];
  let lastCol = 0;
  for (const rr of scanRows) lastCol = Math.max(lastCol, (aoa[rr] || []).length - 1);
  const lastHeader = cell(headerRow, lastCol).toLowerCase();
  const hasPctCol = lastHeader.includes("%") || lastHeader.includes("asist");
  const dataLastCol = hasPctCol ? lastCol : lastCol + 1;

  type WeekDef = { label: string; fecha: string; dia: string; cols: number[] };
  const weekDefs: WeekDef[] = [];
  for (let c = 2; c < dataLastCol; c++) {
    const label = cell(headerRow, c);
    const fecha = cell(headerRow + 1, c);
    const dia = cell(headerRow + 2, c);
    if (!fecha && !label) continue;
    const last = weekDefs[weekDefs.length - 1];
    if (last && fecha && last.fecha === fecha && last.cols.length < 2) {
      last.cols.push(c);
    } else {
      weekDefs.push({ label: label || `Semana ${weekDefs.length + 1}`, fecha, dia: (dia || "").trim(), cols: [c] });
    }
  }

  const weeks: PlanillaWeek[] = weekDefs.map((w) => ({
    label: w.label, fecha: w.fecha, dia: w.dia,
    slots: (w.cols.length === 2 ? 2 : 1),
  }));

  const startRow = headerRow + 3;
  const alumnos: PlanillaAlumno[] = [];

  const buildMarcas = (r: number): string[] => {
    const out: string[] = [];
    for (const w of weekDefs) {
      const v1 = w.cols[0] !== undefined ? cell(r, w.cols[0]) : "";
      const v2 = w.cols[1] !== undefined ? cell(r, w.cols[1]) : "";
      out.push(v1, v2);
    }
    return out;
  };

  for (let r = startRow; r < aoa.length; r++) {
    const numero = cell(r, 0);
    const nombre = cell(r, 1);
    const c0 = cell(r, 0).toLowerCase();
    const c1 = cell(r, 1).toLowerCase();
    if (c1.includes("asistencia") && !nombre.includes(",") && !c0) continue;
    if (c1.includes("inasistencia") && !c0) continue;
    if (!nombre || !numero) continue;
    const marcas = buildMarcas(r);
    const porcStr = hasPctCol ? cell(r, lastCol) : "";
    const porcentaje = Number(porcStr.replace(",", ".")) || 0;
    alumnos.push({ numero, nombre, marcas, porcentaje });
  }

  const cols = weeks.length * 2;
  const asistencias = new Array(cols).fill(0);
  const inasistencias = new Array(cols).fill(0);
  const newAlumnos = alumnos.map((a) => {
    let asis = 0, inasis = 0;
    for (let i = 0; i < cols; i++) {
      const m = (a.marcas[i] || "").toUpperCase();
      if (m === "A") { asistencias[i]++; asis++; }
      else if (m === "F") { inasistencias[i]++; inasis++; }
    }
    const total = asis + inasis;
    const p = total > 0 ? Math.round((asis / total) * 10000) / 100 : 0;
    return { ...a, porcentaje: p };
  });

  return { encabezadoCrudo, weeks, alumnos: newAlumnos, totales: { asistencias, inasistencias } };
}

/* ─── Parsear encabezadoCrudo ─── */
function parseEncabezado(enc: string) {
  // Format: "P06-20261-P06A1103 MÉTODOS DE ESTUDIO UNIVERSITARIO - BP - CH"
  const codeMatch = enc.match(/\b([A-Z]\d{2}[A-Z]\d{4})\b/);
  const codigoCurso = codeMatch ? codeMatch[1] : null;
  const afterCode = codeMatch
    ? enc.slice(enc.indexOf(codeMatch[0]) + codeMatch[0].length).trim()
    : enc;
  const parts = afterCode.split(" - ").map((s) => s.trim()).filter(Boolean);
  const nombreCurso = parts[0] || null;
  const seccion = parts[1] || null;
  const localAbrev = parts[2] || null;
  return { codigoCurso, nombreCurso, seccion, localAbrev };
}

/* ─── Fetch con error handling ─── */
async function intranetGet(url: string, cookie: string): Promise<any> {
  const res = await undiciFetch(url, {
    dispatcher: tlsAgent,
    headers: getIntranetHeaders(cookie, `${BASE_URL}/admin/`),
  });
  if (res.status === 401 || res.status === 403) throw new Error("AUTH_EXPIRED");
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return await res.json();
}

async function downloadExcel(sectionId: string, cookie: string): Promise<Buffer> {
  const url = `${BASE_URL}/admin/reporte-docentes/seccion/${sectionId}/control-asistencia-excel`;
  const res = await undiciFetch(url, {
    dispatcher: tlsAgent,
    headers: { ...getIntranetHeaders(cookie), Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
  if (res.status === 401 || res.status === 403) throw new Error("AUTH_EXPIRED");
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  // Si la cookie expiró la intranet devuelve HTML (página de login) con status 200
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) throw new Error("AUTH_EXPIRED");
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/* Normaliza sección del intranet: quita trailing P o V (código de modalidad).
   "AP"→"A", "DV"→"D", "AHP"→"AH", "AHV"→"AH", "BHP"→"BH"
   H en el medio es parte del nombre de sección (híbrido), NO se elimina. */
function stripModalidad(s: string): string {
  return s.replace(/[PV]$/, "");
}

/* ─── Upsert planilla in DB ─── */
async function upsertPlanilla(data: {
  docente: string;
  codigoCurso: string | null;
  nombreCurso: string | null;
  seccion: string | null;
  encabezadoCrudo: string;
  weeks: PlanillaWeek[];
  alumnos: PlanillaAlumno[];
  totales: PlanillaTotales;
}): Promise<"created" | "updated"> {
  if (!data.docente || !data.codigoCurso || !data.seccion) {
    throw new Error("Faltan campos requeridos");
  }

  const docenteKey = data.docente.toUpperCase().trim();
  const codigoKey  = data.codigoCurso.trim();
  // Normaliza sección antes de guardar: "AP"→"A", "AHP"→"AH"
  const seccionKey = stripModalidad(data.seccion.trim());

  const existing = await db
    .select({ id: asistenciaPlanillasTable.id })
    .from(asistenciaPlanillasTable)
    .where(
      and(
        eq(asistenciaPlanillasTable.docente, docenteKey),
        eq(asistenciaPlanillasTable.codigoCurso, codigoKey),
        eq(asistenciaPlanillasTable.seccion, seccionKey),
      )
    )
    .limit(1);

  const payload = {
    encabezadoCrudo: data.encabezadoCrudo,
    weeks: data.weeks as any,
    alumnos: data.alumnos as any,
    totales: data.totales as any,
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    await db
      .update(asistenciaPlanillasTable)
      .set(payload)
      .where(eq(asistenciaPlanillasTable.id, existing[0].id));
    return "updated";
  } else {
    await db.insert(asistenciaPlanillasTable).values({
      docente: data.docente.toUpperCase().trim(),
      codigoCurso: data.codigoCurso.trim(),
      nombreCurso: data.nombreCurso || null,
      seccion: data.seccion.trim(),
      carrera: null,
      ciclo: null,
      turno: null,
      sede: null,
      modalidad: null,
      dia: null,
      ...payload,
    });
    return "created";
  }
}

/* ─── Sync one teacher ─── */
async function syncTeacher(
  teacher: { id: string; name: string; username: string },
  cookie: string,
  termId: string,
  planningSet: Set<string>,
  onProgress?: (msg: string) => void,
): Promise<{ created: number; updated: number; failed: number; skipped: number; sections: number }> {
  const log = (msg: string) => onProgress?.(msg);
  let created = 0, updated = 0, failed = 0, skipped = 0, sections = 0;

  log(`Obteniendo cursos de ${teacher.name}...`);
  const courses: Array<{ id: string; text: string }> = await intranetGet(
    `${BASE_URL}/cursos/docente/${teacher.id}?termId=${termId}`,
    cookie,
  );

  for (const course of courses) {
    // Extract codigoCurso from course text: "P38-20261-P38A1104-FILOSOFÍA Y ÉTICA"
    // Regex: one uppercase letter + 2 digits + one uppercase letter + 4 digits (e.g. P38A1104)
    const courseCodeMatch = course.text.match(/\b([A-Z]\d{2}[A-Z]\d{4})\b/);
    // Fallback: split by "-" and take the element that looks like a course code
    const courseCode = courseCodeMatch
      ? courseCodeMatch[1]
      : (course.text.split("-").find((p) => /^[A-Z]\d{2}[A-Z]\d{4}$/.test(p.trim())) ?? null);

    const secciones: Array<{ id: string; text: string }> = await intranetGet(
      `${BASE_URL}/secciones-por-curso/${course.id}/docente/${teacher.id}?termId=${termId}`,
      cookie,
    );

    for (const seccion of secciones) {
      sections++;
      try {
        log(`  ↳ ${courseCode || course.text} · ${seccion.text}`);
        const excelBuf = await downloadExcel(seccion.id, cookie);
        const parsed = parseAttendanceXlsx(excelBuf);
        const enc = parseEncabezado(parsed.encabezadoCrudo);

        // Resolver codigoCurso: Excel header → intranet course text → cualquier código en course.text
        const resolvedCodigo = enc.codigoCurso
          || courseCode
          || (course.text.split(/[-\s]/).find((p) => /^[A-Z]\d+[A-Z]\d+$/.test(p)) ?? null);

        // Resolver seccion: Excel header → primera parte de seccion.text ("AP - CH" → "AP")
        const resolvedSeccion = enc.seccion
          || seccion.text.split(" - ")[0]?.trim()
          || seccion.text;

        if (!resolvedCodigo) {
          console.error(
            `[sync-asistencias] No se pudo extraer codigoCurso para sección ${seccion.text}. ` +
            `course.text="${course.text}" encabezadoCrudo="${parsed.encabezadoCrudo}"`
          );
          log(`  ✗ ${seccion.text}: No se pudo determinar el código de curso`);
          failed++;
          continue;
        }

        // ── Validar contra planificación: solo guardar si el combo existe ──
        const normSecPlan = resolvedSeccion.trim().toUpperCase().replace(/[PV]$/, "");
        const planKey = [
          teacher.name.trim().toUpperCase(),
          resolvedCodigo.trim().toUpperCase(),
          normSecPlan,
        ].join("|");
        if (!planningSet.has(planKey)) {
          log(`  ⊘ ${resolvedCodigo} · ${resolvedSeccion} — no está en la planificación, omitido`);
          skipped++;
          continue;
        }

        const result = await upsertPlanilla({
          docente: teacher.name,
          codigoCurso: resolvedCodigo,
          nombreCurso: enc.nombreCurso,
          seccion: resolvedSeccion,
          encabezadoCrudo: parsed.encabezadoCrudo,
          weeks: parsed.weeks,
          alumnos: parsed.alumnos,
          totales: parsed.totales,
        });

        if (result === "created") created++;
        else updated++;
      } catch (err: any) {
        console.error(
          `[sync-asistencias] Error in section ${seccion.id} (${seccion.text}):`,
          err.message,
        );
        log(`  ✗ ${seccion.text}: ${err.message}`);
        failed++;
      }
    }
  }

  return { created, updated, failed, skipped, sections };
}

/* ─── POST /api/sincronizar-asistencias ─── */
router.post(
  "/",
  requireAuth,
  requireRole("administrador", "coordinador"),
  async (req: any, res) => {
    const cookie: string =
      req.body?.cookie || process.env.INTRANET_COOKIE || "";
    const termId: string = req.body?.termId || DEFAULT_TERM;
    const docenteName: string | undefined = req.body?.docenteName;

    if (!cookie) {
      return res.status(400).json({
        error: "COOKIE_REQUERIDA",
        message: "La cookie de la intranet no está configurada.",
      });
    }

    // If SSE mode is requested, stream progress
    const useSSE = req.headers.accept?.includes("text/event-stream") || req.body?.sse;
    if (useSSE) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const send = (event: string, data: object) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        let teachers: Array<{ id: string; name: string; username: string }> = [];

        if (docenteName) {
          // Look up teacher in docentes_externos
          const rows = await db
            .select()
            .from(docentesExternosTable)
            .where(sql`upper(trim(${docentesExternosTable.name})) = upper(trim(${docenteName}))`)
            .limit(1);

          if (rows.length === 0 || !(rows[0].rawData as any)?.id) {
            send("error", { message: "Docente no encontrado en la intranet. Sincroniza docentes primero." });
            res.write("event: done\ndata: {}\n\n");
            res.end();
            return;
          }
          const raw = rows[0].rawData as any;
          teachers = [{ id: raw.id, name: rows[0].name, username: rows[0].username }];
        } else {
          // Fetch all from intranet teacher list
          const raw: any = await intranetGet(
            `${BASE_URL}/admin/reporte-docentes/get?draw=1&start=0&length=1000&termId=${termId}&_=${Date.now()}`,
            cookie,
          );
          teachers = (raw.data || []).map((d: any) => ({ id: d.id, name: d.name?.toUpperCase().trim(), username: d.username }));
        }

        const planningSet = buildPlanningSet();
        send("start", { total: teachers.length });

        let totalCreated = 0, totalUpdated = 0, totalFailed = 0, totalSkipped = 0;

        for (let i = 0; i < teachers.length; i++) {
          const t = teachers[i];
          send("teacher", { index: i + 1, total: teachers.length, name: t.name });

          try {
            const r = await syncTeacher(t, cookie, termId, planningSet, (msg) => {
              send("progress", { message: msg });
            });
            totalCreated += r.created;
            totalUpdated += r.updated;
            totalFailed += r.failed;
            totalSkipped += r.skipped;
            send("teacher_done", { name: t.name, ...r });
          } catch (err: any) {
            if (err.message === "AUTH_EXPIRED") {
              send("error", { message: "Cookie expirada. Renueva la sesión de la intranet." });
              break;
            }
            send("teacher_error", { name: t.name, error: err.message });
            totalFailed++;
          }
        }

        send("done", { created: totalCreated, updated: totalUpdated, failed: totalFailed, skipped: totalSkipped });
        res.write("event: done\ndata: {}\n\n");
        res.end();
      } catch (err: any) {
        send("error", { message: err.message || "Error interno" });
        res.end();
      }
      return;
    }

    // Non-SSE: synchronous response (per teacher only)
    try {
      if (!docenteName) {
        return res.status(400).json({ error: "DOCENTE_REQUERIDO", message: "Proporciona docenteName para sync individual." });
      }

      const rows = await db
        .select()
        .from(docentesExternosTable)
        .where(sql`upper(trim(${docentesExternosTable.name})) = upper(trim(${docenteName}))`)
        .limit(1);

      if (rows.length === 0 || !(rows[0].rawData as any)?.id) {
        return res.status(404).json({
          error: "DOCENTE_NO_ENCONTRADO",
          message: "Docente no encontrado en la intranet. Sincroniza docentes primero.",
        });
      }

      const raw = rows[0].rawData as any;
      const teacher = { id: raw.id, name: rows[0].name, username: rows[0].username };

      const planningSet = buildPlanningSet();
      const result = await syncTeacher(teacher, cookie, termId, planningSet);
      res.json({ ok: true, docente: teacher.name, ...result });
    } catch (err: any) {
      console.error("[sincronizar-asistencias] error:", err);
      if (err.message === "AUTH_EXPIRED") {
        return res.status(401).json({ error: "AUTH_EXPIRED", message: "Cookie expirada. Renueva la sesión de la intranet." });
      }
      res.status(500).json({ error: "SYNC_ERROR", message: err.message || "Error al sincronizar" });
    }
  },
);

export default router;
