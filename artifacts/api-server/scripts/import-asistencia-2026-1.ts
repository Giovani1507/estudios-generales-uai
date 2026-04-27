import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db, pool } from "../../../lib/db/src/index";
import { asistenciaPlanillasTable } from "../../../lib/db/src/schema/asistencia_planillas";
import { and, eq } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../attached_assets/asistencia_2026_1_extracted");

type Week = { label: string; fecha: string; dia: string; slots: 1 | 2 };
type Alumno = { numero: string; nombre: string; marcas: string[]; porcentaje: number };
type Totales = { asistencias: number[]; inasistencias: number[] };

type Parsed = {
  docente: string | null;
  carrera: string | null;
  carreraFull: string | null;
  ciclo: string | null;
  seccion: string | null;
  sede: string | null;
  codigoCurso: string | null;
  nombreCurso: string | null;
  encabezadoCrudo: string | null;
  weeks: Week[];
  alumnos: Alumno[];
  totales: Totales;
};

function s(v: any): string {
  return v == null ? "" : String(v).trim();
}

function parseFile(filePath: string, fallbackSede: string | null, fallbackCarreraCicloSeccion: string | null): Parsed | null {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return null;
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as any[][];
  const cell = (r: number, c: number) => s(aoa[r]?.[c]);

  // Banner: row 0
  const banner = cell(0, 0);
  // "UNIVERSIDAD AUTÓNOMA DE ICA — {CARRERA_FULL} — ASISTENCIA 2026-I"
  let carreraFull: string | null = null;
  {
    const m = banner.match(/UNIVERSIDAD\s+AUT[ÓO]NOMA\s+DE\s+ICA\s*[—-]\s*(.+?)\s*[—-]\s*ASISTENCIA/i);
    if (m) carreraFull = m[1].trim();
  }

  // Title: row 2 → "{codigo} — {nombre} · {carrera} {ciclo}{seccion}   ·   📍 {sede}"
  const title = cell(2, 0);
  let codigoCurso: string | null = null;
  let nombreCurso: string | null = null;
  let carrera: string | null = null;
  let ciclo: string | null = null;
  let seccion: string | null = null;
  let sede: string | null = null;
  {
    // split by "·"
    const partsDot = title.split("·").map((x) => x.trim());
    // first part: "{codigo} — {nombre}" or just "{nombre}"
    if (partsDot[0]) {
      const m = partsDot[0].match(/^([A-Z0-9]+)\s*[—-]\s*(.+)$/);
      if (m) { codigoCurso = m[1].trim(); nombreCurso = m[2].trim(); }
      else { nombreCurso = partsDot[0]; }
    }
    if (partsDot[1]) {
      // "{carrera} {ciclo}{seccion}" e.g. "AE 1A" or "AE 1-A"
      const t = partsDot[1].trim();
      const mm = t.match(/^([A-Z]+\d*)\s+(\d+)\s*-?\s*([A-Z0-9]+)$/i);
      if (mm) {
        carrera = mm[1].toUpperCase();
        ciclo = mm[2];
        seccion = mm[3].toUpperCase();
      } else {
        carrera = t;
      }
    }
    if (partsDot[2]) {
      // "📍 {sede}"
      const ss = partsDot[2].replace(/^[^A-Z]+/, "").trim();
      if (ss) sede = ss.toUpperCase();
    }
  }
  if (!sede && fallbackSede) sede = fallbackSede.toUpperCase();
  if ((!carrera || !ciclo || !seccion) && fallbackCarreraCicloSeccion) {
    const t = fallbackCarreraCicloSeccion.trim();
    const mm = t.match(/^([A-Z]+\d*)\s+(\d+)\s*-?\s*([A-Z0-9]+)$/i);
    if (mm) {
      carrera = carrera || mm[1].toUpperCase();
      ciclo = ciclo || mm[2];
      seccion = seccion || mm[3].toUpperCase();
    }
  }

  // Docente: row 3 → "Docente: {NAME}   ·   Semanas: N"
  let docente: string | null = null;
  {
    const t = cell(3, 0);
    const m = t.match(/Docente:\s*([^·]+)/i);
    if (m) docente = m[1].trim().toUpperCase();
  }

  // Find header row with "N°" + "Apellidos"
  let headerRow = -1;
  for (let r = 0; r < Math.min(aoa.length, 14); r++) {
    const v0 = cell(r, 0).toLowerCase();
    const v1 = cell(r, 1).toLowerCase();
    const isN = v0.length <= 8 && (
      v0 === "n°" || v0 === "nº" || v0 === "nª" || v0 === "no" || v0 === "n" ||
      v0.startsWith("n°") || v0.startsWith("nº") || v0.startsWith("nª")
    );
    if (isN && v1.includes("apellidos")) { headerRow = r; break; }
  }
  if (headerRow < 0) return null;

  // Detect last column with header content
  const headerArr = aoa[headerRow] || [];
  let lastCol = headerArr.length - 1;
  while (lastCol >= 0 && !s(headerArr[lastCol])) lastCol--;
  // Locate summary columns from the right: "Estado", "% Inas.", "Inasistencias", "Asistencias"
  // Strip up to 4 trailing summary cols
  const summaryHeaders = ["estado", "%", "inasistencias", "asistencias"];
  let dataLastCol = lastCol + 1; // exclusive
  for (let i = 0; i < 4 && dataLastCol > 2; i++) {
    const h = cell(headerRow, dataLastCol - 1).toLowerCase();
    const isSummary = summaryHeaders.some((kw) => h.includes(kw));
    if (isSummary) dataLastCol--;
    else break;
  }

  // Build week columns by grouping consecutive cols with same fecha (row headerRow+1)
  type WeekDef = { label: string; fecha: string; dia: string; cols: number[] };
  const weekDefs: WeekDef[] = [];
  for (let c = 2; c < dataLastCol; c++) {
    const label = cell(headerRow, c);
    const fecha = cell(headerRow + 1, c);
    const diaRaw = cell(headerRow + 2, c);
    // dia may include "T" or "P" suffix on its own line; keep base day
    const dia = diaRaw.split(/[\n\r]/)[0].trim();
    if (!fecha && !label) continue;
    const last = weekDefs[weekDefs.length - 1];
    if (last && fecha && last.fecha === fecha && last.cols.length < 2) {
      last.cols.push(c);
    } else {
      weekDefs.push({
        label: label || `Semana ${weekDefs.length + 1}`,
        fecha,
        dia,
        cols: [c],
      });
    }
  }

  const weeks: Week[] = weekDefs.map((w) => ({
    label: w.label,
    fecha: w.fecha,
    dia: w.dia,
    slots: w.cols.length === 2 ? 2 : 1,
  }));

  // Alumnos start after 3 header rows (header + fecha + dia)
  const startRow = headerRow + 3;
  const alumnos: Alumno[] = [];
  for (let r = startRow; r < aoa.length; r++) {
    const numero = cell(r, 0);
    const nombre = cell(r, 1);
    const c1 = nombre.toLowerCase();
    // Skip footer/summary rows
    if (!nombre && !numero) continue;
    if (!numero && (c1.includes("asistencia") || c1.includes("inasistencia"))) continue;
    if (!numero) continue;
    if (/total\s+alumnos/i.test(nombre)) continue;
    // Build marcas (length = weeks.length * 2)
    const marcas: string[] = [];
    for (const w of weekDefs) {
      const v1 = w.cols[0] !== undefined ? cell(r, w.cols[0]) : "";
      const v2 = w.cols[1] !== undefined ? cell(r, w.cols[1]) : "";
      marcas.push(v1.toUpperCase(), v2.toUpperCase());
    }
    alumnos.push({ numero, nombre, marcas, porcentaje: 0 });
  }

  // Recompute totales/porcentajes from marcas
  const cols = weeks.length * 2;
  const asisTot = new Array(cols).fill(0);
  const inasTot = new Array(cols).fill(0);
  const recomputed = alumnos.map((a) => {
    let asis = 0, inasis = 0;
    for (let i = 0; i < cols; i++) {
      const m = (a.marcas[i] || "").toUpperCase();
      if (m === "A") { asisTot[i]++; asis++; }
      else if (m === "F") { inasTot[i]++; inasis++; }
    }
    const total = asis + inasis;
    const porcentaje = total > 0 ? Math.round((asis / total) * 10000) / 100 : 0;
    return { ...a, porcentaje };
  });

  return {
    docente,
    carrera,
    carreraFull,
    ciclo,
    seccion,
    sede,
    codigoCurso,
    nombreCurso,
    encabezadoCrudo: title || banner || null,
    weeks,
    alumnos: recomputed,
    totales: { asistencias: asisTot, inasistencias: inasTot },
  };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.xlsx$/i.test(name) && !name.startsWith("~$")) out.push(p);
  }
  return out;
}

