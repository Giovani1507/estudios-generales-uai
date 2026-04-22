#!/usr/bin/env node
/**
 * Regenera SOLO planificacion-fcs-2026-1.json desde el Excel oficial
 * de FCS (Cynthia Martínez v2 final). NO toca FICA.
 *
 * Uso:
 *   node scripts/regenerar-fcs.cjs [<ruta-excel>]
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const inputXlsx = process.argv[2] ||
  "attached_assets/PLANIFICACION_PREGRADO_2026-1_FCS_CYNTHIA_MARTINEZ_v2_final_(_1776895283632.xlsx";
const outDir = "artifacts/school-portal/public";

const PROG_MAP = {
  EN: { carrera: "EN", carreraFull: "ENFERMERÍA" },
  OB: { carrera: "OB", carreraFull: "OBSTETRICIA" },
  PS: { carrera: "PS", carreraFull: "PSICOLOGÍA" },
  MH: { carrera: "MH", carreraFull: "MEDICINA HUMANA" },
  T1: { carrera: "T1", carreraFull: "TERAPIA DEL LENGUAJE" },
  T2: { carrera: "T2", carreraFull: "TERAPIA FÍSICA Y REHABILITACIÓN" },
  T3: { carrera: "T3", carreraFull: "FARMACIA Y BIOQUÍMICA" },
  T4: { carrera: "T4", carreraFull: "OPTOMETRÍA" },
};

const DIA_MAP = { 1:"LUNES", 2:"MARTES", 3:"MIERCOLES", 4:"JUEVES", 5:"VIERNES", 6:"SABADO", 7:"DOMINGO" };

const pad2 = (n) => String(n ?? "").padStart(2, "0");
const toHora = (h, m) => {
  const hh = Number(h);
  if (!Number.isFinite(hh)) return "";
  const mm = Number(m);
  return `${pad2(hh)}:${pad2(Number.isFinite(mm) ? mm : 0)}`;
};
const toNum = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const txt = (v) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

function leerFcs(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets["Planificación 2026-1"];
  if (!ws) throw new Error("No se encontró la hoja 'Planificación 2026-1'");
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const rows = [];
  const skipped = { sinFacultad: 0, sinDia: 0, sinDocente: 0, programaDesc: 0 };

  // Header en aoa[5], datos desde aoa[6]
  for (let r = 6; r < aoa.length; r++) {
    const row = aoa[r];
    const facultad = txt(row[5]).toUpperCase();
    if (facultad !== "FCS") { skipped.sinFacultad++; continue; }

    const programa = txt(row[6]).toUpperCase();
    const meta = PROG_MAP[programa];
    if (!meta) { skipped.programaDesc++; continue; }

    const docente = txt(row[22]);
    if (!docente) { skipped.sinDocente++; continue; }

    const diaNum = row[33];
    if (diaNum === "" || diaNum === null || diaNum === undefined) { skipped.sinDia++; continue; }
    const dia = DIA_MAP[Number(diaNum)] || "";
    if (!dia) { skipped.sinDia++; continue; }

    const ciclo   = txt(row[7]);
    const seccion = txt(row[9]).toUpperCase(); // sección base (A, B, …)
    const codigo  = txt(row[10]);
    const curso   = txt(row[11]);
    const tipoCur = txt(row[13]); // Obligatorio/Electivo
    const modCur  = txt(row[14]); // Presencial/Virtual/...
    const horasT  = toNum(row[15]);
    const horasP  = toNum(row[16]);
    const horas   = toNum(row[17]) || (horasT + horasP);
    const modDoc  = txt(row[23]).toUpperCase();
    const pabellon = txt(row[26]);
    const aula     = txt(row[27]);
    const lab      = txt(row[29]);
    const hora     = toHora(row[34], row[35]);
    const horaFin  = toHora(row[36], row[37]);
    const horasAcad = toNum(row[38]);

    const local = txt(row[4]).toUpperCase();

    rows.push({
      local,
      facultad: "FCS",
      carrera: meta.carrera,
      carreraFull: meta.carreraFull,
      ciclo,
      seccion,
      codigo,
      curso,
      tipo: tipoCur,
      modalidadCurso: modCur,
      horasT,
      horasP,
      horas,
      docente,
      modalidad: modDoc,
      pabellon: pabellon || null,
      aula: aula || null,
      laboratorio: lab || null,
      dia,
      hora,
      horaFin,
      horasAcad,
    });
  }

  return { rows, skipped };
}

const { rows, skipped } = leerFcs(inputXlsx);

const fcsPath = path.join(outDir, "planificacion-fcs-2026-1.json");

// Backup del JSON anterior (sin sobrescribir el .bak ya existente del cerrado)
if (fs.existsSync(fcsPath)) {
  const bakPath = fcsPath + ".bak2";
  fs.copyFileSync(fcsPath, bakPath);
  console.log(`  - Backup previo guardado en ${bakPath}`);
}

fs.writeFileSync(fcsPath, JSON.stringify(rows, null, 2));

const docs = new Set(rows.map(r => r.docente.toUpperCase()));
console.log("OK · regenerado FCS");
console.log(`  - FCS: ${rows.length} filas → ${fcsPath}`);
console.log(`  - Docentes únicos en JSON: ${docs.size}`);
console.log("  - Saltadas:", skipped);
