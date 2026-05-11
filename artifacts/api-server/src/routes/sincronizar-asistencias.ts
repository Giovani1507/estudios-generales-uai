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
import planificacionFica from "../data/planificacion-fica-2026-1.json" assert { type: "json" };
import planificacionFcs from "../data/planificacion-fcs-2026-1.json" assert { type: "json" };

const router = Router();
const tlsAgent = new Agent({ connect: { rejectUnauthorized: false } });
const BASE_URL = "https://intranet.autonomadeica.edu.pe";
const DEFAULT_TERM = "08de1730-801b-4d3d-81a8-e840d74c49fa";

/* ─── Cookie caché en memoria ─── */
let cachedCookie: string = process.env.INTRANET_COOKIE || "";

export function getActiveCookie(): string { return cachedCookie; }
export function setActiveCookie(c: string) { cachedCookie = c; }

/* Combina mapas de cookies (las nuevas sobreescriben las viejas por nombre) */
function mergeCookies(base: string, extra: string[]): string {
  const map = new Map<string, string>();
  for (const part of base.split(";").map(s => s.trim()).filter(Boolean)) {
    const [k, ...v] = part.split("=");
    if (k) map.set(k.trim(), v.join("="));
  }
  for (const raw of extra) {
    const kv = raw.split(";")[0].trim();
    const [k, ...v] = kv.split("=");
    if (k) map.set(k.trim(), v.join("="));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/* Sigue redirects manualmente acumulando cookies en cada salto */
async function fetchFollowingCookies(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string },
  cookieJar: string,
  maxRedirects = 8,
): Promise<{ res: Awaited<ReturnType<typeof undiciFetch>>; cookieJar: string; html: string }> {
  let currentUrl = url;
  let res!: Awaited<ReturnType<typeof undiciFetch>>;
  let html = "";
  for (let i = 0; i < maxRedirects; i++) {
    res = await undiciFetch(currentUrl, {
      dispatcher: tlsAgent,
      method: options.method ?? "GET",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html,application/xhtml+xml", Cookie: cookieJar, ...options.headers },
      body: options.body,
      redirect: "manual",
    });
    const newCookies = (res.headers as any).getSetCookie?.() ?? [];
    if (newCookies.length) cookieJar = mergeCookies(cookieJar, newCookies);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location") ?? "";
      currentUrl = loc.startsWith("http") ? loc : `${BASE_URL}${loc}`;
      // Siguiente salto siempre GET (como haría un browser)
      options = {};
    } else {
      html = await res.text();
      break;
    }
  }
  return { res, cookieJar, html };
}

