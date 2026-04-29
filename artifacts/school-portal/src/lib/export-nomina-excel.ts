import * as ExcelJS from "exceljs";
import type { NominaGrupo } from "./parse-nomina-pdf";

const NAVY = "FF1E3A8A";
const HDR_BG = "FF1E40AF";
const PARENT_BG = "FFDCE6F1";
const ZEBRA_A = "FFFFFFFF";
const ZEBRA_B = "FFF5F7FF";
const SUMMARY_HDR_BG = "FF305496";

const sf = (argb: string): ExcelJS.Fill => ({
  type: "pattern", pattern: "solid", fgColor: { argb },
});
const THIN: Partial<ExcelJS.Borders> = {
  top:    { style: "thin", color: { argb: "FFCFCFCF" } },
  bottom: { style: "thin", color: { argb: "FFCFCFCF" } },
  left:   { style: "thin", color: { argb: "FFCFCFCF" } },
  right:  { style: "thin", color: { argb: "FFCFCFCF" } },
};
const MED: Partial<ExcelJS.Borders> = {
  top:    { style: "medium", color: { argb: NAVY } },
  bottom: { style: "medium", color: { argb: NAVY } },
  left:   { style: "medium", color: { argb: NAVY } },
  right:  { style: "medium", color: { argb: NAVY } },
};
const CTR: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
const LEFT: Partial<ExcelJS.Alignment> = { horizontal: "left", vertical: "middle", wrapText: true };

// ─── PRIMER CICLO sheet ────────────────────────────────────────────────────
function buildCicloSheet(
  ws: ExcelJS.Worksheet,
  ciclo: 1 | 2,
  grupos: NominaGrupo[],
  periodo: string,
) {
  // Column widths (10 cols A-J)
  const widths = [8, 36, 14, 12, 14, 12, 16, 14, 18, 14];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Title row 3 (A3:J3 merged)
  ws.mergeCells("A3:J3");
  const title = ws.getCell("A3");
  title.value = `ALUMNOS MATRICULADOS EEGG ${periodo} — CICLO ${ciclo}`;
  title.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  title.fill = sf(NAVY);
  title.alignment = CTR;
  title.border = MED;
  ws.getRow(3).height = 28;

  // Header row 4
  const headers = [
    "CICLO", "CARRERA", "MODALIDAD", "LOCAL", "SECCIÓN", "TURNO",
    "ESTUDIANTES MATRICULADOS",
    "RETIRADOS POR OCTDA",
    "RETIRADOS POR INASISTENCIA",
    "TOTAL ACTIVOS",
  ];
  headers.forEach((h, i) => {
    const cell = ws.getRow(4).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    cell.fill = sf(HDR_BG);
    cell.alignment = CTR;
    cell.border = MED;
  });
  ws.getRow(4).height = 36;

  // Data rows
  let r = 5;
  let zebra = 0;
  for (const g of grupos) {
    // Parent row
    const parent = [
      g.ciclo, g.carrera, g.modalidad, g.local, g.seccion, g.turno,
      g.matriculados, g.retOctda, g.retInasist, g.totalActivos,
    ];
    parent.forEach((v, i) => {
      const cell = ws.getRow(r).getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { bold: true, size: 10, color: { argb: "FF1E293B" }, name: "Calibri" };
      cell.fill = sf(PARENT_BG);
      cell.alignment = i === 1 ? LEFT : CTR;
      cell.border = THIN;
    });
    ws.getRow(r).height = 22;
    r++;

    // Curso rows
    for (const c of g.cursos) {
      const bg = (zebra++ % 2 === 0) ? ZEBRA_A : ZEBRA_B;
      const row = [
        "", c.nombre, "", "", c.seccion, "",
        c.matriculados, c.retOctda, c.retInasist, c.totalActivos,
      ];
      row.forEach((v, i) => {
        const cell = ws.getRow(r).getCell(i + 1);
        cell.value = v as ExcelJS.CellValue;
        cell.font = { size: 9.5, color: { argb: "FF334155" }, name: "Calibri" };
        cell.fill = sf(bg);
        cell.alignment = i === 1 ? LEFT : CTR;
        cell.border = THIN;
      });
      ws.getRow(r).height = 18;
      r++;
    }
  }
}

// ─── HOJA RESUMEN ──────────────────────────────────────────────────────────
type ResumenRow = {
  carrera: string;
  matriculados: number;
  octda: number;
  inasist: number;
  activos: number;
};

function aggregateBy(grupos: NominaGrupo[], localFilter: string[]): ResumenRow[] {
  const map = new Map<string, ResumenRow>();
  for (const g of grupos) {
    if (!localFilter.includes(g.local)) continue;
    if (!map.has(g.carrera)) {
      map.set(g.carrera, { carrera: g.carrera, matriculados: 0, octda: 0, inasist: 0, activos: 0 });
    }
    const r = map.get(g.carrera)!;
    r.matriculados += g.matriculados;
    r.octda        += g.retOctda;
    r.inasist      += g.retInasist;
    r.activos      += g.totalActivos;
  }
  return Array.from(map.values()).sort((a, b) => a.carrera.localeCompare(b.carrera));
}

