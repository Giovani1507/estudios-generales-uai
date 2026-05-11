/**
 * import-planificacion-2026-1.ts
 * Regenera planificacion-fica-2026-1.json y planificacion-fcs-2026-1.json
 * desde los 5 archivos de planificación 2026-1.
 *
 * Uso: npx tsx scripts/import-planificacion-2026-1.ts
 */
import * as fs from "fs";
import * as path from "path";
import { read, utils } from "xlsx";

// ─── Carrera code → full name ──────────────────────────────────────────────
const CARRERA_FULL: Record<string, string> = {
  // FICA
  AF: "ADMINISTRACION Y FINANZAS",
  CA: "CONTABILIDAD",
  DE: "DERECHO",
  IC: "INGENIERIA CIVIL",
  IN: "INGENIERIA INDUSTRIAL",
  AE: "ADMINISTRACION DE EMPRESAS",
  AR: "ARQUITECTURA",
  IS: "INGENIERIA DE SISTEMAS",
  // FCS
  EN: "ENFERMERÍA",
  OB: "OBSTETRICIA",
  PS: "PSICOLOGÍA",
  MH: "MEDICINA HUMANA",
  T1: "TERAPIA DEL LENGUAJE",
  T2: "TERAPIA FÍSICA Y REHABILITACIÓN",
  T3: "FARMACIA Y BIOQUÍMICA",
  T4: "OPTOMETRÍA",
};

// ─── Day number → Spanish name (Source files: 1=LUNES) ──────────────────
const DAY_NAME: Record<number, string> = {
  1: "LUNES", 2: "MARTES", 3: "MIERCOLES", 4: "JUEVES",
  5: "VIERNES", 6: "SABADO", 7: "DOMINGO",
};

// ─── Files ─────────────────────────────────────────────────────────────────
const FILES = [
  path.resolve("../../attached_assets/PLANIFICACIÓN_(_FILIAL_Y_PORUMA)_1778103548833.xlsx"),
  path.resolve("../../attached_assets/PLANIFICACIÓN_(PRINCIPAL)_FCS_1778103548834.xlsx"),
  path.resolve("../../attached_assets/PLANIFICACIÓN_FCS_(HUAURA)_1778103548834.xlsx"),
  path.resolve("../../attached_assets/PLANIFICACIÓN_FICA(HUAURA)_1778103548835.xlsx"),
  path.resolve("../../attached_assets/PLANIFICACIÓN_SEDE_(_FICA)_1778103548835.xlsx"),
];

const OUT_FICA = path.resolve("../../artifacts/school-portal/public/planificacion-fica-2026-1.json");
const OUT_FCS  = path.resolve("../../artifacts/school-portal/public/planificacion-fcs-2026-1.json");

type PlanRow = {
  local: string;
  facultad: string;
  carrera: string;
  carreraFull: string;
  ciclo: string;
  seccion: string;
  codigo: string;
  curso: string;
  tipo: string;
  modalidadCurso: string;
  horasT: number;
  horasP: number;
  horas: number;
  docente: string;
  modalidad: string;
  pabellon: string | null;
  aula: string | null;
  laboratorio: string | null;
  dia: string;
  hora: string;
  horaFin: string;
  horasAcad: number;
};

function v(ws: any, r: number, c: number): string {
  const cell = ws[utils.encode_cell({ r, c })];
  if (!cell) return "";
  return String(cell.v ?? "").trim();
}

function num(ws: any, r: number, c: number): number {
  const cell = ws[utils.encode_cell({ r, c })];
  if (!cell) return 0;
  return Number(cell.v) || 0;
}