/* ─── Auto-login a la intranet (flujo OIDC completo vía Campus Virtual) ─── */
export async function loginToIntranet(): Promise<string> {
  const username = process.env.INTRANET_USERNAME;
  const password = process.env.INTRANET_PASSWORD;
  if (!username || !password) throw new Error("INTRANET_USERNAME / INTRANET_PASSWORD no configurados.");

  const CV_BASE = "https://campusvirtual.autonomadeica.edu.pe";

  // 1. GET intranet raíz → redirige al Campus Virtual (OIDC authorize)
  //    Acumulamos cookies de intranet y campus virtual por separado
  let intranetJar = "";
  let cvJar = "";

  // Seguir redirects manualmente para separar cookies por dominio
  let url = `${BASE_URL}/`;
  let authorizeUrl = "";
  for (let i = 0; i < 5; i++) {
    const res = await undiciFetch(url, {
      dispatcher: tlsAgent,
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html", Cookie: url.includes("campusvirtual") ? cvJar : intranetJar },
      redirect: "manual",
    });
    const cookies = (res.headers as any).getSetCookie?.() ?? [];
    if (url.includes("campusvirtual")) cvJar = mergeCookies(cvJar, cookies);
    else intranetJar = mergeCookies(intranetJar, cookies);

    const loc = res.headers.get("location") ?? "";
    if (!loc) { break; }
    url = loc.startsWith("http") ? loc : (url.includes("campusvirtual") ? `${CV_BASE}${loc}` : `${BASE_URL}${loc}`);
    if (url.includes("/connect/authorize")) { authorizeUrl = url; }
  }
  console.log(`[sync] OIDC: authorize URL obtenida, cvJar: ${cvJar.split(";").length} cookies`);

  // 2. GET Campus Virtual login page (con el authorize URL)
  const { html: cvLoginHtml, cookieJar: cvJar2 } = await fetchFollowingCookies(
    authorizeUrl || `${CV_BASE}/`,
    {},
    cvJar,
  );

  // Extraer acción del form y tokens CSRF
  const actionMatch = cvLoginHtml.match(/action="([^"]+)"/);
  const csrfMatch = cvLoginHtml.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
  const tokenMatch = cvLoginHtml.match(/name="Token"[^>]*value="([^"]*)"/);
  if (!csrfMatch) throw new Error("No se encontró CSRF token en Campus Virtual.");

  const formAction = actionMatch ? actionMatch[1] : "/login";
  const csrfToken = csrfMatch[1];
  const hiddenToken = tokenMatch ? tokenMatch[1] : "";
  const loginUrl = formAction.startsWith("http") ? formAction : `${CV_BASE}${formAction}`;
  console.log(`[sync] CV login form → ${loginUrl}, csrf: ${csrfToken.slice(0, 20)}...`);

  // 3. POST credenciales al Campus Virtual (UserName/Password, no username/password)
  const formBody = new URLSearchParams({
    UserName: username,
    Password: password,
    Token: hiddenToken,
    __RequestVerificationToken: csrfToken,
  }).toString();

  const { cookieJar: cvJar3, html: postHtml } = await fetchFollowingCookies(
    loginUrl,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: authorizeUrl || `${CV_BASE}/` }, body: formBody },
    cvJar2,
  );

  // Verificar que el login del campus virtual funcionó
  if (postHtml.includes('id="main_form_login"') || postHtml.includes('"m_login_signin_submit"')) {
    throw new Error("Login fallido en Campus Virtual: credenciales incorrectas.");
  }
  console.log(`[sync] CV login OK, cvJar: ${cvJar3.split(";").length} cookies`);

  // 4. Ahora que estamos autenticados en CV, hacer GET al returnurl (authorize/callback)
  //    para obtener el form_post con el código OIDC que se enviará a intranet/signin-oidc
  const returnurlMatch = loginUrl.match(/[?&]returnurl=([^&]+)/i);
  let formPostHtml = postHtml;
  if (returnurlMatch) {
    const callbackPath = decodeURIComponent(returnurlMatch[1]);
    const callbackUrl = callbackPath.startsWith("http") ? callbackPath : `${CV_BASE}${callbackPath}`;
    console.log(`[sync] GET authorize/callback → ${callbackUrl.slice(0, 80)}...`);
    const { html: cbHtml } = await fetchFollowingCookies(callbackUrl, {}, cvJar3);
    formPostHtml = cbHtml;
  } else {
    console.warn(`[sync] returnurl no encontrado en loginUrl, usando postHtml directo`);
  }

  // Buscar form_post con signin-oidc
  const signinForm = formPostHtml.match(/action=['"]([^'"]*signin-oidc[^'"]*)['"]/i);
  if (signinForm) {
    const hiddenInputs: Record<string, string> = {};
    // El HTML del form_post puede usar comillas simples o dobles
    const inputRegex = /name=['"]([^'"]+)['"]\s[^>]*value=['"]([^'"]*)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = inputRegex.exec(formPostHtml)) !== null) {
      hiddenInputs[m[1]] = m[2];
    }
    const signinUrl = signinForm[1].startsWith("http") ? signinForm[1] : `${BASE_URL}${signinForm[1]}`;
    const signinBody = new URLSearchParams(hiddenInputs).toString();
    const { cookieJar: finalJar } = await fetchFollowingCookies(
      signinUrl,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: `${CV_BASE}/` }, body: signinBody },
      intranetJar,
    );
    console.log("[sync] Login automático exitoso (OIDC). Cookie renovada.");
    cachedCookie = finalJar;
    return finalJar;
  }

  console.error(`[sync] formPostHtml snippet: ${formPostHtml.slice(0, 300).replace(/\s+/g, " ")}`);
  throw new Error("No se encontró el callback OIDC signin-oidc en la respuesta del Campus Virtual.");
}

/* Obtiene cookie activa, hace login automático si no hay o está vacía */
async function getOrRefreshCookie(): Promise<string> {
  if (cachedCookie) return cachedCookie;
  return loginToIntranet();
}

/* Normaliza nombre para comparación: quita acentos y convierte a mayúsculas.
   Ej: "SALAZAR MUNAYCO LUISA MARÍA" → "SALAZAR MUNAYCO LUISA MARIA" */
