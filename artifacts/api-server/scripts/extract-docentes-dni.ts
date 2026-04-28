import * as fs from "fs";
import * as path from "path";
import { read, utils } from "xlsx";

const ARGS = process.argv.slice(2);
const FILES = ARGS.length > 0 ? ARGS : [
  "../../attached_assets/DATA_CERRADA_27-03-2026_PLANIFICACION_PREGRADO_2026-1_ACT_(11_1777394123256.xlsx",
];
const OUT  = path.resolve("../school-portal/public/docentes-dni.json");
const XLSX = { read, utils };

function normalizeName(s: string): string {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cleanDni(v: any): string | null {
  if (v == null) return null;
  const s = String(v).replace(/\D/g, "").trim();
  if (!s) return null;
  if (s.length < 6 || s.length > 12) return null;
  return s.padStart(8, "0").slice(-8);
}

const map = new Map<string, string>();
let added = 0, skipped = 0, conflicts = 0;

function addPair(name: any, dni: any) {
  if (!name) return;
  const n = normalizeName(String(name));
  if (!n || n.length < 4) return;
  const d = cleanDni(dni);
  if (!d) { skipped++; return; }
  const prev = map.get(n);
  if (prev && prev !== d) { conflicts++; return; }
  if (!prev) { map.set(n, d); added++; }
}

function looksLikeDni(v: any): boolean {
  if (v == null) return false;
  return /^\d{6,12}$/.test(String(v).replace(/\s/g, ""));
}
function looksLikeName(v: any): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  return s.length >= 5 && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/.test(s) && !/^\d+$/.test(s);
}

function scanSheet(ws: any, sheetName: string, file: string) {
  const ref = ws["!ref"]; if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  // Find header row mentioning DNI / Apellidos / Nombre
  let headerRow = -1;
  const dniCols: number[] = [];
  const nameCols: number[] = [];
  for (let r = 0; r <= Math.min(range.e.r, 12); r++) {
    let foundDni = false, foundName = false;
    const tmpDni: number[] = [], tmpName: number[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const v = ws[XLSX.utils.encode_cell({ r, c })]?.v;
      if (v == null) continue;
      const s = String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      if (/\bDNI\b/.test(s)) { foundDni = true; tmpDni.push(c); }
      if (/APELLIDO|NOMBRE|DOCENTE/.test(s) && !/CONDICION|PROGRAMA|LOCAL|HORAS|DEDICACION|INGRESO|RESPONSABLE|CARRERA|FACULTAD|REGISTRO/.test(s)) {
        foundName = true; tmpName.push(c);
      }
    }
    if (foundDni && foundName) {
      headerRow = r; dniCols.push(...tmpDni); nameCols.push(...tmpName); break;
    }
  }
  if (headerRow < 0) return;
  // Pair each DNI column with the nearest name column to its right (or any)
  const before = added;
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    for (const dc of dniCols) {
      const dniV = ws[XLSX.utils.encode_cell({ r, c: dc })]?.v;
      if (!looksLikeDni(dniV)) continue;
      let nameC = -1, bestDist = 999;
      for (const nc of nameCols) {
        const d = Math.abs(nc - dc);
        if (d < bestDist) {
          const v = ws[XLSX.utils.encode_cell({ r, c: nc })]?.v;
          if (looksLikeName(v)) { bestDist = d; nameC = nc; }
        }
      }
      if (nameC >= 0) {
        const nameV = ws[XLSX.utils.encode_cell({ r, c: nameC })]?.v;
        addPair(nameV, dniV);
      }
    }
  }
  const delta = added - before;
  if (delta > 0) console.log(`  [${path.basename(file)}] sheet "${sheetName}": +${delta} new`);
}

for (const FILE of FILES) {
  if (!fs.existsSync(FILE)) { console.warn(`Missing: ${FILE}`); continue; }
  console.log(`Reading ${path.basename(FILE)}…`);
  const buf = fs.readFileSync(FILE);
  const wb = XLSX.read(buf, { type: "buffer" });
  for (const sn of wb.SheetNames) {
    try { scanSheet(wb.Sheets[sn], sn, FILE); } catch (e: any) { console.warn(`  err in ${sn}: ${e.message}`); }
  }
}

const obj: Record<string, string> = {};
[...map.entries()].sort(([a], [b]) => a.localeCompare(b, "es")).forEach(([k, v]) => { obj[k] = v; });

fs.writeFileSync(OUT, JSON.stringify(obj, null, 2), "utf8");
console.log(`Wrote ${Object.keys(obj).length} entries to ${OUT}`);
