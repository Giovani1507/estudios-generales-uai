#!/usr/bin/env node
/**
 * Regenera planificacion-fica-2026-1.json y planificacion-fcs-2026-1.json
 * desde el Excel cerrado (DATA_CERRADA_..._PLANIFICACION_PREGRADO_2026-1).
 *
 * Uso:
 *   node scripts/regenerar-planificacion.js <ruta-excel>
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const inputXlsx = process.argv[2] ||
  "attached_assets/DATA_CERRADA_27-03-2026_PLANIFICACION_PREGRADO_2026-1_ACT_(10_1776892839897.xlsx";
const outDir = "artifacts/school-portal/public";

// Mapeo programa académico → carrera + carreraFull
const PROG_MAP = {
  // FICA
  AE: { carrera: "AE", carreraFull: "ADMINISTRACION DE EMPRESAS",  facultad: "FICA" },
  AF: { carrera: "AF", carreraFull: "ADMINISTRACION Y FINANZAS",   facultad: "FICA" },
  AR: { carrera: "AR", carreraFull: "ARQUITECTURA",                facultad: "FICA" },
  CA: { carrera: "CA", carreraFull: "CONTABILIDAD",                facultad: "FICA" },
  DE: { carrera: "DE", carreraFull: "DERECHO",                     facultad: "FICA" },
  IC: { carrera: "IC", carreraFull: "INGENIERIA CIVIL",            facultad: "FICA" },
  IN: { carrera: "IN", carreraFull: "INGENIERIA INDUSTRIAL",       facultad: "FICA" },
  IS: { carrera: "IS", carreraFull: "INGENIERIA DE SISTEMAS",      facultad: "FICA" },
  // FCS
  EN: { carrera: "EN", carreraFull: "ENFERMERÍA",                  facultad: "FCS"  },
  OB: { carrera: "OB", carreraFull: "OBSTETRICIA",                 facultad: "FCS"  },
  PS: { carrera: "PS", carreraFull: "PSICOLOGÍA",                  facultad: "FCS"  },
  MH: { carrera: "MH", carreraFull: "MEDICINA HUMANA",             facultad: "FCS"  },
  T1: { carrera: "T1", carreraFull: "TERAPIA DEL LENGUAJE",        facultad: "FCS"  },
  T2: { carrera: "T2", carreraFull: "TERAPIA FÍSICA Y REHABILITACIÓN", facultad: "FCS" },
  T3: { carrera: "T3", carreraFull: "FARMACIA Y BIOQUÍMICA",       facultad: "FCS"  },
  T4: { carrera: "T4", carreraFull: "OPTOMETRÍA",                  facultad: "FCS"  },
};

const DIA_MAP = { 1:"LUNES", 2:"MARTES", 3:"MIERCOLES", 4:"JUEVES", 5:"VIERNES", 6:"SABADO", 7:"DOMINGO" };

const pad2 = (n) => String(n ?? "").padStart(2, "0");
const toHora = (h, m) => {
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh)) return "";
  return `${pad2(hh)}:${pad2(Number.isFinite(mm) ? mm : 0)}`;
};
const toNum = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const txt = (v) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

function leerPlanificacion(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets["Planificación 2026-1"];
  if (!ws) throw new Error("No se encontró la hoja 'Planificación 2026-1'");
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const rowsFica = [];
  const rowsFcs  = [];
  const skipped  = { sinFacultad: 0, sinDia: 0, sinDocente: 0, programaDesc: 0 };

  // Cabecera está en aoa[4], datos desde aoa[5]
  for (let r = 5; r < aoa.length; r++) {
    const row = aoa[r];
    const facultad = txt(row[6]).toUpperCase();
    if (facultad !== "FICA" && facultad !== "FCS") { skipped.sinFacultad++; continue; }

    const programa = txt(row[7]).toUpperCase();
    const meta = PROG_MAP[programa];
    if (!meta) { skipped.programaDesc++; continue; }

    const docente = txt(row[22]);
    if (!docente) { skipped.sinDocente++; continue; }

    const diaNum = row[33];
    if (diaNum === "" || diaNum === null || diaNum === undefined) { skipped.sinDia++; continue; }
    const dia = DIA_MAP[Number(diaNum)] || "";
    if (!dia) { skipped.sinDia++; continue; }

    const ciclo   = txt(row[8]);
    const seccion = txt(row[9]).toUpperCase();
    const codigo  = txt(row[10]);
    const curso   = txt(row[11]);
    const tipoEst = txt(row[12]); // "Especifico"/"General"/"De Especialidad"/...
    const tipoCur = txt(row[13]); // "Obligatoria"/"Obligatorio"/"Electivo"
    const modCur  = txt(row[14]); // "Presencial"/"Virtual"/...
    const horasT  = toNum(row[15]);
    const horasP  = toNum(row[16]);
    const horas   = toNum(row[17]) || (horasT + horasP);
    const modDoc  = txt(row[23]).toUpperCase();
    const turno   = txt(row[24]).toUpperCase();
    const pabellon = txt(row[26]);
    const aula     = txt(row[27]);
    const lab      = txt(row[29]);
    const tipoSeg  = txt(row[32]).toUpperCase(); // TP/T/P
    const hora     = toHora(row[34], row[35]);
    const horaFin  = toHora(row[36], row[37]);
    const horasAcad = toNum(row[38]);

    const local = txt(row[5]).toUpperCase();

    // Schema FICA (sin "facultad", tipo = TP/T/P)
    const baseFica = {
      local,
      carrera: meta.carrera,
      carreraFull: meta.carreraFull,
      ciclo,
      seccion,
      codigo,
      curso,
      modalidadCurso: modCur,
      horasT,
      horasP,
      horas,
      docente,
      modalidad: modDoc,
      tipo: tipoSeg,
      dia,
      hora,
      horaFin,
      horasAcad,
      pabellon,
      aula,
      laboratorio: lab,
    };

    // Schema FCS (con "facultad", tipo = Obligatorio/Electivo, pabellon/aula/lab pueden ser null)
    const baseFcs = {
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
    };

    if (meta.facultad === "FICA") rowsFica.push(baseFica);
    else                          rowsFcs.push(baseFcs);
  }

  return { rowsFica, rowsFcs, skipped };
}

const { rowsFica, rowsFcs, skipped } = leerPlanificacion(inputXlsx);

const ficaPath = path.join(outDir, "planificacion-fica-2026-1.json");
const fcsPath  = path.join(outDir, "planificacion-fcs-2026-1.json");

// Backups
for (const p of [ficaPath, fcsPath]) {
  if (fs.existsSync(p)) fs.copyFileSync(p, p + ".bak");
}

fs.writeFileSync(ficaPath, JSON.stringify(rowsFica, null, 2));
fs.writeFileSync(fcsPath,  JSON.stringify(rowsFcs,  null, 2));

console.log("OK · regenerado");
console.log(`  - FICA: ${rowsFica.length} filas → ${ficaPath}`);
console.log(`  - FCS : ${rowsFcs.length} filas → ${fcsPath}`);
console.log("  - Saltadas:", skipped);
