import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Entry = {
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

const ARGS = process.argv.slice(2);
if (ARGS.length < 2) {
  console.error("Uso: tsx scripts/import-planificacion-fcs.ts <xlsx> <local> [<local>...]");
  process.exit(1);
}
const XLSX_PATH = path.resolve(ARGS[0]);
const LOCAL_FILTERS = ARGS.slice(1).map((s) => s.toUpperCase().trim());

const JSON_PATH = path.resolve(
  __dirname,
  "../artifacts/school-portal/public/planificacion-fcs-2026-1.json",
);

const DIA_MAP: Record<string, string> = {
  "1": "LUNES",
  "2": "MARTES",
  "3": "MIÉRCOLES",
  "4": "JUEVES",
  "5": "VIERNES",
  "6": "SÁBADO",
  "7": "DOMINGO",
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const s = (v: any) => (v == null ? "" : String(v).trim());
const upper = (v: any) => s(v).toUpperCase();
const numOrNull = (v: any) => {
  const n = Number(s(v));
  return Number.isFinite(n) ? n : 0;
};

function buildCarreraFullMap(existing: Entry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of existing) {
    if (e.carrera && e.carreraFull && !map[e.carrera]) {
      map[e.carrera] = e.carreraFull;
    }
  }
  return map;
}

function timeFromCols(hour: any, minute: any): string | null {
  const h = Number(s(hour));
  const m = Number(s(minute));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${pad2(h)}:${pad2(m)}`;
}

function parseSheet(filePath: string): Entry[][] {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((n) => /planificaci/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as any[][];

  const carreraFullByKey: Record<string, string> = {};
  let existing: Entry[] = [];
  if (fs.existsSync(JSON_PATH)) {
    existing = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
    Object.assign(carreraFullByKey, buildCarreraFullMap(existing));
  }

  const out: Entry[] = [];
  let parsed = 0,
    skipped = 0;
  for (let i = 7; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const local = upper(r[5]);
    if (!local) continue;
    if (LOCAL_FILTERS.length > 0 && !LOCAL_FILTERS.includes(local)) continue;
    const facultad = upper(r[6]);
    const carrera = upper(r[7]);
    const codigo = s(r[11]).replace(/\s+/g, "");
    const curso = s(r[12]);
    if (!facultad || !carrera || !codigo || !curso) continue;
    const ciclo = s(r[8]);
    const seccionBase = upper(r[10] || r[9]);
    const seccion = seccionBase || upper(r[9]);
    if (!ciclo || !seccion) continue;

    const docente = upper(r[23]);
    const modalidad = upper(r[24] || "PRESENCIAL");
    const horasT = numOrNull(r[16]);
    const horasP = numOrNull(r[17]);
    const horas = numOrNull(r[18]) || horasT + horasP;
    const horasAcad = numOrNull(r[39]);

    const diaNum = s(r[34]);
    const dia = DIA_MAP[diaNum] || upper(r[34]) || "";
    const hora = timeFromCols(r[35], r[36]);
    const horaFin = timeFromCols(r[37], r[38]);
    if (!dia || !hora || !horaFin) {
      skipped++;
      continue;
    }

    const carreraFull =
      carreraFullByKey[carrera] || carrera;

    const tipo = s(r[14]) || "Obligatorio";
    const modalidadCurso = s(r[15]) || "Presencial";

    const pabellon = s(r[27]) || null;
    const aula = s(r[28]) || null;
    const laboratorio = s(r[30]) || null;

    out.push({
      local,
      facultad,
      carrera,
      carreraFull,
      ciclo,
      seccion,
      codigo,
      curso,
      tipo,
      modalidadCurso,
      horasT,
      horasP,
      horas,
      docente,
      modalidad,
      pabellon,
      aula,
      laboratorio,
      dia,
      hora,
      horaFin,
      horasAcad,
    });
    parsed++;
  }
  console.log(`  parsed=${parsed} skipped(no time/dia)=${skipped}`);
  return [out, existing];
}

(function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`No existe el XLSX: ${XLSX_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`No existe el JSON: ${JSON_PATH}`);
    process.exit(1);
  }

  console.log(
    `Importando ${path.basename(XLSX_PATH)} → planificacion-fcs-2026-1.json`,
  );
  console.log(`Locales: ${LOCAL_FILTERS.join(", ") || "(todos)"}`);

  const [newRows, existing] = parseSheet(XLSX_PATH);
  console.log(`  filas nuevas para los locales seleccionados: ${newRows.length}`);

  // Mantener el resto (otros locales) y reemplazar los locales seleccionados por las nuevas filas
  const filtersSet = new Set(LOCAL_FILTERS.map((x) => x.toUpperCase()));
  const kept = existing.filter(
    (e) => !filtersSet.has(String(e.local || "").toUpperCase()),
  );
  console.log(`  filas conservadas (otros locales): ${kept.length}`);
  console.log(`  filas reemplazadas: ${existing.length - kept.length}`);

  const final = [...kept, ...newRows];

  // Backup
  const backups = fs
    .readdirSync(path.dirname(JSON_PATH))
    .filter((f) => f.startsWith("planificacion-fcs-2026-1.json.bak"));
  const nextBak = `planificacion-fcs-2026-1.json.bak${backups.length + 1}`;
  fs.copyFileSync(JSON_PATH, path.join(path.dirname(JSON_PATH), nextBak));
  console.log(`  backup creado: ${nextBak}`);

  fs.writeFileSync(JSON_PATH, JSON.stringify(final, null, 2));
  console.log(`  escrito: ${JSON_PATH} (${final.length} filas totales)`);

  // Resumen rápido
  const docentesXAntes = existing.filter(
    (e) =>
      filtersSet.has(String(e.local || "").toUpperCase()) &&
      (!e.docente || /^x$/i.test(e.docente)),
  ).length;
  const docentesXDespues = newRows.filter(
    (e) => !e.docente || /^x$/i.test(e.docente),
  ).length;
  console.log(
    `  docentes "X" o vacíos antes: ${docentesXAntes}  → después: ${docentesXDespues}`,
  );
})();