(async () => {
  if (!fs.existsSync(ROOT)) {
    console.error(`No existe el directorio: ${ROOT}`);
    process.exit(1);
  }
  const files = walk(ROOT);
  console.log(`Encontrados ${files.length} archivos xlsx`);

  let inserted = 0, updated = 0, skipped = 0, failed = 0;
  let n = 0;
  for (const file of files) {
    n++;
    const rel = path.relative(ROOT, file);
    const parts = rel.split(path.sep);
    const sedeFolder = parts[0] || null; // SEDE/FILIAL/HUAURA/PORUMA/SUNAMPE
    const carreraFolder = parts[1] || null; // "AE 1-A"
    try {
      const parsed = parseFile(file, sedeFolder, carreraFolder);
      if (!parsed) { console.warn(`[skip-noparse] ${rel}`); skipped++; continue; }
      if (!parsed.docente || !parsed.codigoCurso || !parsed.seccion) {
        console.warn(`[skip-meta] ${rel}  docente=${parsed.docente} codigo=${parsed.codigoCurso} seccion=${parsed.seccion}`);
        skipped++;
        continue;
      }
      if (parsed.alumnos.length === 0) {
        console.warn(`[skip-empty] ${rel}`);
        skipped++;
        continue;
      }
      // Upsert by docente + codigoCurso + seccion
      const existing = await db.select({ id: asistenciaPlanillasTable.id })
        .from(asistenciaPlanillasTable)
        .where(and(
          eq(asistenciaPlanillasTable.docente, parsed.docente),
          eq(asistenciaPlanillasTable.codigoCurso, parsed.codigoCurso),
          eq(asistenciaPlanillasTable.seccion, parsed.seccion),
        ))
        .limit(1);

      const turno: string | null = (() => {
        // Best-effort: derived from sede/dia not available; leave null.
        return null;
      })();

      const values = {
        docente: parsed.docente,
        carrera: parsed.carrera,
        ciclo: parsed.ciclo,
        seccion: parsed.seccion,
        turno,
        sede: parsed.sede,
        modalidad: null,
        dia: parsed.weeks[0]?.dia || null,
        codigoCurso: parsed.codigoCurso,
        nombreCurso: parsed.nombreCurso,
        encabezadoCrudo: parsed.encabezadoCrudo,
        weeks: parsed.weeks as any,
        alumnos: parsed.alumnos as any,
        totales: parsed.totales as any,
      };

      if (existing.length > 0) {
        await db.update(asistenciaPlanillasTable)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(asistenciaPlanillasTable.id, existing[0].id));
        updated++;
      } else {
        await db.insert(asistenciaPlanillasTable).values(values);
        inserted++;
      }
      if (n % 50 === 0) console.log(`  · procesados ${n}/${files.length}`);
    } catch (err: any) {
      failed++;
      console.error(`[error] ${rel}:`, err?.message || err);
    }
  }

  console.log(`\nResumen:`);
  console.log(`  insertados: ${inserted}`);
  console.log(`  actualizados: ${updated}`);
  console.log(`  saltados:   ${skipped}`);
  console.log(`  fallidos:   ${failed}`);

  await pool.end();
})();
