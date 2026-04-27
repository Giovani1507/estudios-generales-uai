import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Entry = {
  local: string;
  carrera: string;
  carreraFull: string;
  ciclo: string;
  seccion: string;
  codigo: string;
  curso: string;
  modalidadCurso: string;
  horasT: number;
  horasP: number;
  horas: number;
  docente: string;
  modalidad: string;
  tipo: string;
  dia: string;
  hora: string;
  horaFin: string;
  horasAcad: number;
  pabellon: string;
  aula: string;
  laboratorio: string;
};

const ARGS = process.argv.slice(2);
if (ARGS.length < 2) {
  console.error(
    "Uso: tsx scripts/import-planificacion-fica.ts <xlsx> <local> [<local>...]",
  );
  process.exit(1);
}
const XLSX_PATH = path.resolve(ARGS[0]);
const LOCAL_FILTERS = ARGS.slice(1).map((s) => s.toUpperCase().trim());

const JSON_PATH = path.resolve(
  __dirname,
  "../artifacts/school-portal/public/planificacion-fica-2026-1.json",
);

const DIA_MAP: Record<string, string> = {
  "1": "LUNES",
  "2": "MARTES",
  "3": "MIERCOLES",
  "4": "JUEVES",
  "5": "VIERNES",
  "6": "SABADO",
  "7": "DOMINGO",
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const s = (v: any) => (v == null ? "" : String(v).trim());
const upper = (v: any) => s(v).toUpperCase();
const numOrZero = (v: any) => {
  const n = Number(s(v));
  return Number.isFinite(n) ? n : 0;
};

function timeFromCols(hour: any, minute: any): string | null {
  const h = Number(s(hour));
  const m = Number(s(minute));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${pad2(h)}:${pad2(m)}`;
}

function buildCarreraFullMap(existing: Entry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of existing) {
    const k = upper(e.carrera);
    if (k && e.carreraFull && !map[k]) map[k] = e.carreraFull;
  }
  return map;
}

function detectHeaderRow(aoa: any[][]): number {
  for (let i = 0; i < Math.min(20, aoa.length); i++) {
    const row = aoa[i] || [];
    const joined = row.map((c: any) => upper(c)).join(" | ");
    if (
      joined.includes("LOCAL") &&
      joined.includes("PROGRAMA ACAD") &&
      joined.includes("CÓDIGO")
    ) {
      return i;
    }
  }
  return -1;
}

function findCol(headers: string[], regex: RegExp): number {
  for (let i = 0; i < headers.length; i++) {
    if (regex.test(headers[i])) return i;
  }
  return -1;
}

function parseSheet(filePath: string): { newRows: Entry[]; existing: Entry[] } {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((n) => /planificaci/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as any[][];

  const headerRow = detectHeaderRow(aoa);
  if (headerRow < 0) throw new Error("No se encontró fila de encabezados");
  const headers = (aoa[headerRow] || []).map((c: any) =>
    upper(c).replace(/\s+/g, " "),
  );

  const C = {
    local: findCol(headers, /^LOCAL$/),
    facultad: findCol(headers, /COD\s*FACULTAD/),
    carrera: findCol(headers, /PROGRAMA ACAD/),
    ciclo: findCol(headers, /^CICLO$/),
    seccion: findCol(headers, /^SECCI/),
    codigo: findCol(headers, /^C[ÓO]DIGO$/),
    curso: findCol(headers, /NOMBRE DE CURSO/),
    modalidadCurso: findCol(headers, /MODALIDAD DE CURSO/),
    horasT: findCol(headers, /HORAS TEOR/),
    horasP: findCol(headers, /HORAS PR[ÁA]CT/),
    totalHoras: findCol(headers, /TOTAL DE HORAS/),
    docente: findCol(headers, /APELLIDOS Y NOMBRES/),
    modalidad: findCol(headers, /MODALIDAD\s*\(/),
    pabellon: findCol(headers, /PABELLON/),
    aula: findCol(headers, /^AULA$/),
    laboratorio: findCol(headers, /^LABORATORIO$/),
    tipo: -1, // detect specially: there are 2 "TIPO DE CURSO" cols; pick the LATER one
    dia: findCol(headers, /^DIA$/),
    horaIni: findCol(headers, /^HORA INICIO$/),
    minIni: findCol(headers, /^MINUTO INICIO$/),
    horaFin: findCol(headers, /^HORA FIN$/),
    minFin: findCol(headers, /^MINUTO FIN$/),
    horasAcad: findCol(headers, /HORAS\s*ACADEM/),
  };

  // tipo (T/P/TP) — picking the second "TIPO DE CURSO" header (the per-session one near DIA)
  const tipoCols: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (/TIPO DE CURSO/.test(headers[i])) tipoCols.push(i);
  }
  C.tipo = tipoCols.length > 1 ? tipoCols[tipoCols.length - 1] : tipoCols[0];

  const required = [
    "local",
    "carrera",
    "ciclo",
    "seccion",
    "codigo",
    "curso",
    "docente",
    "dia",
    "horaIni",
    "minIni",
    "horaFin",
    "minFin",
  ];
  for (const k of required) {
    if ((C as any)[k] < 0) throw new Error(`Columna no encontrada: ${k}`);
  }

  const existing: Entry[] = fs.existsSync(JSON_PATH)
    ? JSON.parse(fs.readFileSync(JSON_PATH, "utf8"))
    : [];
  const carreraFullMap = buildCarreraFullMap(existing);

  const out: Entry[] = [];
  let parsed = 0,
    skipped = 0,
    noTime = 0;
  for (let i = headerRow + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const local = upper(r[C.local]);
    if (!local) continue;
    const facultad = upper(r[C.facultad]);
    if (facultad && facultad !== "FICA") continue; // solo FICA
    if (LOCAL_FILTERS.length > 0 && !LOCAL_FILTERS.includes(local)) continue;

    const carrera = upper(r[C.carrera]);
    const codigo = s(r[C.codigo]).replace(/\s+/g, "");
    const curso = s(r[C.curso]);
    const ciclo = s(r[C.ciclo]);
    const seccionRaw = upper(r[C.seccion]);
    if (!carrera || !codigo || !curso || !ciclo || !seccionRaw) {
      skipped++;
      continue;
    }
    const seccion = seccionRaw.replace(/[0-9]+$/, "") || seccionRaw;

    const docente = upper(r[C.docente]);
    const modalidad = upper(r[C.modalidad] || "PRESENCIAL");
    const modalidadCurso = s(r[C.modalidadCurso]) || "Presencial";

    const horasT = numOrZero(r[C.horasT]);
    const horasP = numOrZero(r[C.horasP]);
    const horas = numOrZero(r[C.totalHoras]) || horasT + horasP;
    const horasAcad = numOrZero(r[C.horasAcad]);

    const diaNum = s(r[C.dia]);
    const dia = DIA_MAP[diaNum] || upper(r[C.dia]) || "";
    const hora = timeFromCols(r[C.horaIni], r[C.minIni]);
    const horaFin = timeFromCols(r[C.horaFin], r[C.minFin]);
    if (!dia || !hora || !horaFin) {
      noTime++;
      continue;
    }

    const tipo = upper(r[C.tipo]) || "TP";
    const pabellon = s(r[C.pabellon]) || "";
    const aula = s(r[C.aula]) || "";
    const laboratorio = s(r[C.laboratorio]) || "";

    const carreraFull = carreraFullMap[carrera] || carrera;

    out.push({
      local,
      carrera,
      carreraFull,
      ciclo,
      seccion,
      codigo,
      curso,
      modalidadCurso,
      horasT,
      horasP,
      horas,
      docente,
      modalidad,
      tipo,
      dia,
      hora,
      horaFin,
      horasAcad,
      pabellon,
      aula,
      laboratorio,
    });
    parsed++;
  }
  console.log(
    `  parsed=${parsed} skipped=${skipped} sin_horario=${noTime}`,
  );
  return { newRows: out, existing };
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
    `Importando FICA ${path.basename(XLSX_PATH)} → planificacion-fica-2026-1.json`,
  );
  console.log(`Locales: ${LOCAL_FILTERS.join(", ") || "(todos)"}`);

  const { newRows, existing } = parseSheet(XLSX_PATH);
  console.log(`  filas nuevas FICA: ${newRows.length}`);

  const filtersSet = new Set(LOCAL_FILTERS.map((x) => x.toUpperCase()));
  const kept = existing.filter(
    (e) => !filtersSet.has(String(e.local || "").toUpperCase()),
  );
  console.log(`  filas conservadas (otros locales): ${kept.length}`);
  console.log(`  filas reemplazadas: ${existing.length - kept.length}`);

  const final = [...kept, ...newRows];

  const dir = path.dirname(JSON_PATH);
  const backups = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("planificacion-fica-2026-1.json.bak"));
  const nextBak = `planificacion-fica-2026-1.json.bak${backups.length + 1}`;
  fs.copyFileSync(JSON_PATH, path.join(dir, nextBak));
  console.log(`  backup creado: ${nextBak}`);

  fs.writeFileSync(JSON_PATH, JSON.stringify(final, null, 2));
  console.log(`  escrito: ${JSON_PATH} (${final.length} filas totales)`);

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
