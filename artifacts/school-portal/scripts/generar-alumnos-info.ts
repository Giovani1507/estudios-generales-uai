/**
 * Genera artifacts/school-portal/public/alumnos-info-2026-1.json a partir
 * del Excel CONSOLIDADO de matrícula que descarga Recaudaciones.
 *
 * Uso:
 *   pnpm --filter @workspace/school-portal exec tsx scripts/generar-alumnos-info.ts <ruta-al-xlsx> [periodo]
 *
 * Ejemplos:
 *   pnpm --filter @workspace/school-portal exec tsx scripts/generar-alumnos-info.ts \
 *     "attached_assets/CONSOLIDADO_REGISTRO_DE_MATRÍCULA_-_RECAUDACIONES_PREGRADO_20_1778533921636.xlsx"
 *
 *   pnpm --filter @workspace/school-portal exec tsx scripts/generar-alumnos-info.ts ./consolidado.xlsx 2026-2
 *
 * Estructura esperada del consolidado:
 *   - Cabeceras en fila 7, datos desde fila 8
 *   - Col 4 = SEDE/FILIAL (ej. "SEDE CHINCHA ALTA", "FILIAL ICA")
 *   - Col 5 = CÓDIGO de alumno
 *   - Col 6 = NOMBRES completos
 *   - Col 21 = PROGRAMA (carrera)
 */
import ExcelJS from "exceljs";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SEDE_MAP: Record<string, string> = {
  "SEDE CHINCHA ALTA": "CHINCHA",
  "FILIAL ICA": "ICA",
  "FILIAL HUAURA": "HUAURA",
  "SUBSEDE SUNAMPE": "SUNAMPE",
  "POLO PORUMA": "PORUMA",
};

function normalizarSede(raw: string): string {
  const v = (raw || "").trim().toUpperCase();
  if (SEDE_MAP[v]) return SEDE_MAP[v];
  // Fallback: si contiene una palabra clave conocida
  for (const [k, val] of Object.entries(SEDE_MAP)) {
    if (v.includes(k.split(" ").pop() || "")) return val;
  }
  return v || "DESCONOCIDO";
}

async function main() {
  const inputPath = process.argv[2];
  const periodo = process.argv[3] || "2026-1";

  if (!inputPath) {
    console.error("❌ Falta la ruta al archivo xlsx.");
    console.error(
      "   Uso: tsx scripts/generar-alumnos-info.ts <ruta-al-xlsx> [periodo]",
    );
    process.exit(1);
  }

  const absInput = resolve(inputPath);
  console.log(`📄 Leyendo: ${absInput}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(absInput);
  const ws = wb.worksheets[0];
  if (!ws) {
    console.error("❌ El archivo no tiene hojas.");
    process.exit(1);
  }

  const out: Record<string, { codigo: string; carrera: string; local: string }> = {};
  let leidos = 0;

  // Datos desde fila 8 en adelante
  for (let r = 8; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const sedeRaw = String(row.getCell(4).value ?? "").trim();
    const codigo = String(row.getCell(5).value ?? "").trim();
    const nombres = String(row.getCell(6).value ?? "").trim().toUpperCase();
    const carrera = String(row.getCell(21).value ?? "").trim().toUpperCase();

    if (!nombres || !codigo) continue;

    out[nombres] = {
      codigo,
      carrera,
      local: normalizarSede(sedeRaw),
    };
    leidos++;
  }

  const outputPath = resolve(
    __dirname,
    `../public/alumnos-info-${periodo}.json`,
  );
  await writeFile(outputPath, JSON.stringify(out));

  console.log(`✅ ${leidos.toLocaleString()} alumnos procesados`);
  console.log(`💾 Escrito en: ${outputPath}`);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
