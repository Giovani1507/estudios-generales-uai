#!/usr/bin/env node
/**
 * Importa planificacion-fica-2026-1.json y planificacion-fcs-2026-1.json
 * desde los nuevos Excel de FICA y FCS (formato actualizado 2026-1).
 *
 * DIFERENCIAS vs regenerar-planificacion.cjs:
 *  - DIA_MAP: nuevo Excel usa 1=DOMINGO (Sunday-based WEEKDAY), antes era 1=LUNES
 *  - FCS: columna extra "nd" en posición 10 desplaza todo +1 desde col 10
 *  - FCS: encabezado en fila 5 (índice 5), datos desde fila 6 (índice 6)
 *  - horasAcad: valor float, se redondea con Math.round()
 *
 * Uso:
 *   node scripts/import-planificacion-2026-1.cjs [fica.xlsx] [fcs.xlsx]
 */
const fs   = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ficaXlsx = process.argv[2] ||
  "attached_assets/PLANIFICACION_DE_FICA_1778178188887.xlsx";
const fcsXlsx  = process.argv[3] ||
  "attached_assets/PLANIFICACION_DE_FCS_1778178188886.xlsx";

const outPublic  = "artifacts/school-portal/public";
const outApiData = "artifacts/api-server/src/data";

// ── DIA_MAP: Excel WEEKDAY(date,1) → Sunday=1, Monday=2, …, Saturday=7 ─────
const DIA_MAP = {
  1: "DOMINGO",
  2: "LUNES",
  3: "MARTES",
  4: "MIERCOLES",
  5: "JUEVES",
  6: "VIERNES",
  7: "SABADO",
};

const PROG_MAP = {
  AE: { carrera: "AE", carreraFull: "ADMINISTRACION DE EMPRESAS",       facultad: "FICA" },
  AF: { carrera: "AF", carreraFull: "ADMINISTRACION Y FINANZAS",        facultad: "FICA" },
  AR: { carrera: "AR", carreraFull: "ARQUITECTURA",                     facultad: "FICA" },
  CA: { carrera: "CA", carreraFull: "CONTABILIDAD",                     facultad: "FICA" },
  DE: { carrera: "DE", carreraFull: "DERECHO",                          facultad: "FICA" },
  IC: { carrera: "IC", carreraFull: "INGENIERIA CIVIL",                 facultad: "FICA" },
  IN: { carrera: "IN", carreraFull: "INGENIERIA INDUSTRIAL",            facultad: "FICA" },
  IS: { carrera: "IS", carreraFull: "INGENIERIA DE SISTEMAS",           facultad: "FICA" },
  EN: { carrera: "EN", carreraFull: "ENFERMERÍA",                       facultad: "FCS"  },
  OB: { carrera: "OB", carreraFull: "OBSTETRICIA",                      facultad: "FCS"  },
  PS: { carrera: "PS", carreraFull: "PSICOLOGÍA",                       facultad: "FCS"  },
  MH: { carrera: "MH", carreraFull: "MEDICINA HUMANA",                  facultad: "FCS"  },
  T1: { carrera: "T1", carreraFull: "TERAPIA DEL LENGUAJE",             facultad: "FCS"  },
  T2: { carrera: "T2", carreraFull: "TERAPIA FÍSICA Y REHABILITACIÓN",  facultad: "FCS"  },
  T3: { carrera: "T3", carreraFull: "FARMACIA Y BIOQUÍMICA",            facultad: "FCS"  },
  T4: { carrera: "T4", carreraFull: "OPTOMETRÍA",                       facultad: "FCS"  },
};

const pad2   = (n) => String(n ?? "").padStart(2, "0");
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

