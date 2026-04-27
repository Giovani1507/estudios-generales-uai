import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { db, pool } from "../../../lib/db/src/index";
import { delegadosTable } from "../../../lib/db/src/schema/delegados";
import { sql } from "drizzle-orm";

const ARGS = process.argv.slice(2);
if (ARGS.length < 1) {
  console.error("Uso: tsx scripts/import-delegados.ts <xlsx>");
  process.exit(1);
}
const XLSX_PATH = path.resolve(ARGS[0]);

const s = (v: any) => (v == null ? "" : String(v).trim());
const upper = (v: any) => s(v).toUpperCase();
const lower = (v: any) => s(v).toLowerCase();
const normName = (v: any) => upper(v).replace(/\s+/g, " ");

(async function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`No existe el XLSX: ${XLSX_PATH}`);
    process.exit(1);
  }
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH), { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((n) => /delegad/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as any[][];

  // Detectar fila de encabezados ("N°", "Tipo", "Apellidos y Nombres", ...)
  let headerRow = -1;
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const row = (aoa[i] || []).map((c) => upper(c));
    if (row.includes("TIPO") && row.some((c) => /APELLIDOS/.test(c))) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) {
    console.error("No se encontró fila de encabezados");
    process.exit(1);
  }
  const headers = (aoa[headerRow] || []).map((c) => upper(c));
  const C = {
    tipo: headers.findIndex((h: string) => /^TIPO$/.test(h)),
    nombre: headers.findIndex((h: string) => /APELLIDOS/.test(h)),
    carrera: headers.findIndex((h: string) => /^CARRERA$/.test(h)),
    ciclo: headers.findIndex((h: string) => /^CICLO$/.test(h)),
    seccion: headers.findIndex((h: string) => /SECCI[ÓO]N/.test(h)),
    sede: headers.findIndex((h: string) => /^SEDE$/.test(h)),
    celular: headers.findIndex((h: string) => /^CELULAR$/.test(h) || /N[ÚU]MERO/.test(h)),
    correo: headers.findIndex((h: string) => /CORREO/.test(h) || /EMAIL/.test(h)),
  };

  let creados = 0,
    duplicadosExistentes = 0,
    duplicadosArchivo = 0,
    invalidos = 0;
  const seenInFile = new Set<string>();

  for (let i = headerRow + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const nombreRaw = s(r[C.nombre]);
    if (!nombreRaw) continue;
    const carrera = upper(r[C.carrera]);
    const ciclo = s(r[C.ciclo]);
    const seccion = upper(r[C.seccion]);
    if (!carrera || !ciclo || !seccion) {
      invalidos++;
      continue;
    }

    const tipoVal =
      upper(r[C.tipo]) === "SUB DELEGADO" ? "SUB DELEGADO" : "DELEGADO";
    const nombre = normName(nombreRaw);
    const correo = lower(r[C.correo]) || null;
    const numero = s(r[C.celular]) || null;
    const sede = upper(r[C.sede]) || null;

    const dedupeKey = `${nombre}|${correo || ""}`;
    if (seenInFile.has(dedupeKey)) {
      duplicadosArchivo++;
      continue;
    }
    seenInFile.add(dedupeKey);

    const existentes = await db
      .select()
      .from(delegadosTable)
      .where(
        correo
          ? sql`UPPER(REGEXP_REPLACE(TRIM(${delegadosTable.apellidosNombres}), '\\s+', ' ', 'g')) = ${nombre} OR LOWER(${delegadosTable.correo}) = ${correo}`
          : sql`UPPER(REGEXP_REPLACE(TRIM(${delegadosTable.apellidosNombres}), '\\s+', ' ', 'g')) = ${nombre}`,
      );
    if (existentes.length > 0) {
      duplicadosExistentes++;
      continue;
    }

    await db.insert(delegadosTable).values({
      tipo: tipoVal,
      apellidosNombres: nombre,
      carrera,
      ciclo,
      seccion,
      numero,
      correo,
      sede,
    });
    creados++;
  }

  console.log(`Importación delegados terminada:`);
  console.log(`  creados:                   ${creados}`);
  console.log(`  duplicados (en BD):        ${duplicadosExistentes}`);
  console.log(`  duplicados (en archivo):   ${duplicadosArchivo}`);
  console.log(`  filas inválidas/sin datos: ${invalidos}`);
  process.exit(0);
})().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
