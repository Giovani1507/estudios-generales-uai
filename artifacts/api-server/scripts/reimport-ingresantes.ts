import ExcelJS from "exceljs";
import { db, pool } from "../../../lib/db/src/index";
import { ingresantesPagos } from "../../../lib/db/src/schema/ingresantes_pagos";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getCellText(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if ("result" in v) {
      const r = (v as any).result;
      if (r === null || r === undefined) return null;
      if (typeof r === "object" && r !== null && "richText" in r)
        return (r.richText as any[]).map((t: any) => t.text || "").join("").trim() || null;
      return String(r).trim() || null;
    }
    if ("richText" in v) return (v as any).richText.map((t: any) => t.text || "").join("").trim() || null;
    if ("error" in v) return null;
  }
  const s = String(v).trim();
  return s || null;
}

function padDni(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (!d || d.length > 9) return null;
  if (d.length === 7) return "0" + d;
  return d;
}

const wb = new ExcelJS.Workbook();
const excelPath = path.resolve(__dirname, "../../../attached_assets/Ingresantes_con_pagos_-_matricula_1775518888451.xlsx");
await wb.xlsx.readFile(excelPath);
const ws = wb.worksheets[0];

const records: typeof ingresantesPagos.$inferInsert[] = [];
const seen = new Set<string>();

ws.eachRow((row, r) => {
  if (r < 6) return;
  const rawDni = getCellText(row.getCell(4));
  if (!rawDni) return;
  const dni = padDni(rawDni);
  if (!dni || seen.has(dni)) return;
  seen.add(dni);

  const apellidos = getCellText(row.getCell(2));
  if (!apellidos || apellidos.toLowerCase().includes("object")) {
    console.warn(`Row ${r}: bad name "${apellidos}" for DNI ${dni} — skipping`);
    return;
  }

  records.push({
    dni,
    apellidos_nombres: apellidos,
    carrera: getCellText(row.getCell(8)),
    sede: getCellText(row.getCell(11)),
    modalidad_ingreso: getCellText(row.getCell(12)),
    modalidad_estudio: getCellText(row.getCell(16)),
    turno: getCellText(row.getCell(17)),
    seccion: getCellText(row.getCell(18)),
    codigo_estudiante: getCellText(row.getCell(3)),
    celular: getCellText(row.getCell(9)),
    correo: getCellText(row.getCell(10)),
    ciclo: "1",
  });
});

console.log(`Parsed ${records.length} valid records from Excel`);

await db.execute(sql`TRUNCATE TABLE ingresantes_pagos RESTART IDENTITY CASCADE`);
console.log("Table cleared.");

const BATCH = 100;
let inserted = 0;
for (let i = 0; i < records.length; i += BATCH) {
  await db.insert(ingresantesPagos).values(records.slice(i, i + BATCH));
  inserted += Math.min(BATCH, records.length - i);
}
console.log(`Inserted ${inserted} records.`);

const statsRes = await db.execute(sql`SELECT count(*) as total, count(celular) as con_celular, count(carrera) as con_carrera, count(codigo_estudiante) as con_codigo FROM ingresantes_pagos`);
console.log("Stats:", (statsRes as any).rows[0]);

const chk = await db.execute(sql`SELECT dni, apellidos_nombres, carrera, celular FROM ingresantes_pagos WHERE dni='61754206'`);
console.log("DNI 61754206:", (chk as any).rows[0]);

const all = await db.execute(sql`SELECT dni, apellidos_nombres, carrera, sede, modalidad_ingreso, modalidad_estudio, turno, seccion, codigo_estudiante, celular, correo FROM ingresantes_pagos ORDER BY id`);
const seedPath = path.resolve(__dirname, "../src/data/ingresantes-seed.json");
fs.writeFileSync(seedPath, JSON.stringify((all as any).rows, null, 0));
console.log(`Seed JSON updated with ${(all as any).rows.length} records`);

await pool.end();
