import ExcelJS from "exceljs";

const UAI_BLUE   = "FF2F5AA6";
const UAI_BLUE_L = "FFD6E4F7";
const WHITE      = "FFFFFFFF";
const GRAY_HDR   = "FFF0F4FA";

async function fetchLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch("/logo-uai.png");
    const blob = await resp.blob();
    return await new Promise((res) => {
      const reader = new FileReader();
      reader.onload = () => res((reader.result as string).split(",")[1]);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface ColDef {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
  align?: "left" | "center" | "right";
}

export interface ExportOptions {
  sheetTitle: string;       // e.g. "Docentes FICA 2026-1"
  institution: string;      // e.g. "Universidad Autónoma de Ica"
  subtitle?: string;        // e.g. "Registro oficial · Semestre 2026-1"
  columns: ColDef[];
  rows: Record<string, unknown>[];
  fileName: string;         // without extension
}

export async function exportExcelWithLogo(opts: ExportOptions): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator  = "Portal Académico UAI";
  wb.created  = new Date();

  const ws = wb.addWorksheet(opts.sheetTitle, {
    pageSetup: { orientation: "landscape", fitToPage: true },
  });

  // ── Logo ──────────────────────────────────────────────────────────────────
  const logoBase64 = await fetchLogoBase64();
  const COL_OFFSET = 1; // A
  let dataStartRow = 5;

  if (logoBase64) {
    const imageId = wb.addImage({ base64: logoBase64, extension: "png" });
    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 72, height: 72 },
      editAs: "oneCell",
    });
    dataStartRow = 5;
  }

  // ── Institution header ────────────────────────────────────────────────────
  const lastCol = opts.columns.length;

  // Row 1: University name (merged)
  ws.mergeCells(1, COL_OFFSET, 1, lastCol);
  const r1 = ws.getCell(1, COL_OFFSET);
  r1.value = opts.institution.toUpperCase();
  r1.font  = { bold: true, size: 14, color: { argb: UAI_BLUE }, name: "Calibri" };
  r1.alignment = { vertical: "middle", horizontal: "center" };
  r1.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
  ws.getRow(1).height = 24;

  // Row 2: Report title (merged)
  ws.mergeCells(2, COL_OFFSET, 2, lastCol);
  const r2 = ws.getCell(2, COL_OFFSET);
  r2.value = opts.sheetTitle;
  r2.font  = { bold: true, size: 12, color: { argb: WHITE }, name: "Calibri" };
  r2.alignment = { vertical: "middle", horizontal: "center" };
  r2.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: UAI_BLUE } };
  ws.getRow(2).height = 20;

  // Row 3: Subtitle / date (merged)
  ws.mergeCells(3, COL_OFFSET, 3, lastCol);
  const r3 = ws.getCell(3, COL_OFFSET);
  const fecha = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  r3.value = opts.subtitle ? `${opts.subtitle}   ·   Generado: ${fecha}` : `Generado: ${fecha}`;
  r3.font  = { italic: true, size: 10, color: { argb: UAI_BLUE }, name: "Calibri" };
  r3.alignment = { vertical: "middle", horizontal: "center" };
  r3.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: UAI_BLUE_L } };
  ws.getRow(3).height = 16;

  // Row 4: empty spacer
  ws.getRow(4).height = 6;

  // ── Column headers (row 5) ────────────────────────────────────────────────
  ws.columns = opts.columns.map((c) => ({ key: c.key, width: c.width }));

  const hdrRow = ws.getRow(dataStartRow);
  opts.columns.forEach((c, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = c.header;
    cell.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: UAI_BLUE } };
    cell.alignment = { vertical: "middle", horizontal: c.align ?? "left", wrapText: false };
    cell.border = {
      bottom: { style: "thin", color: { argb: WHITE } },
      right:  { style: "thin", color: { argb: "FFAAC4E8" } },
    };
  });
  hdrRow.height = 22;

  // ── Data rows ──────────────────────────────────────────────────────────────
  opts.rows.forEach((rowData, idx) => {
    const row = ws.addRow(opts.columns.map((c) => rowData[c.key]));
    const isEven = idx % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const colDef = opts.columns[colNum - 1];
      cell.font      = { size: 10, name: "Calibri" };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? GRAY_HDR : WHITE } };
      cell.alignment = { vertical: "middle", horizontal: colDef?.align ?? "left", wrapText: false };
      cell.border    = {
        bottom: { style: "hair", color: { argb: "FFD0DCF0" } },
        right:  { style: "hair", color: { argb: "FFD0DCF0" } },
      };
      if (colDef?.numFmt) cell.numFmt = colDef.numFmt;
    });
    row.height = 18;
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerRowIdx = dataStartRow + 1 + opts.rows.length;
  ws.mergeCells(footerRowIdx, 1, footerRowIdx, lastCol);
  const footer = ws.getCell(footerRowIdx, 1);
  footer.value = `Total: ${opts.rows.length} registros   ·   ${opts.institution}   ·   Portal Académico UAI`;
  footer.font  = { italic: true, size: 9, color: { argb: UAI_BLUE }, name: "Calibri" };
  footer.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: UAI_BLUE_L } };
  footer.alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(footerRowIdx).height = 15;

  // ── Freeze header rows ────────────────────────────────────────────────────
  ws.views = [{ state: "frozen", ySplit: dataStartRow, activeCell: `A${dataStartRow + 1}` }];

  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${opts.fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
