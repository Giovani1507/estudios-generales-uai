import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - worker URL handled by Vite
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl as unknown as string;

export type ParsedCurso = {
  codigo: string;
  curso: string;
  seccion: string;     // full like "AP - HU"
  vacantes: number;
  matriculados: number;
};

export type ParsedNivel = {
  nivel: number;       // 1, 2, 3, ...
  cursos: ParsedCurso[];
};

export type ParsedReport = {
  periodo: string;     // e.g. "2026-1"
  codigoCarrera: string; // e.g. "P38"
  carrera: string;     // e.g. "ADMINISTRACIÓN DE EMPRESAS"
  niveles: ParsedNivel[];
};

const ROMAN: Record<string, number> = {
  "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6,
  "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12,
};

function extractLines(items: { str: string; transform: number[] }[]): string[] {
  // Group items by y-coordinate (transform[5])
  const rows: { y: number; items: typeof items }[] = [];
  for (const item of items) {
    if (!item.str || item.str.trim() === "") continue;
    const y = Math.round(item.transform[5]);
    let row = rows.find(r => Math.abs(r.y - y) < 2);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push(item);
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map(r =>
    r.items.sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(" ")
  );
}

export async function parseNominaPdf(file: File): Promise<ParsedReport> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const allLines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const txt = await page.getTextContent();
    allLines.push(...extractLines(txt.items as any));
  }

  // Extract header info
  let periodo = "";
  let codigoCarrera = "";
  let carrera = "";
  for (const line of allLines.slice(0, 30)) {
    const mPer = line.match(/PERIODO\s*:\s*([\d-]+)/i);
    if (mPer) periodo = mPer[1].trim();
    const mEsc = line.match(/ESCUELA\s+PROFESIONAL\s*:\s*([A-Z0-9]+)\s*-\s*(.+)/i);
    if (mEsc) {
      codigoCarrera = mEsc[1].trim().toUpperCase();
      carrera = mEsc[2].trim().toUpperCase();
    }
  }

  // Walk lines, track current nivel, parse curso lines
  const niveles: ParsedNivel[] = [];
  let currentNivel: ParsedNivel | null = null;

  // Curso line regex:
  //   <COD>  <CURSO>  <SECCION letter+P/V> - <CH|HU|IC>  <vacantes> <matriculados> <g1> <g2>
  // Sample: "P38-20261-P38A1101 MATEMÁTICA AP - HU 40 40 0 0"
  // Section can be "AV - HU", "BV - CH", etc. Sometimes condensed "CV-CH" or "AV " (no dash).
  // We allow optional spaces around the dash.
  const cursoRe = /^([A-Z]?\d*-?[A-Z0-9]{2,}-[A-Z0-9]+)\s+(.+?)\s+([A-Z]{2})\s*-?\s*([A-Z]{2})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/;

  for (const raw of allLines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;

    // Detect "NIVEL : I SEMESTRE"
    const mNiv = line.match(/NIVEL\s*:\s*([IVXLCDM]+)/i);
    if (mNiv) {
      const n = ROMAN[mNiv[1].toUpperCase()] ?? 0;
      if (n) {
        currentNivel = { nivel: n, cursos: [] };
        niveles.push(currentNivel);
      }
      continue;
    }

    if (!currentNivel) continue;

    const m = line.match(cursoRe);
    if (m) {
      const [, codigo, cursoName, secLetters, secLocal, vacantes, matriculados] = m;
      const seccion = `${secLetters.toUpperCase()} - ${secLocal.toUpperCase()}`;
      currentNivel.cursos.push({
        codigo: codigo.trim(),
        curso: cursoName.trim().replace(/\s+/g, " "),
        seccion,
        vacantes: Number(vacantes),
        matriculados: Number(matriculados),
      });
    }
  }

  return { periodo, codigoCarrera, carrera, niveles };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build NominaGrupo[] from the parsed report (only ciclos 1 and 2)

export type NominaCurso = {
  nombre: string;
  codigo: string;
  seccion: string;
  matriculados: number;
  retOctda: number;
  retInasist: number;
  totalActivos: number;
};

export type NominaGrupo = {
  ciclo: 1 | 2;
  carrera: string;
  modalidad: "PRESENCIAL" | "VIRTUAL";
  local: string;
  seccion: string;     // letter only ("A", "B", "C")
  turno: "DIURNO" | "NOCTURNO" | "";
  matriculados: number;
  retOctda: number;
  retInasist: number;
  totalActivos: number;
  cursos: NominaCurso[];
};

const LOCAL_MAP: Record<string, string> = {
  CH: "SEDE",
  HU: "HUACHO",
  IC: "FILIAL",
};

function defaultTurno(local: string, seccion: string, modalidad: string): "DIURNO" | "NOCTURNO" {
  if (modalidad === "VIRTUAL") return "NOCTURNO";
  if (local === "HUACHO" && seccion === "A") return "DIURNO";
  if (seccion === "A") return "NOCTURNO";
  return "NOCTURNO";
}

export function buildGrupos(parsed: ParsedReport): NominaGrupo[] {
  const grupos: NominaGrupo[] = [];

  for (const niv of parsed.niveles) {
    if (niv.nivel !== 1 && niv.nivel !== 2) continue;

    // Group cursos by section code (e.g. "AP - HU")
    const bySec = new Map<string, ParsedCurso[]>();
    for (const c of niv.cursos) {
      if (!bySec.has(c.seccion)) bySec.set(c.seccion, []);
      bySec.get(c.seccion)!.push(c);
    }

    for (const [sec, cursos] of bySec) {
      // sec format "XY - LL"
      const m = sec.match(/^([A-Z])([A-Z])\s*-\s*([A-Z]{2})$/);
      if (!m) continue;
      const [, letra, modLetra, localCod] = m;
      const modalidad = modLetra === "V" ? "VIRTUAL" : "PRESENCIAL";
      const local = LOCAL_MAP[localCod] || localCod;
      const matriculadosMax = Math.max(...cursos.map(c => c.matriculados));
      const turno = defaultTurno(local, letra, modalidad);

      grupos.push({
        ciclo: niv.nivel as 1 | 2,
        carrera: parsed.carrera,
        modalidad,
        local,
        seccion: letra,
        turno,
        matriculados: matriculadosMax,
        retOctda: 0,
        retInasist: 0,
        totalActivos: matriculadosMax,
        cursos: cursos.map(c => ({
          nombre: c.curso,
          codigo: c.codigo,
          seccion: c.seccion,
          matriculados: c.matriculados,
          retOctda: 0,
          retInasist: 0,
          totalActivos: c.matriculados,
        })),
      });
    }
  }

  // Sort: ciclo asc, then local (HUACHO, SEDE, FILIAL), modalidad (PRESENCIAL, VIRTUAL), seccion
  const localOrder: Record<string, number> = { HUACHO: 0, SEDE: 1, FILIAL: 2 };
  grupos.sort((a, b) => {
    if (a.ciclo !== b.ciclo) return a.ciclo - b.ciclo;
    const la = localOrder[a.local] ?? 9, lb = localOrder[b.local] ?? 9;
    if (la !== lb) return la - lb;
    if (a.modalidad !== b.modalidad) return a.modalidad === "PRESENCIAL" ? -1 : 1;
    return a.seccion.localeCompare(b.seccion);
  });

  return grupos;
}