function fmtTime(hour: number, min: number): string {
  if (!hour && !min) return "";
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function nullIfEmpty(s: string): string | null {
  const t = s.trim().replace(/^[–—\-\s]+$/, "");
  return t && t !== "Sin asignar" ? t : null;
}

/**
 * Determines header row and column offsets.
 * FICA files: header at row 4 → colOffset = 0
 * FCS  files: header at row 5 → has extra "nd" col at 10 → colOffset = 1
 */
function detectFormat(ws: any): { hdrRow: number; dataRow: number; offset: number } {
  // Try row 4 first (FICA style)
  const r4c2 = v(ws, 4, 2);
  const r5c2 = v(ws, 5, 2);
  if (r4c2.startsWith("SEMESTRE")) return { hdrRow: 4, dataRow: 5, offset: 0 };
  if (r5c2.startsWith("SEMESTRE")) return { hdrRow: 5, dataRow: 6, offset: 1 };
  return { hdrRow: 5, dataRow: 6, offset: 1 };
}

function parseSheet(ws: any): PlanRow[] {
  const range = utils.decode_range(ws["!ref"]!);
  const { dataRow, offset } = detectFormat(ws);
  const rows: PlanRow[] = [];

  for (let r = dataRow; r <= range.e.r; r++) {
    const semestre = v(ws, r, 2);
    if (!semestre || !semestre.includes("2026")) continue;

    const local    = v(ws, r, 5);
    const facultad = v(ws, r, 6).toUpperCase();
    const carrera  = v(ws, r, 7).toUpperCase();
    const ciclo    = v(ws, r, 8);
    const secRaw   = v(ws, r, 9);
    // For FCS, col 10 has the clean section letter ("nd"); for FICA, col 9 is already clean
    const secClean = offset === 1 ? v(ws, r, 10) || secRaw.replace(/\d+/g, "").trim() : secRaw;
    const seccion  = secClean || secRaw;

    const codigo       = v(ws, r, 10 + offset);
    const curso        = v(ws, r, 11 + offset);
    const tipoEstudio  = v(ws, r, 12 + offset);
    const tipoCurso    = v(ws, r, 13 + offset);
    const modalidadC   = v(ws, r, 14 + offset);
    const horasT       = num(ws, r, 15 + offset);
    const horasP       = num(ws, r, 16 + offset);
    const horasTot     = num(ws, r, 17 + offset);

    if (!carrera || !ciclo || !curso) continue;

    // Docente info — DNI at 21+offset, name at 22+offset
    // For FICA (offset=0): DNI=21, name=22
    // For FCS  (offset=1): DNI=22, name=23
    const docente    = v(ws, r, 22 + offset);
    const modalidad  = v(ws, r, 23 + offset);

    // Schedule — pabellon/aula/lab
    const pabellon   = nullIfEmpty(v(ws, r, 26 + offset));
    const aula       = nullIfEmpty(v(ws, r, 27 + offset));
    const lab        = nullIfEmpty(v(ws, r, 29 + offset));

    // Day & time
    const diaNum     = num(ws, r, 33 + offset);
    const diaStr     = DAY_NAME[diaNum] ?? "";
    const hIni       = num(ws, r, 34 + offset);
    const mIni       = num(ws, r, 35 + offset);
    const hFin       = num(ws, r, 36 + offset);
    const mFin       = num(ws, r, 37 + offset);
    const horasAcad  = num(ws, r, 38 + offset);

    // Skip rows with no useful data (no docente AND no day)
    if (!docente && !diaNum) continue;
    // Skip completely empty rows
    if (!local && !carrera && !curso) continue;

    const carreraFull = CARRERA_FULL[carrera] || carrera;

    rows.push({
      local,
      facultad,
      carrera,
      carreraFull,
      ciclo,
      seccion,
      codigo,
      curso,
      tipo: tipoCurso || tipoEstudio,
      modalidadCurso: modalidadC,
      horasT,
      horasP,
      horas: horasTot || (horasT + horasP),
      docente,
      modalidad,
      pabellon,
      aula,
      laboratorio: lab,
      dia: diaStr,
      hora: fmtTime(hIni, mIni),
      horaFin: fmtTime(hFin, mFin),
      horasAcad,
    });
  }

  return rows;
}

// ─── Main ──────────────────────────────────────────────────────────────────
const allFica: PlanRow[] = [];
const allFcs: PlanRow[] = [];
let totalRows = 0;

for (const filePath of FILES) {
  if (!fs.existsSync(filePath)) {
    console.warn("⚠  File not found:", filePath);
    continue;
  }
  const label = path.basename(filePath);
  const wb = read(fs.readFileSync(filePath), { type: "buffer" });

  const sheetName = wb.SheetNames.find(s =>
    s.toLowerCase().includes("planificación 2026") ||
    s.toLowerCase().includes("planificacion 2026")
  );
  if (!sheetName) {
    console.warn("⚠  No 'Planificación 2026-1' sheet in:", label);
    continue;
  }

  const ws = wb.Sheets[sheetName];
  if (!ws["!ref"]) {
    console.warn("⚠  Empty sheet in:", label);
    continue;
  }

  const rows = parseSheet(ws);
  console.log(`📄  ${label} → ${rows.length} rows`);
  totalRows += rows.length;

  for (const row of rows) {
    if (row.facultad === "FICA") {
      allFica.push(row);
    } else {
      allFcs.push(row);
    }
  }
}

// Deduplicate: use a key of local+carrera+ciclo+seccion+codigo+dia+hora+docente
function dedup(rows: PlanRow[]): PlanRow[] {
  const seen = new Set<string>();
  return rows.filter(r => {
    const key = [r.local, r.carrera, r.ciclo, r.seccion, r.codigo, r.dia, r.hora, r.docente].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const ficaOut = dedup(allFica);
const fcsOut  = dedup(allFcs);

// Backup existing files
for (const [out, data] of [[OUT_FICA, ficaOut], [OUT_FCS, fcsOut]] as [string, PlanRow[]][]) {
  if (fs.existsSync(out)) {
    // Keep only up to 3 backups, rotate
    const baks = [out + ".bak", out + ".bak2", out + ".bak3"];
    if (fs.existsSync(baks[1])) fs.copyFileSync(baks[1], baks[2]);
    if (fs.existsSync(baks[0])) fs.copyFileSync(baks[0], baks[1]);
    fs.copyFileSync(out, baks[0]);
  }
  fs.writeFileSync(out, JSON.stringify(data, null, 2), "utf-8");
}

console.log("\n✅  Done:");
console.log(`   Total rows parsed : ${totalRows}`);
console.log(`   FICA rows written : ${ficaOut.length}  → ${path.basename(OUT_FICA)}`);
console.log(`   FCS  rows written : ${fcsOut.length}  → ${path.basename(OUT_FCS)}`);

// Quick stats
const ficaCarreras = [...new Set(ficaOut.map(r => r.carrera))].sort();
const fcsCarreras  = [...new Set(fcsOut.map(r => r.carrera))].sort();
console.log(`\n   FICA carreras: ${ficaCarreras.join(", ")}`);
console.log(`   FCS  carreras: ${fcsCarreras.join(", ")}`);
const ficaLocales  = [...new Set(ficaOut.map(r => r.local))].sort();
const fcsLocales   = [...new Set(fcsOut.map(r => r.local))].sort();
console.log(`   FICA locales : ${ficaLocales.join(", ")}`);
console.log(`   FCS  locales : ${fcsLocales.join(", ")}`);