function normalizeName(s: string): string {
  return (s || "").toUpperCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* ─── Set de combinaciones válidas según planificación 2026-1 ─── */
function buildPlanningSet(): Set<string> {
  const set = new Set<string>();
  const allFiles = [planificacionFica, planificacionFcs] as Array<Array<{ docente?: string; codigo?: string; seccion?: string }>>;
  for (const rows of allFiles) {
    try {
      for (const r of rows) {
        if (!r.docente || !r.codigo || !r.seccion) continue;
        const key = [
          normalizeName(r.docente),
          r.codigo.trim().toUpperCase(),
          r.seccion.trim().toUpperCase().replace(/[PV]$/, ""),
        ].join("|");
        set.add(key);
      }
    } catch (e) { console.error("[sync] Error al procesar planificación:", e); }
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
  //         "P53-20261-P531102 MATEMÁTICA - AP - CH"
  // Soporta: P02A2105 ([A-Z]\d{2}[A-Z]\d{4}) y P531102 ([A-Z]\d{5,7})
  const codeMatch = enc.match(/\b([A-Z]\d{2}[A-Z]\d{4}|[A-Z]\d{5,7})\b/);
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
  // Si la cookie expiró, la intranet devuelve la página de login (HTML) con status 200
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    await res.text();
    console.warn(`[sync] Cookie expirada (HTML redirect). URL: ${url.slice(0, 80)}`);
    throw new Error("AUTH_EXPIRED");
  }
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
}): Promise<"created" | "updated" | "unchanged"> {
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
    // Detectar si los datos cambiaron realmente para no contar como "actualizada" si es igual
    const [current] = await db
      .select({ weeks: asistenciaPlanillasTable.weeks, alumnos: asistenciaPlanillasTable.alumnos })
      .from(asistenciaPlanillasTable)
      .where(eq(asistenciaPlanillasTable.id, existing[0].id));
    if (
      JSON.stringify(current?.weeks) === JSON.stringify(data.weeks) &&
      JSON.stringify(current?.alumnos) === JSON.stringify(data.alumnos)
    ) {
      return "unchanged";
    }
    await db
      .update(asistenciaPlanillasTable)
      .set(payload)
      .where(eq(asistenciaPlanillasTable.id, existing[0].id));
    return "updated";
  } else {
    await db.insert(asistenciaPlanillasTable).values({
      docente: docenteKey,
      codigoCurso: codigoKey,
      nombreCurso: data.nombreCurso || null,
      seccion: seccionKey,
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
): Promise<{ created: number; updated: number; failed: number; skipped: number; unchanged: number; sections: number }> {
  const log = (msg: string) => onProgress?.(msg);
  let created = 0, updated = 0, failed = 0, skipped = 0, unchanged = 0, sections = 0;

  log(`Obteniendo cursos de ${teacher.name}...`);
  const courses: Array<{ id: string; text: string }> = await intranetGet(
    `${BASE_URL}/cursos/docente/${teacher.id}?termId=${termId}`,
    cookie,
  );

  for (const course of courses) {
    // Extract codigoCurso from course text: "P53-20261-P531102-MATEMÁTICA" or "P02-20261-P02A2105-INTRO..."
    // Soporta: P02A2105 ([A-Z]\d{2}[A-Z]\d{4}) y P531102 ([A-Z]\d{5,7})
    const courseCodeMatch = course.text.match(/\b([A-Z]\d{2}[A-Z]\d{4}|[A-Z]\d{5,7})\b/);
    // Fallback robusto: tomar el elemento [2] del split por "-" (LOCAL-TERM-CODE-NOMBRE)
    const splitParts = course.text.split("-");
    const splitCode = splitParts.length >= 3 ? splitParts[2].trim() : null;
    const courseCode = courseCodeMatch
      ? courseCodeMatch[1]
      : (splitCode && splitCode.length >= 4 && !/^\d{6}$/.test(splitCode) ? splitCode : null);

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
          normalizeName(teacher.name),
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
        else if (result === "updated") updated++;
        else unchanged++;
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

  return { created, updated, failed, skipped, unchanged, sections };
}

/* ─── Función central de sync (usada por el endpoint y el scheduler) ─── */
export async function runFullSync(termId = DEFAULT_TERM, onEvent?: (event: string, data: object) => void) {
  const send = onEvent ?? (() => {});
  let cookie = await getOrRefreshCookie();
  const planningSet = buildPlanningSet();

  // Obtener lista de docentes
  let raw: any;
  try {
    raw = await intranetGet(
      `${BASE_URL}/admin/reporte-docentes/get?draw=1&start=0&length=1000&termId=${termId}&_=${Date.now()}`,
      cookie,
    );
  } catch (err: any) {
    if (err.message === "AUTH_EXPIRED") {
      cookie = await loginToIntranet();
      raw = await intranetGet(
        `${BASE_URL}/admin/reporte-docentes/get?draw=1&start=0&length=1000&termId=${termId}&_=${Date.now()}`,
        cookie,
      );
    } else throw err;
  }

  const teachers: Array<{ id: string; name: string; username: string }> =
    (raw.data || []).map((d: any) => ({ id: d.id, name: d.name?.toUpperCase().trim(), username: d.username }));

  send("start", { total: teachers.length });
  let totalCreated = 0, totalUpdated = 0, totalFailed = 0, totalSkipped = 0;

  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    send("teacher", { index: i + 1, total: teachers.length, name: t.name });
    try {
      const r = await syncTeacher(t, cookie, termId, planningSet, (msg) => send("progress", { message: msg }));
      totalCreated += r.created; totalUpdated += r.updated;
      totalFailed  += r.failed;  totalSkipped  += r.skipped;
      send("teacher_done", { name: t.name, ...r });
    } catch (err: any) {
      if (err.message === "AUTH_EXPIRED") {
        // Cookie expiró a mitad del sync → hacer re-login y reintentar este docente
        try {
          cookie = await loginToIntranet();
          const r = await syncTeacher(t, cookie, termId, planningSet, (msg) => send("progress", { message: msg }));
          totalCreated += r.created; totalUpdated += r.updated;
          totalFailed  += r.failed;  totalSkipped  += r.skipped;
          send("teacher_done", { name: t.name, ...r });
        } catch (retryErr: any) {
          send("teacher_error", { name: t.name, error: retryErr.message });
          totalFailed++;
        }
      } else {
        send("teacher_error", { name: t.name, error: err.message });
        totalFailed++;
      }
    }
  }

  send("done", { created: totalCreated, updated: totalUpdated, failed: totalFailed, skipped: totalSkipped });
  return { created: totalCreated, updated: totalUpdated, failed: totalFailed, skipped: totalSkipped };
}

/* ─── POST /api/sincronizar-asistencias ─── */
router.post(
  "/",
  requireAuth,
  requireRole("administrador", "coordinador"),
  async (req: any, res) => {
    const termId: string = req.body?.termId || DEFAULT_TERM;
    const docenteName: string | undefined = req.body?.docenteName;

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
        if (docenteName) {
          // Sync individual de un docente
          let cookie = await getOrRefreshCookie();

          // 1. Intentar resolver el docente desde la tabla local (tiene rawData.id)
          const rows = await db
            .select()
            .from(docentesExternosTable)
            .where(sql`upper(trim(${docentesExternosTable.name})) = upper(trim(${docenteName}))`)
            .limit(1);

          let teacher: { id: string; name: string; username: string } | null = null;

          if (rows.length > 0 && (rows[0].rawData as any)?.id) {
            const raw = rows[0].rawData as any;
            teacher = { id: raw.id, name: rows[0].name, username: rows[0].username ?? "" };
          } else {
            // 2. Fallback: buscar directamente en la intranet
            send("progress", { message: "Buscando docente en la intranet..." });
            let listRaw: any;
            try {
              listRaw = await intranetGet(
                `${BASE_URL}/admin/reporte-docentes/get?draw=1&start=0&length=2000&termId=${termId}&_=${Date.now()}`,
                cookie,
              );
            } catch (e: any) {
              if (e.message === "AUTH_EXPIRED") {
                cookie = await loginToIntranet();
                listRaw = await intranetGet(
                  `${BASE_URL}/admin/reporte-docentes/get?draw=1&start=0&length=2000&termId=${termId}&_=${Date.now()}`,
                  cookie,
                );
              } else throw e;
            }
            const found = (listRaw.data || []).find(
              (d: any) => normalizeName(d.name || "") === normalizeName(docenteName),
            );
            if (found) {
              teacher = { id: found.id, name: found.name?.toUpperCase().trim(), username: found.username ?? "" };
            }
          }

          if (!teacher) {
            send("error", { message: "Docente no encontrado en la Intranet para este período." });
            res.write("event: done\ndata: {}\n\n");
            res.end();
            return;
          }

          const planningSet = buildPlanningSet();
          send("start", { total: 1 });
          send("teacher", { index: 1, total: 1, name: teacher.name });
          try {
            const r = await syncTeacher(teacher, cookie, termId, planningSet, (msg) => send("progress", { message: msg }));
            send("teacher_done", { name: teacher.name, ...r });
            send("done", r);
          } catch (err: any) {
            if (err.message === "AUTH_EXPIRED") {
              cookie = await loginToIntranet();
              const r = await syncTeacher(teacher, cookie, termId, planningSet, (msg) => send("progress", { message: msg }));
              send("teacher_done", { name: teacher.name, ...r });
              send("done", r);
            } else {
              send("teacher_error", { name: teacher.name, error: err.message });
              send("done", { created: 0, updated: 0, failed: 1, skipped: 0 });
            }
          }
        } else {
          // Sync masivo
          await runFullSync(termId, send);
        }
      } catch (err: any) {
        send("error", { message: err.message || "Error interno" });
      }
      res.write("event: done\ndata: {}\n\n");
      res.end();
      return;
    }

    // Non-SSE: synchronous response (per teacher only)
    try {
      if (!docenteName) {
        return res.status(400).json({ error: "DOCENTE_REQUERIDO", message: "Proporciona docenteName para sync individual." });
      }
      let cookie = await getOrRefreshCookie();

      // 1. Intentar resolver desde la tabla local
      const rows = await db
        .select()
        .from(docentesExternosTable)
        .where(sql`upper(trim(${docentesExternosTable.name})) = upper(trim(${docenteName}))`)
        .limit(1);

      let teacher: { id: string; name: string; username: string } | null = null;
      if (rows.length > 0 && (rows[0].rawData as any)?.id) {
        const raw = rows[0].rawData as any;
        teacher = { id: raw.id, name: rows[0].name, username: rows[0].username ?? "" };
      } else {
        // 2. Fallback: buscar en la intranet
        let listRaw: any;
        try {
          listRaw = await intranetGet(
            `${BASE_URL}/admin/reporte-docentes/get?draw=1&start=0&length=2000&termId=${termId}&_=${Date.now()}`,
            cookie,
          );
        } catch (e: any) {
          if (e.message === "AUTH_EXPIRED") {
            cookie = await loginToIntranet();
            listRaw = await intranetGet(
              `${BASE_URL}/admin/reporte-docentes/get?draw=1&start=0&length=2000&termId=${termId}&_=${Date.now()}`,
              cookie,
            );
          } else throw e;
        }
        const found = (listRaw.data || []).find(
          (d: any) => normalizeName(d.name || "") === normalizeName(docenteName),
        );
        if (found) teacher = { id: found.id, name: found.name?.toUpperCase().trim(), username: found.username ?? "" };
      }

      if (!teacher) {
        return res.status(404).json({ error: "DOCENTE_NO_ENCONTRADO", message: "Docente no encontrado en la Intranet para este período." });
      }
      const planningSet = buildPlanningSet();
      try {
        const result = await syncTeacher(teacher, cookie, termId, planningSet);
        return res.json({ ok: true, docente: teacher.name, ...result });
      } catch (err: any) {
        if (err.message === "AUTH_EXPIRED") {
          cookie = await loginToIntranet();
          const result = await syncTeacher(teacher, cookie, termId, planningSet);
          return res.json({ ok: true, docente: teacher.name, ...result });
        }
        throw err;
      }
    } catch (err: any) {
      console.error("[sincronizar-asistencias] error:", err);
      res.status(500).json({ error: "SYNC_ERROR", message: err.message || "Error al sincronizar" });
    }
  },
);