function buildResumenSheet(ws: ExcelJS.Worksheet, grupos: NominaGrupo[]) {
  const widths = [8, 36, 14, 14, 14, 12, 14, 14, 14, 14, 8];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  function block(startRow: number, titulo: string, ciclo: number, rows: ResumenRow[]) {
    // Section title bar (B..F merged)
    ws.mergeCells(startRow, 2, startRow, 6);
    const t = ws.getCell(startRow, 2);
    t.value = titulo;
    t.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    t.fill = sf(SUMMARY_HDR_BG); t.alignment = CTR; t.border = MED;
    ws.mergeCells(startRow, 7, startRow, 11);
    const t2 = ws.getCell(startRow, 7);
    t2.value = "RESULTADOS DE %";
    t2.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    t2.fill = sf(SUMMARY_HDR_BG); t2.alignment = CTR; t2.border = MED;
    ws.getRow(startRow).height = 24;

    // Header row
    const hdr = ["", "Carrera", "Matriculados", "Por Inasistencia", "Por OCTDA", "Activos",
      "% MATRICULADOS", "% NO ASISTENTES", "% OCTDA", "% ACTIVOS", "%"];
    hdr.forEach((h, i) => {
      const c = ws.getRow(startRow + 1).getCell(i + 1);
      c.value = h;
      c.font = { bold: true, size: 9.5, color: { argb: NAVY }, name: "Calibri" };
      c.fill = sf("FFE0E7FF"); c.alignment = CTR; c.border = MED;
    });
    ws.getRow(startRow + 1).height = 28;

    let totalMat = 0, totalOct = 0, totalIna = 0, totalAct = 0;
    rows.forEach((row, idx) => {
      const r = startRow + 2 + idx;
      const ratioInas = row.matriculados > 0 ? row.inasist / row.matriculados : 0;
      const ratioOct  = row.matriculados > 0 ? row.octda / row.matriculados : 0;
      const ratioAct  = row.matriculados > 0 ? row.activos / row.matriculados : 0;
      const vals: (string | number)[] = [
        idx === 0 ? ciclo : "",
        row.carrera,
        row.matriculados, row.inasist, row.octda, row.activos,
        1, ratioInas, ratioOct, ratioAct, ratioInas + ratioOct + ratioAct,
      ];
      vals.forEach((v, i) => {
        const c = ws.getRow(r).getCell(i + 1);
        c.value = v as ExcelJS.CellValue;
        c.font = { size: 9.5, color: { argb: "FF334155" }, name: "Calibri" };
        c.fill = sf(idx % 2 === 0 ? ZEBRA_A : ZEBRA_B);
        c.alignment = i === 1 ? LEFT : CTR;
        c.border = THIN;
        if (i >= 6) c.numFmt = "0.00%";
      });
      totalMat += row.matriculados;
      totalOct += row.octda;
      totalIna += row.inasist;
      totalAct += row.activos;
    });

    // Total row
    const totalRow = startRow + 2 + rows.length;
    const totals = ["", "TOTAL", totalMat, totalIna, totalOct, totalAct, "", "", "", "", ""];
    totals.forEach((v, i) => {
      const c = ws.getRow(totalRow).getCell(i + 1);
      c.value = v as ExcelJS.CellValue;
      c.font = { bold: true, size: 10, color: { argb: NAVY }, name: "Calibri" };
      c.fill = sf("FFDDE9F8"); c.alignment = i === 1 ? LEFT : CTR; c.border = MED;
    });

    return totalRow + 2;
  }

  // Block per ciclo + region
  let row = 2;
  for (const ciclo of [1, 2] as const) {
    const grpCiclo = grupos.filter(g => g.ciclo === ciclo);
    const huaura = aggregateBy(grpCiclo, ["HUACHO"]);
    const sede   = aggregateBy(grpCiclo, ["SEDE", "FILIAL"]);
    if (huaura.length) row = block(row, `CICLO ${ciclo} — HUAURA`, ciclo, huaura);
    if (sede.length)   row = block(row, `CICLO ${ciclo} — SEDE / SUNAMPE`, ciclo, sede);
  }
}

// ─── Public export ────────────────────────────────────────────────────────
export async function exportNominaXlsx(
  carrera: string,
  periodo: string,
  grupos: NominaGrupo[],
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Portal Académico UAI";
  wb.created = new Date();

  const ws1 = wb.addWorksheet("PRIMER CICLO", { views: [{ state: "frozen", ySplit: 4 }] });
  buildCicloSheet(ws1, 1, grupos.filter(g => g.ciclo === 1), periodo);

  const ws2 = wb.addWorksheet("SEGUNDO CICLO", { views: [{ state: "frozen", ySplit: 4 }] });
  buildCicloSheet(ws2, 2, grupos.filter(g => g.ciclo === 2), periodo);

  const ws3 = wb.addWorksheet("HOJA RESUMEN", { views: [{ state: "frozen", ySplit: 1 }] });
  buildResumenSheet(ws3, grupos);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NOMINA_${carrera.replace(/\s+/g, "_")}_${periodo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