// ── FICA ─────────────────────────────────────────────────────────────────────
// Encabezado: fila 4 (índice 4). Datos: desde fila 5 (índice 5).
// Columnas (sin desplazamiento):
//  [5]=local [6]=facultad [7]=programa [8]=ciclo [9]=sección [10]=código
//  [11]=curso [12]=tipoEst [13]=tipoCur [14]=modCur [15]=horasT [16]=horasP
//  [17]=horas [18]=creditos [22]=docente [23]=modDoc [26]=pabellón [27]=aula
//  [29]=lab [32]=tipoSeg [33]=día [34]=hIni [35]=mIni [36]=hFin [37]=mFin [38]=horasAcad
function leerFica(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets["Planificación 2026-1"];
  if (!ws) throw new Error("FICA: no se encontró la hoja 'Planificación 2026-1'");
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const rows = [];
  const skipped = { sinFacultad: 0, sinCiclo12: 0, sinDocente: 0, sinDia: 0, sinProg: 0 };

  for (let r = 5; r < aoa.length; r++) {
    const row = aoa[r];
    const fac = txt(row[6]).toUpperCase();
    if (fac !== "FICA") { skipped.sinFacultad++; continue; }

    const ciclo = txt(row[8]);
    if (ciclo !== "1" && ciclo !== "2") { skipped.sinCiclo12++; continue; }

    const docente = txt(row[22]);
    if (!docente) { skipped.sinDocente++; continue; }

    const diaRaw = row[33];
    if (diaRaw === "" || diaRaw === null || diaRaw === undefined) { skipped.sinDia++; continue; }
    const dia = DIA_MAP[Number(diaRaw)] || "";
    if (!dia) { skipped.sinDia++; continue; }

    const programa = txt(row[7]).toUpperCase();
    const meta     = PROG_MAP[programa];
    if (!meta) { skipped.sinProg++; continue; }

    const horasT    = toNum(row[15]);
    const horasP    = toNum(row[16]);
    const horas     = toNum(row[17]) || (horasT + horasP);
    const horasAcad = Math.round(toNum(row[38])) || horas;

    rows.push({
      local:          txt(row[5]).toUpperCase(),
      facultad:       "FICA",
      carrera:        meta.carrera,
      carreraFull:    meta.carreraFull,
      ciclo,
      seccion:        txt(row[9]).toUpperCase(),
      codigo:         txt(row[10]),
      curso:          txt(row[11]),
      tipo:           txt(row[13]),
      modalidadCurso: txt(row[14]),
      horasT,
      horasP,
      horas,
      docente,
      modalidad:      txt(row[23]).toUpperCase(),
      pabellon:       txt(row[26]) || null,
      aula:           txt(row[27]) || null,
      laboratorio:    txt(row[29]) || null,
      dia,
      hora:           toHora(row[34], row[35]),
      horaFin:        toHora(row[36], row[37]),
      horasAcad,
    });
  }
  return { rows, skipped };
}