/* ─── GET /api/sincronizar-asistencias/download-intranet ─── */
/* Descarga el Excel de asistencia directamente desde la Intranet UAI */
router.get(
  "/download-intranet",
  requireAuth,
  requireRole("administrador", "coordinador"),
  async (req: any, res) => {
    const { docente, codigoCurso, seccion, termId: qTerm } = req.query as Record<string, string>;
    if (!docente || !codigoCurso) {
      return res.status(400).json({ error: "PARAMS", message: "Se requieren docente y codigoCurso" });
    }
    const termId = qTerm || DEFAULT_TERM;
    const normSec = (s: string) => (s || "").trim().toUpperCase().replace(/[PV]$/, "");

    try {
      let cookie = await getOrRefreshCookie();

      // 1. Buscar ID del docente en la tabla local
      const rows = await db
        .select()
        .from(docentesExternosTable)
        .where(sql`upper(trim(${docentesExternosTable.name})) = upper(trim(${docente}))`)
        .limit(1);

      let teacherId: string | null = null;
      if (rows.length > 0 && (rows[0].rawData as any)?.id) {
        teacherId = (rows[0].rawData as any).id;
      } else {
        let listRaw: any;
        try {
          listRaw = await intranetGet(`${BASE_URL}/admin/reporte-docentes/get?draw=1&start=0&length=2000&termId=${termId}&_=${Date.now()}`, cookie);
        } catch (e: any) {
          if (e.message === "AUTH_EXPIRED") {
            cookie = await loginToIntranet();
            listRaw = await intranetGet(`${BASE_URL}/admin/reporte-docentes/get?draw=1&start=0&length=2000&termId=${termId}&_=${Date.now()}`, cookie);
          } else throw e;
        }
        const found = (listRaw.data || []).find((d: any) => normalizeName(d.name || "") === normalizeName(docente));
        if (found) teacherId = found.id;
      }

      if (!teacherId) {
        return res.status(404).json({ error: "DOCENTE_NO_ENCONTRADO", message: "Docente no encontrado en la Intranet." });
      }

      // 2. Obtener cursos del docente
      let courses: Array<{ id: string; text: string }>;
      try {
        courses = await intranetGet(`${BASE_URL}/cursos/docente/${teacherId}?termId=${termId}`, cookie);
      } catch (e: any) {
        if (e.message === "AUTH_EXPIRED") { cookie = await loginToIntranet(); courses = await intranetGet(`${BASE_URL}/cursos/docente/${teacherId}?termId=${termId}`, cookie); }
        else throw e;
      }

      // 3. Encontrar el curso por codigoCurso
      const normCodigo = codigoCurso.trim().toUpperCase();
      const matchedCourse = courses.find((c) => c.text.toUpperCase().includes(normCodigo));
      if (!matchedCourse) {
        return res.status(404).json({ error: "CURSO_NO_ENCONTRADO", message: `Curso ${codigoCurso} no encontrado para este docente.` });
      }

      // 4. Obtener secciones del curso
      let secciones: Array<{ id: string; text: string }>;
      try {
        secciones = await intranetGet(`${BASE_URL}/secciones-por-curso/${matchedCourse.id}/docente/${teacherId}?termId=${termId}`, cookie);
      } catch (e: any) {
        if (e.message === "AUTH_EXPIRED") { cookie = await loginToIntranet(); secciones = await intranetGet(`${BASE_URL}/secciones-por-curso/${matchedCourse.id}/docente/${teacherId}?termId=${termId}`, cookie); }
        else throw e;
      }

      // 5. Encontrar la sección correcta (strip modalidad para comparar)
      const targetSec = seccion ? normSec(seccion) : null;
      let matchedSection = targetSec
        ? secciones.find((s) => normSec(s.text.split(" - ")[0] || s.text) === targetSec)
        : secciones[0];
      if (!matchedSection) matchedSection = secciones[0];

      if (!matchedSection) {
        return res.status(404).json({ error: "SECCION_NO_ENCONTRADA", message: `Sección no encontrada para ${codigoCurso}.` });
      }

      // 6. Descargar el Excel de la Intranet
      const buf = await downloadExcel(matchedSection.id, cookie);
      const secLabel = normSec(matchedSection.text.split(" - ")[0] || matchedSection.text);
      const fileName = `Reporte_Asistencia_${normCodigo}_${secLabel}_2026-1.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.send(buf);
    } catch (err: any) {
      console.error("[download-intranet] error:", err);
      if (err.message === "AUTH_EXPIRED") {
        return res.status(401).json({ error: "AUTH_EXPIRED", message: "Sesión del Intranet expirada. Vuelve a intentarlo en unos segundos." });
      }
      res.status(500).json({ error: "ERROR", message: err.message || "Error al descargar del intranet" });
    }
  },
);

export default router;
