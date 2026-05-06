import * as ExcelJS from "exceljs";
import type { NominaGrupo } from "./parse-nomina-pdf";

const NAVY = "FF1E3A8A";
const HDR_BG = "FF1E40AF";
const PARENT_BG = "FFDCE6F1";
const ZEBRA_A = "FFFFFFFF";
const ZEBRA_B = "FFF5F7FF";

const sf = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCFCFCF" } },
  bottom: { style: "thin", color: { argb: "FFCFCFCF" } },
  left: { style: "thin", color: { argb: "FFCFCFCF" } },
  right: { style: "thin", color: { argb: "FFCFCFCF" } },
};

const CTR: Partial<ExcelJS.Alignment> = {
  horizontal: "center",
  vertical: "middle",
  wrapText: true,
};

const LEFT: Partial<ExcelJS.Alignment> = {
  horizontal: "left",
  vertical: "middle",
  wrapText: true,
};

export async function exportNominaXlsx(periodo: string, grupos: NominaGrupo[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Portal UAI";

  const generarHoja = (nombre: string, cicloNum: number) => {
    const ws = wb.addWorksheet(nombre);

    // Filtrar los grupos acumulados por el ciclo correspondiente
    const gruposCiclo = grupos.filter((g) => g.ciclo === cicloNum);

    // Configuración de anchos de columna según tu plantilla
    ws.columns = [
      { width: 8 }, // CICLO
      { width: 50 }, // CARRERA / CURSO
      { width: 15 }, // MODALIDAD
      { width: 15 }, // LOCAL
      { width: 10 }, // SECCIÓN
      { width: 12 }, // TURNO
      { width: 18 }, // MATRICULADOS
      { width: 12 }, // R. OCTDA
      { width: 12 }, // R. INASIST.
      { width: 15 }, // ACTIVOS
    ];

    // --- TÍTULO PRINCIPAL (Fila 3) ---
    ws.mergeCells("A3:J3");
    const title = ws.getCell("A3");
    title.value = `ALUMNOS MATRICULADOS UAI ${periodo} — CICLO ${cicloNum === 1 ? "I" : "II"}`;
    title.fill = sf(NAVY);
    title.font = {
      color: { argb: "FFFFFFFF" },
      bold: true,
      size: 14,
      name: "Arial",
    };
    title.alignment = CTR;
    ws.getRow(3).height = 35;

    // --- ENCABEZADOS (Fila 4) ---
    const headers = [
      "CICLO",
      "CARRERA / CURSO",
      "MODALIDAD",
      "LOCAL",
      "SECCIÓN",
      "TURNO",
      "MATRICULADOS",
      "R. OCTDA",
      "R. INASIST.",
      "ACTIVOS",
    ];

    headers.forEach((h, i) => {
      const cell = ws.getRow(4).getCell(i + 1);
      cell.value = h;
      cell.fill = sf(HDR_BG);
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };
      cell.alignment = CTR;
      cell.border = THIN_BORDER;
    });
    ws.getRow(4).height = 30;

    let r = 5;
    gruposCiclo.forEach((g) => {
      // --- FILA DE CARRERA (Padre - Azul Claro) ---
      const row = ws.getRow(r);
      const vals = [
        g.ciclo,
        g.carrera,
        g.modalidad || "PRESENCIAL",
        g.local || "SEDE",
        g.seccion,
        g.turno || "DIURNO",
        g.matriculados,
        g.retOctda || 0,
        g.retInasist || 0,
        g.totalActivos,
      ];

      vals.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v;
        c.fill = sf(PARENT_BG);
        c.font = { bold: true, size: 10 };
        c.alignment = i === 1 ? LEFT : CTR;
        c.border = THIN_BORDER;
      });
      ws.getRow(r).height = 25;
      r++;

      // --- FILAS DE CURSOS (Hijos - Efecto Cebra) ---
      if (g.cursos && Array.isArray(g.cursos)) {
        g.cursos.forEach((curso, idx) => {
          const cr = ws.getRow(r);
          const nombreCurso = curso.nombre || curso.curso;

          const cvals = [
            "",
            nombreCurso,
            "",
            "",
            g.seccion,
            "",
            curso.matriculados,
            curso.retOctda || 0,
            curso.retInasist || 0,
            curso.totalActivos,
          ];

          cvals.forEach((v, i) => {
            const c = cr.getCell(i + 1);
            c.value = v;
            c.fill = sf(idx % 2 === 0 ? ZEBRA_A : ZEBRA_B);
            c.font = { size: 9, italic: i === 1 };
            c.alignment = i === 1 ? LEFT : CTR;
            c.border = THIN_BORDER;
          });
          ws.getRow(r).height = 20;
          r++;
        });
      }
    });
  };

  generarHoja("PRIMER CICLO", 1);
  generarHoja("SEGUNDO CICLO", 2);

  // Generar buffer y disparar descarga
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NOMINA_UNIFICADA_UAI_${periodo}.xlsx`;
  a.click();

  // Limpieza de memoria
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