// ── FCS ──────────────────────────────────────────────────────────────────────
// Encabezado: fila 5 (índice 5). Datos: desde fila 6 (índice 6).
// Columna extra "nd" en posición 10 → todo desde col 10 se desplaza +1:
//  [5]=local [6]=facultad [7]=programa [8]=ciclo [9]=sección [11]=código
//  [12]=curso [13]=tipoEst [14]=tipoCur [15]=modCur [16]=horasT [17]=horasP
//  [18]=horas [19]=creditos [23]=docente [24]=modDoc [27]=pabellón [28]=aula
//  [30]=lab [33]=tipoSeg [34]=día [35]=hIni [36]=mIni [37]=hFin [38]=mFin [39]=horasAcad
function leerFcs(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets["Planificación 2026-1"];
  if (!ws) throw new Error("FCS: no se encontró la hoja 'Planificación 2026-1'");
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const rows = [];
  const skipped = { sinFacultad: 0, sinCiclo12: 0, sinDocente: 0, sinDia: 0, sinProg: 0 };

  for (let r = 6; r < aoa.length; r++) {
    const row = aoa[r];
    const fac = txt(row[6]).toUpperCase();
    if (fac !== "FCS") { skipped.sinFacultad++; continue; }

    const ciclo = txt(row[8]);
    if (ciclo !== "1" && ciclo !== "2") { skipped.sinCiclo12++; continue; }

    const docente = txt(row[23]);
    if (!docente) { skipped.sinDocente++; continue; }

    const diaRaw = row[34];
    if (diaRaw === "" || diaRaw === null || diaRaw === undefined) { skipped.sinDia++; continue; }
    const dia = DIA_MAP[Number(diaRaw)] || "";
    if (!dia) { skipped.sinDia++; continue; }

    const programa = txt(row[7]).toUpperCase();
    const meta     = PROG_MAP[programa];
    if (!meta) { skipped.sinProg++; continue; }

    const horasT    = toNum(row[16]);
    const horasP    = toNum(row[17]);
    const horas     = toNum(row[18]) || (horasT + horasP);
    const horasAcad = Math.round(toNum(row[39])) || horas;

    rows.push({
      local:          txt(row[5]).toUpperCase(),
      facultad:       "FCS",
      carrera:        meta.carrera,
      carreraFull:    meta.carreraFull,
      ciclo,
      seccion:        txt(row[9]).toUpperCase(),
      codigo:         txt(row[11]),
      curso:          txt(row[12]),
      tipo:           txt(row[14]),
      modalidadCurso: txt(row[15]),
      horasT,
      horasP,
      horas,
      docente,
      modalidad:      txt(row[24]).toUpperCase(),
      pabellon:       txt(row[27]) || null,
      aula:           txt(row[28]) || null,
      laboratorio:    txt(row[30]) || null,
      dia,
      hora:           toHora(row[35], row[36]),
      horaFin:        toHora(row[37], row[38]),
      horasAcad,
    });
  }
  return { rows, skipped };
}

// ── Ejecutar ─────────────────────────────────────────────────────────────────
console.log("📥 Importando FICA desde:", ficaXlsx);
const { rows: ficaRows, skipped: ficaSkip } = leerFica(ficaXlsx);

console.log("📥 Importando FCS  desde:", fcsXlsx);
const { rows: fcsRows,  skipped: fcsSkip  } = leerFcs(fcsXlsx);

const ficaPublic  = path.join(outPublic,  "planificacion-fica-2026-1.json");
const fcsPublic   = path.join(outPublic,  "planificacion-fcs-2026-1.json");
const ficaApi     = path.join(outApiData, "planificacion-fica-2026-1.json");
const fcsApi      = path.join(outApiData, "planificacion-fcs-2026-1.json");

for (const p of [ficaPublic, fcsPublic, ficaApi, fcsApi]) {
  if (fs.existsSync(p)) fs.copyFileSync(p, p + ".bak");
}

fs.writeFileSync(ficaPublic, JSON.stringify(ficaRows, null, 2));
fs.writeFileSync(fcsPublic,  JSON.stringify(fcsRows,  null, 2));
fs.copyFileSync(ficaPublic, ficaApi);
fs.copyFileSync(fcsPublic,  fcsApi);

const ficaDocs = new Set(ficaRows.map(r => r.docente.trim().toUpperCase()));
const fcsDocs  = new Set(fcsRows.map(r => r.docente.trim().toUpperCase()));

console.log(`\n✅ FICA: ${ficaRows.length} filas | ${ficaDocs.size} docentes únicos`);
console.log(`   Saltadas:`, ficaSkip);
console.log(`✅ FCS:  ${fcsRows.length} filas | ${fcsDocs.size} docentes únicos`);
console.log(`   Saltadas:`, fcsSkip);
console.log(`\n📁 Archivos actualizados en:`);
console.log(`   ${ficaPublic}`);
console.log(`   ${fcsPublic}`);
console.log(`   ${ficaApi}`);
console.log(`   ${fcsApi}`);
