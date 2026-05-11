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
    // La modalidad se decide por el NOMBRE de la carrera (encabezado del PDF).
    // Ej: "ADMINISTRACIÓN DE EMPRESAS - VIRTUAL" → todo VIRTUAL.
    //     "ARQUITECTURA"                          → todo PRESENCIAL,
    //                                               aunque haya secciones AV-CH
    //                                               (son sólo aulas virtuales del
    //                                               mismo programa presencial).
    const carreraEsVirtual = /\bVIRTUAL\b/.test(report.carrera.toUpperCase());
    const modalidadPrograma: "VIRTUAL" | "PRESENCIAL" = carreraEsVirtual
      ? "VIRTUAL"
      : "PRESENCIAL";

    for (const niv of report.niveles) {
      // SOLO se procesan I y II semestre (ciclo 1 y 2).
      // Cualquier nivel mayor (III, IV, V...) se descarta para la nómina.
      if (niv.nivel < 1 || niv.nivel > 2) continue;
      const ciclo: 1 | 2 = niv.nivel === 1 ? 1 : 2;

      // Agrupamos por (LETRA DE SECCIÓN, LOCAL) — ignorando la letra de
      // modalidad (P/V), porque la modalidad real ya se definió por la carrera.
      // Así "AP - CH" y "AV - CH" se cuentan como UN solo grupo "A — CH".
      type Key = string; // `${letra}||${localCod}`
      const byGrp = new Map<Key, { letra: string; localCod: string; cursos: ParsedCurso[] }>();

      for (const c of niv.cursos) {
        const m = c.seccion.match(/^([A-Z])([A-Z])\s*-\s*([A-Z]{2})$/);
        if (!m) continue;
        const [, letra, , localCod] = m;
        const k = `${letra}||${localCod}`;
        if (!byGrp.has(k)) byGrp.set(k, { letra, localCod, cursos: [] });
        byGrp.get(k)!.cursos.push(c);
      }

      for (const { letra, localCod, cursos } of byGrp.values()) {
        const local = LOCAL_MAP[localCod] || localCod;

        // Turno: virtual siempre nocturno; presencial depende de la sección
        // (A=Diurno, otras=Nocturno) — es la convención académica de UAI.
        const turno =
          modalidadPrograma === "VIRTUAL"
            ? "NOCTURNO"
            : letra === "A"
              ? "DIURNO"
              : "NOCTURNO";

        // Si una misma asignatura tiene varias secciones de modalidad (AP+AV),
        // las consolidamos sumando matriculados por código de curso, para que
        // no aparezcan duplicados en el grupo "A".
        const porCodigo = new Map<string, ParsedCurso>();
        for (const c of cursos) {
          const prev = porCodigo.get(c.codigo);
          if (prev) {
            prev.matriculados += c.matriculados;
            prev.vacantes += c.vacantes;
          } else {
            porCodigo.set(c.codigo, { ...c });
          }
        }
        const cursosCons = [...porCodigo.values()];

        const matriculadosMax = Math.max(...cursosCons.map((c) => c.matriculados), 0);

        todosLosGrupos.push({
          ciclo,
          carrera: report.carrera,
          modalidad: modalidadPrograma,
          local,
          seccion: letra,
          turno,
          matriculados: matriculadosMax,
          retOctda: 0,
          retInasist: 0,
          totalActivos: matriculadosMax,
          cursos: cursosCons.map((c) => ({
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
