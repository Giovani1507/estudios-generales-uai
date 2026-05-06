import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - worker URL handled by Vite
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl as unknown as string;

export type ParsedCurso = {
  codigo: string;
  curso: string;
  seccion: string;
  vacantes: number;
  matriculados: number;
};

export type ParsedNivel = {
  nivel: number;
  cursos: ParsedCurso[];
};

export type ParsedReport = {
  periodo: string;
  codigoCarrera: string;
  carrera: string;
  niveles: ParsedNivel[];
};

const ROMAN: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
};

function extractLines(items: { str: string; transform: number[] }[]): string[] {
  const rows: { y: number; items: typeof items }[] = [];
  for (const item of items) {
    if (!item.str || item.str.trim() === "") continue;
    const y = Math.round(item.transform[5]);
    let row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) =>
    r.items
      .sort((a, b) => a.transform[4] - b.transform[4])
      .map((i) => i.str)
      .join(" "),
  );
}

export async function parseNominaPdf(file: File): Promise<ParsedReport[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const allLines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const txt = await page.getTextContent();
    allLines.push(...extractLines(txt.items as any));
  }

  const reports: ParsedReport[] = [];
  let currentReport: ParsedReport | null = null;
  let currentNivel: ParsedNivel | null = null;
  let globalPeriodo = "2026-1";

  // Regex más robusto: acepta códigos como P35-20261-P35B1101
  const cursoRe =
    /^([A-Z]\d+(?:-[A-Z0-9]+){1,3})\s+(.+?)\s+([A-Z]{2})\s*-\s*([A-Z]{2})\s+(\d+)\s+(\d+)(?:\s+\d+)*\s*$/;

  for (const raw of allLines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const mPer = line.match(/PERIODO\s*:\s*([\d-]+)/i);
    if (mPer) {
      globalPeriodo = mPer[1].trim();
      continue;
    }

    // Intenta extraer código y nombre de carrera
    const mEsc = line.match(
      /ESCUELA\s+PROFESIONAL\s*:\s*([A-Z0-9]+)\s*-\s*(.+)/i,
    );
    if (mEsc) {
      currentReport = {
        periodo: globalPeriodo,
        codigoCarrera: mEsc[1].trim().toUpperCase(),
        carrera: mEsc[2].trim().toUpperCase(),
        niveles: [],
      };
      reports.push(currentReport);
      currentNivel = null;
      continue;
    }

    // Si ESCUELA PROFESIONAL no tenía código (solo nombre sin guión)
    const mEscSimple = line.match(/ESCUELA\s+PROFESIONAL\s*:\s*(.+)/i);
    if (mEscSimple && !line.match(/:\s*[A-Z0-9]+-/)) {
      currentReport = {
        periodo: globalPeriodo,
        codigoCarrera: "",
        carrera: mEscSimple[1].trim().toUpperCase(),
        niveles: [],
      };
      reports.push(currentReport);
      currentNivel = null;
      continue;
    }

    // Extrae código desde PLAN DE ESTUDIO como respaldo
    const mPlan = line.match(/PLAN\s+DE\s+ESTUDIO\s*:\s*([A-Z0-9]+)/i);
    if (mPlan && currentReport && !currentReport.codigoCarrera) {
      currentReport.codigoCarrera = mPlan[1].trim().toUpperCase();
      continue;
    }

    const mNiv = line.match(/NIVEL\s*:\s*([IVXLCDM]+)/i);
    if (mNiv && currentReport) {
      const n = ROMAN[mNiv[1].toUpperCase()] ?? 0;
      if (n) {
        currentNivel = { nivel: n, cursos: [] };
        currentReport.niveles.push(currentNivel);
      }
      continue;
    }

    const m = line.match(cursoRe);
    if (m && currentNivel) {
      const [
        ,
        codigo,
        cursoName,
        secLetters,
        secLocal,
        vacantesStr,
        matriculadosStr,
      ] = m;
      const seccion = `${secLetters.toUpperCase()} - ${secLocal.toUpperCase()}`;
      currentNivel.cursos.push({
        codigo: codigo.trim(),
        curso: cursoName.trim().replace(/\s+/g, " "),
        seccion,
        vacantes: Number(vacantesStr),
        matriculados: Number(matriculadosStr),
      });
    }
  }

  return reports;
}

export type NominaGrupo = {
  ciclo: 1 | 2;
  carrera: string;
  modalidad: string;
  local: string;
  seccion: string;
  turno: string;
  matriculados: number;
  retOctda: number;
  retInasist: number;
  totalActivos: number;
  cursos: any[];
};

// Mapa completo de códigos de local
const LOCAL_MAP: Record<string, string> = {
  CH: "SEDE",
  HU: "HUACHO",
  IC: "FILIAL ICA",
  SU: "SUBSEDE",
  PO: "POLO",
  LI: "LIMA",
  PI: "FILIAL PIURA",
};

export function buildGrupos(reports: ParsedReport[]): NominaGrupo[] {
  const todosLosGrupos: NominaGrupo[] = [];

  for (const report of reports) {
    for (const niv of report.niveles) {
      // Ciclo 1 = semestres impares (I, III, V, VII...),  Ciclo 2 = semestres pares (II, IV, VI, VIII...)
      const ciclo: 1 | 2 = niv.nivel % 2 === 1 ? 1 : 2;

      const bySec = new Map<string, ParsedCurso[]>();
      for (const c of niv.cursos) {
        if (!bySec.has(c.seccion)) bySec.set(c.seccion, []);
        bySec.get(c.seccion)!.push(c);
      }

      for (const [sec, cursos] of bySec) {
        // Acepta secciones tipo "AV - IC", "AP - SU", "XP - PO"
        const m = sec.match(/^([A-Z])([A-Z])\s*-\s*([A-Z]{2})$/);
        if (!m) continue;

        const [, letra, modLetra, localCod] = m;
        const modalidad = modLetra === "V" ? "VIRTUAL" : "PRESENCIAL";
        const local = LOCAL_MAP[localCod] || localCod;

        // Turno: virtual siempre nocturno, presencial depende de la sección
        const turno =
          modalidad === "VIRTUAL"
            ? "NOCTURNO"
            : letra === "A"
              ? "DIURNO"
              : "NOCTURNO";

        const matriculadosMax = Math.max(...cursos.map((c) => c.matriculados));

        todosLosGrupos.push({
          ciclo,
          carrera: report.carrera,
          modalidad,
          local,
          seccion: letra,
          turno,
          matriculados: matriculadosMax,
          retOctda: 0,
          retInasist: 0,
          totalActivos: matriculadosMax,
          cursos: cursos.map((c) => ({
            nombre: c.curso,
            codigo: c.codigo,
            matriculados: c.matriculados,
            retOctda: 0,
            retInasist: 0,
            totalActivos: c.matriculados,
          })),
        });
      }
    }
  }

  return todosLosGrupos;
}
