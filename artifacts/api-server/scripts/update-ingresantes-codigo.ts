/**
 * Script to update ingresantes_pagos with CODIGO_ESTUDIANTE, CELULAR, CORREO
 * Usage: pnpm --filter @workspace/api-server exec tsx scripts/update-ingresantes-codigo.ts <excel_path>
 *
 * The Excel must have columns:
 *   N°  |  APELLIDOS Y NOMBRES  |  CODIGO DE ESTUDIANTE  |  DNI  |  PLAN  |  COD. PROGRAMA  |  COD. PRO  |  CARRERA  |  NUMERO DE CELULAR  |  CORREO
 */

import ExcelJS from "exceljs";
import postgres from "postgres";

const excelPath = process.argv[2];
if (!excelPath) {
  console.error("Usage: tsx scripts/update-ingresantes-codigo.ts <path_to_excel>");
  process.exit(1);
}

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const ws = wb.worksheets[0];

  // Detect header row — find row with "CODIGO" and "DNI"
  let headerRow = -1;
  let colMap: Record<string, number> = {};
  ws.eachRow((row, rowNum) => {
    if (headerRow !== -1) return;
    const vals: string[] = [];
    row.eachCell(c => vals.push(String(c.value || "").toUpperCase().trim()));
    if (vals.some(v => v.includes("CODIGO")) && vals.some(v => v === "DNI")) {
      headerRow = rowNum;
      vals.forEach((v, i) => {
        if (v.includes("CODIGO") && v.includes("ESTUDIANTE")) colMap["codigo"]  = i;
        if (v === "DNI")                                       colMap["dni"]     = i;
        if (v.includes("CELULAR") || v.includes("TELÉFONO"))  colMap["celular"] = i;
        if (v.includes("CORREO") || v.includes("EMAIL"))      colMap["correo"]  = i;
      });
      console.log("Header row:", rowNum, "| Cols:", JSON.stringify(colMap));
    }
  });

  if (headerRow === -1) {
    console.error("Could not detect header row. Check the Excel format.");
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL);
  let updated = 0;
  let notFound = 0;

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const getCellVal = (idx: number) => {
      const c = row.getCell(idx + 1);
      const v = c.value;
      if (v === null || v === undefined) return null;
      if (typeof v === "object" && "richText" in v) {
        return (v as any).richText.map((t: any) => t.text).join("").trim() || null;
      }
      return String(v).trim() || null;
    };

    const dni = getCellVal(colMap["dni"]);
    if (!dni || !/^\d{6,8}$/.test(dni.replace(/\D/g, ""))) continue;
    const dniClean = dni.replace(/\D/g, "").padStart(8, "0");

    const codigo  = colMap["codigo"]  !== undefined ? getCellVal(colMap["codigo"])  : null;
    const celular = colMap["celular"] !== undefined ? getCellVal(colMap["celular"]) : null;
    const correo  = colMap["correo"]  !== undefined ? getCellVal(colMap["correo"])  : null;

    const result = await sql`
      UPDATE ingresantes_pagos
      SET
        codigo_estudiante = ${codigo},
        celular           = ${celular},
        correo            = ${correo}
      WHERE dni = ${dniClean}
      RETURNING id
    `;
    if (result.length > 0) {
      updated++;
    } else {
      notFound++;
    }
  }

  await sql.end();
  console.log(`Done. Updated: ${updated} | Not found: ${notFound}`);
}

main().catch(e => { console.error(e); process.exit(1); });
