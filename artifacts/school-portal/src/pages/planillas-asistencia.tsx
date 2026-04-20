import { useEffect, useMemo, useState } from "react";
import { Search, ClipboardCheck, User, BookOpen, Loader2, FileSpreadsheet, ChevronRight, CheckCircle2, Download } from "lucide-react";
import * as ExcelJS from "exceljs";
import JSZip from "jszip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AsistenciaPlanillaDialog, type CursoCtx } from "@/components/asistencia-planilla-dialog";

type Row = {
  carrera: string; carreraFull: string; ciclo: string; seccion: string;
  codigo: string; curso: string; modalidadCurso: string;
  horasT: number; horasP: number; horas: number;
  docente: string; modalidad: string;
  dia: string; hora: string; horaFin: string; horasAcad: number;
  pabellon?: string; aula?: string; laboratorio?: string;
  local?: string; turno?: string; tipo?: string;
};

const FACULTADES = [
  { key: "FICA", file: "planificacion-fica-2026-1.json", label: "FICA · Estudios Generales" },
  { key: "FCS",  file: "planificacion-fcs-2026-1.json",  label: "FCS · Ciencias de la Salud"  },
] as const;

// Sedes (orden y nombres que ve el usuario). PRINCIPAL del archivo se muestra como "SEDE".
const SEDES = ["SEDE", "FILIAL", "SUNAMPE", "HUAURA", "PORUMA"] as const;
type Sede = (typeof SEDES)[number];
const sedeFromLocal = (local?: string): Sede => {
  const v = (local || "").toUpperCase().trim();
  if (v === "PRINCIPAL" || v === "SEDE" || v === "ICA") return "SEDE";
  if (v === "FILIAL" || v === "CHINCHA") return "FILIAL";
  if (v === "SUNAMPE") return "SUNAMPE";
  if (v === "HUAURA") return "HUAURA";
  if (v === "PORUMA") return "PORUMA";
  return "SEDE";
};

function turnoFromHora(hora: string): string {
  const h = parseInt((hora || "").split(":")[0]);
  return Number.isFinite(h) && h < 18 ? "DIURNO" : "NOCTURNO";
}

// ---------------------- Helpers comunes para Excel ----------------------
const XLS_NAVY = "FF001F5F";
const XLS_GOLD = "FFC9A84C";
const XLS_WHITE = "FFFFFFFF";
const XLS_YELLOW_BG = "FFFFF59D";
const xsf = (a: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: a } });
const XCTR = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
const XLEFT = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };
const XTHIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" },
};
const xsanitize = (s: string) =>
  (s || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "SIN_NOMBRE";

type PlanillaDetalle = {
  id: number; docente: string|null; carrera: string|null; ciclo: string|null;
  seccion: string|null; codigoCurso: string|null; nombreCurso: string|null;
  alumnos: Array<{ numero: string; nombre: string; marcas: string[]; porcentaje: number }>;
  weeks: Array<{ label: string; fecha?: string; dia?: string }>;
};
type CursoExportInfo = {
  codigoCurso: string;
  nombreCurso: string;
  docente: string;
  carrera: string;
  carreraFull: string;
  ciclo: string;
  seccion: string;
  sede?: Sede;
  planilla: PlanillaDetalle | null;
};

async function buildCursoWorkbookXLSX(c: CursoExportInfo): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheetName = xsanitize(`${c.carrera} ${c.ciclo}${c.seccion}`).slice(0, 31) || "Asistencia";
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", xSplit: 2, ySplit: 7 }] });

  const p = c.planilla;
  const weeks = (p?.weeks ?? []) as Array<{ label: string; fecha?: string; dia?: string }>;
  const N = weeks.length > 0 ? weeks.length : 18;

  // Detectar 1 o 2 columnas por semana (T/P)
  const semanaCols: number[] = new Array(N).fill(1);
  if (p && p.alumnos.length > 0) {
    for (let w = 0; w < N; w++) {
      for (const a of p.alumnos) {
        const m2 = (a.marcas[w * 2 + 1] || "").toUpperCase();
        if (m2 === "A" || m2 === "F") { semanaCols[w] = 2; break; }
      }
    }
  }
  const totalDataCols = semanaCols.reduce((s, n) => s + n, 0);
  const lastCol = 2 + totalDataCols;

  const cols: Partial<ExcelJS.Column>[] = [{ width: 5 }, { width: 42 }];
  for (let i = 0; i < totalDataCols; i++) cols.push({ width: 12 });
  ws.columns = cols as ExcelJS.Column[];

  const colLetter = (n: number) => {
    let s = "";
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  const rng = (r1: number, c1: number, r2: number, c2: number) =>
    `${colLetter(c1)}${r1}:${colLetter(c2)}${r2}`;

  // Banner
  ws.mergeCells(rng(1, 1, 1, lastCol));
  const t = ws.getCell("A1");
  t.value = `UNIVERSIDAD AUTÓNOMA DE ICA — ${c.carreraFull || c.carrera} — ASISTENCIA 2026-I`;
  t.font = { bold: true, size: 13, color: { argb: XLS_WHITE } };
  t.fill = xsf(XLS_NAVY); t.alignment = XCTR; t.border = XTHIN;
  ws.getRow(1).height = 26;

  // Título curso
  ws.mergeCells(rng(3, 1, 3, lastCol));
  const head = ws.getCell("A3");
  const sedeLabel = c.sede ? `   ·   📍 ${c.sede}` : "";
  head.value = `${c.codigoCurso ? c.codigoCurso + " — " : ""}${c.nombreCurso} · ${c.carrera} ${c.ciclo}${c.seccion}${sedeLabel}`;
  head.font = { bold: true, size: 12, color: { argb: XLS_NAVY } };
  head.fill = xsf(XLS_GOLD); head.alignment = XLEFT; head.border = XTHIN;
  ws.getRow(3).height = 22;

  // Docente
  ws.mergeCells(rng(4, 1, 4, lastCol));
  const sub = ws.getCell("A4");
  sub.value = `Docente: ${c.docente || "—"}   ·   Semanas: ${weeks.length || 0}${p ? "" : "   ·   (Sin Excel subido aún)"}`;
  sub.font = { italic: true, size: 10, color: { argb: "FF555555" } };
  sub.alignment = XLEFT;
  ws.getRow(4).height = 16;

  // Inicio de cada semana
  const semanaStartCol: number[] = [];
  let cur = 3;
  for (let i = 0; i < N; i++) { semanaStartCol.push(cur); cur += semanaCols[i]; }

  // Fila 5: Semana N
  const r5 = ws.getRow(5);
  r5.getCell(1).value = "N°";
  r5.getCell(2).value = "Apellidos y Nombres del Alumno";
  for (let i = 0; i < N; i++) {
    const start = semanaStartCol[i], cnt = semanaCols[i];
    if (cnt === 2) ws.mergeCells(5, start, 5, start + 1);
    r5.getCell(start).value = weeks[i]?.label || `Semana ${i + 1}`;
  }
  for (let col = 1; col <= lastCol; col++) {
    const cell = r5.getCell(col);
    cell.font = { bold: true, size: 10, color: { argb: XLS_WHITE } };
    cell.fill = xsf(XLS_NAVY); cell.alignment = XCTR; cell.border = XTHIN;
  }
  r5.height = 18;

  // Fila 6: fecha
  const r6 = ws.getRow(6);
  for (let i = 0; i < N; i++) {
    const start = semanaStartCol[i];
    const fecha = weeks[i]?.fecha || "";
    for (let k = 0; k < semanaCols[i]; k++) r6.getCell(start + k).value = fecha;
  }
  for (let col = 1; col <= lastCol; col++) {
    const cell = r6.getCell(col);
    cell.font = { size: 9, color: { argb: "FF555555" } };
    cell.fill = xsf("FFF1F5F9"); cell.alignment = XCTR; cell.border = XTHIN;
  }
  r6.height = 16;

  // Fila 7: día + T/P
  const r7 = ws.getRow(7);
  for (let i = 0; i < N; i++) {
    const start = semanaStartCol[i];
    const dia = weeks[i]?.dia || "";
    if (semanaCols[i] === 1) r7.getCell(start).value = dia;
    else { r7.getCell(start).value = `${dia}\nT`; r7.getCell(start + 1).value = `${dia}\nP`; }
  }
  for (let col = 1; col <= lastCol; col++) {
    const cell = r7.getCell(col);
    cell.font = { size: 9, color: { argb: "FF555555" }, italic: true };
    cell.fill = xsf("FFF1F5F9"); cell.alignment = XCTR; cell.border = XTHIN;
  }
  r7.height = 24;

  // Alumnos desde fila 8
  let r = 8;
  const alumnos = p?.alumnos ?? [];
  alumnos.forEach((a, i) => {
    const row = ws.getRow(r);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = a.nombre;
    row.getCell(1).alignment = XCTR;
    row.getCell(2).alignment = XLEFT;
    row.getCell(1).border = XTHIN;
    row.getCell(2).border = XTHIN;
    row.getCell(1).font = { size: 10 };
    row.getCell(2).font = { size: 10 };
    for (let w = 0; w < N; w++) {
      const start = semanaStartCol[w];
      for (let k = 0; k < semanaCols[w]; k++) {
        const m = (a.marcas[w * 2 + k] || "").toUpperCase();
        const mark = (m === "A" || m === "F") ? m : "";
        const cell = row.getCell(start + k);
        cell.value = mark;
        cell.alignment = XCTR;
        cell.border = XTHIN;
        cell.font = { size: 10, bold: mark === "F" };
        if (mark === "F") cell.fill = xsf(XLS_YELLOW_BG);
      }
    }
    row.height = 16;
    r++;
  });

  if (alumnos.length === 0) {
    for (let i = 0; i < 20; i++) {
      const row = ws.getRow(r);
      row.getCell(1).value = i + 1;
      row.getCell(1).alignment = XCTR;
      row.getCell(1).font = { size: 10, color: { argb: "FFAAAAAA" } };
      for (let col = 1; col <= lastCol; col++) row.getCell(col).border = XTHIN;
      row.height = 16;
      r++;
    }
  }

  return await wb.xlsx.writeBuffer() as ArrayBuffer;
}

export default function PlanillasAsistencia() {
  const { toast } = useToast();
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [asistenciaCurso, setAsistenciaCurso] = useState<CursoCtx | null>(null);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const [uploadedByDocente, setUploadedByDocente] = useState<Map<string, number>>(new Map());
  const [exporting, setExporting] = useState(false);
  const [sedeFiltro, setSedeFiltro] = useState<"TODAS" | Sede>("TODAS");
  const [exportingCurso, setExportingCurso] = useState<string | null>(null);

  const exportarCurso = async (c: Row & { sesiones: number }) => {
    const key = `${c.codigo}|${c.seccion}`;
    setExportingCurso(key);
    try {
      const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
      // Buscar la planilla específica del docente seleccionado/curso/sección
      const listRes = await fetch(`${base}/api/asistencia-planillas`, { credentials: "include" });
      const list = listRes.ok ? (await listRes.json()) as Array<{
        id: number; docente: string|null; codigoCurso: string|null; seccion: string|null;
      }> : [];
      const match = list.find(p =>
        (p.docente || "").toUpperCase().trim() === (selected || "").toUpperCase().trim() &&
        (p.codigoCurso || "").trim() === c.codigo &&
        (p.seccion || "").trim() === c.seccion
      );
      let planilla: PlanillaDetalle | null = null;
      if (match) {
        const r = await fetch(`${base}/api/asistencia-planillas/${match.id}`, { credentials: "include" });
        if (r.ok) planilla = await r.json();
      }
      const buf = await buildCursoWorkbookXLSX({
        codigoCurso: c.codigo,
        nombreCurso: c.curso,
        docente: (selected || "").toUpperCase().trim(),
        carrera: c.carrera,
        carreraFull: c.carreraFull || c.carrera,
        ciclo: c.ciclo,
        seccion: c.seccion,
        sede: sedeFromLocal(c.local),
        planilla,
      });
      const fileName = `${xsanitize(c.curso || c.codigo)} - ${c.carrera} ${c.ciclo}${c.seccion}.xlsx`;
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Excel generado", description: planilla ? "Con datos de la planilla subida." : "Plantilla vacía (sin Excel subido)." });
    } catch (e) {
      console.error(e);
      toast({ title: "Error al generar Excel", variant: "destructive" });
    } finally {
      setExportingCurso(null);
    }
  };

  const exportarPorCarrera = async () => {
    setExporting(true);
    try {
      const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
      const listRes = await fetch(`${base}/api/asistencia-planillas`, { credentials: "include" });
      if (!listRes.ok) throw new Error("list");
      const list = (await listRes.json()) as Array<{
        id: number; docente: string|null; carrera: string|null; ciclo: string|null;
        seccion: string|null; codigoCurso: string|null; nombreCurso: string|null;
      }>;
      const lista = list.filter(p => p.ciclo === "1" || p.ciclo === "2");

      // Traer detalle de cada planilla (alumnos + totales + semanas)
      const detalles = await Promise.all(lista.map(async p => {
        const r = await fetch(`${base}/api/asistencia-planillas/${p.id}`, { credentials: "include" });
        return r.ok ? await r.json() : null;
      }));
      const planillas = detalles.filter(Boolean) as Array<{
        id: number; docente: string|null; carrera: string|null; ciclo: string|null;
        seccion: string|null; codigoCurso: string|null; nombreCurso: string|null;
        alumnos: Array<{ numero: string; nombre: string; marcas: string[]; porcentaje: number }>;
        weeks: Array<{ label: string; fecha?: string; dia?: string }>;
      }>;

      // Indexar planillas por docente|codigoCurso|seccion
      const planillaKey = (d: string, c: string, s: string) =>
        `${(d||"").toUpperCase().trim()}|${(c||"").trim()}|${(s||"").trim()}`;
      const planillaMap = new Map<string, typeof planillas[number]>();
      for (const p of planillas) {
        planillaMap.set(planillaKey(p.docente||"", p.codigoCurso||"", p.seccion||""), p);
      }

      const sanitize = xsanitize;

      type Planilla = typeof planillas[number];
      type CursoInfo = {
        codigoCurso: string;
        nombreCurso: string;
        docente: string;
        carrera: string;
        carreraFull: string;
        ciclo: string;
        seccion: string;
        planilla: Planilla | null;
      };

      // Agrupar por carrera + ciclo + sección a partir de la PLANIFICACIÓN (todas las carreras)
      const porGrupo = new Map<string, {
        carrera: string; carreraFull: string; ciclo: string; seccion: string;
        cursos: Map<string, CursoInfo>;
      }>();

      const rowsPlan = data.filter(r => String(r.ciclo) === "1" || String(r.ciclo) === "2");
      for (const r of rowsPlan) {
        const carrera = (r.carrera || "SIN CARRERA").toUpperCase().trim();
        const carreraFull = (r.carreraFull || r.carrera || "").toUpperCase().trim();
        const ciclo = String(r.ciclo || "").trim();
        const seccion = String(r.seccion || "").trim();
        const gKey = `${carrera}|${ciclo}|${seccion}`;
        if (!porGrupo.has(gKey)) {
          porGrupo.set(gKey, { carrera, carreraFull, ciclo, seccion, cursos: new Map() });
        }
        const g = porGrupo.get(gKey)!;
        const cKey = `${(r.codigo || "").trim()}|${(r.docente || "").toUpperCase().trim()}`;
        if (!g.cursos.has(cKey)) {
          const pl = planillaMap.get(planillaKey(r.docente || "", r.codigo || "", seccion)) || null;
          g.cursos.set(cKey, {
            codigoCurso: (r.codigo || "").trim(),
            nombreCurso: r.curso || "",
            docente: (r.docente || "").toUpperCase().trim(),
            carrera, carreraFull, ciclo, seccion,
            planilla: pl,
          });
        }
      }

      const buildCursoWorkbook = (c: CursoInfo & { sede?: Sede }) => buildCursoWorkbookXLSX(c);

      // Mapear cada curso a su sede usando el primer Row coincidente de la planificación
      const sedeDeCurso = new Map<string, Sede>();
      for (const r of rowsPlan) {
        const k = `${(r.codigo || "").trim()}|${(r.docente || "").toUpperCase().trim()}|${(r.seccion || "").trim()}`;
        if (!sedeDeCurso.has(k)) sedeDeCurso.set(k, sedeFromLocal(r.local));
      }

      // Armar ZIP: carpeta por SEDE → carpeta por (CARRERA CICLO-SECCION) → un Excel por curso
      const zip = new JSZip();
      const grupos = Array.from(porGrupo.values()).sort((a, b) =>
        a.carrera.localeCompare(b.carrera, "es") ||
        a.ciclo.localeCompare(b.ciclo) ||
        a.seccion.localeCompare(b.seccion)
      );

      // Pre-clasificar cursos por sede
      type CursoFull = CursoInfo & { sede: Sede };
      const cursosPorSede = new Map<Sede, CursoFull[]>();
      for (const s of SEDES) cursosPorSede.set(s, []);
      for (const g of grupos) {
        for (const ci of g.cursos.values()) {
          const sede = sedeDeCurso.get(`${ci.codigoCurso}|${ci.docente}|${ci.seccion}`) || "SEDE";
          cursosPorSede.get(sede)!.push({ ...ci, sede });
        }
      }

      let totalCursos = 0;
      const sedesUsadas: Sede[] = [];
      for (const sede of SEDES) {
        const cursosSede = cursosPorSede.get(sede) || [];
        if (cursosSede.length === 0) continue;
        sedesUsadas.push(sede);
        const sedeFolder = zip.folder(sede)!;

        // Re-agrupar dentro de la sede por carrera+ciclo+seccion
        const subGrupos = new Map<string, CursoFull[]>();
        for (const ci of cursosSede) {
          const k = `${ci.carrera}|${ci.ciclo}|${ci.seccion}`;
          if (!subGrupos.has(k)) subGrupos.set(k, []);
          subGrupos.get(k)!.push(ci);
        }

        for (const [, lista] of Array.from(subGrupos.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
          const first = lista[0];
          const folderName = sanitize(`${first.carrera} ${first.ciclo}-${first.seccion}`);
          const folder = sedeFolder.folder(folderName)!;
          const usedNames = new Map<string, number>();
          lista.sort((a, b) => (a.nombreCurso || "").localeCompare(b.nombreCurso || "", "es"));
          for (const ci of lista) {
            const buf = await buildCursoWorkbook(ci);
            const baseName = sanitize(ci.nombreCurso || ci.codigoCurso || "Curso");
            const used = usedNames.get(baseName) || 0;
            const fileName = used === 0 ? `${baseName}.xlsx` : `${baseName} (${used + 1}).xlsx`;
            usedNames.set(baseName, used + 1);
            folder.file(fileName, buf);
            totalCursos++;
          }
        }
      }

      if (totalCursos === 0) {
        toast({ title: "Sin datos", description: "No se encontraron cursos para exportar.", variant: "destructive" });
        return;
      }

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Asistencia_2026-1_por_Sede.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({
        title: "ZIP generado",
        description: `${sedesUsadas.length} sedes · ${totalCursos} cursos exportados.`,
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Error al generar Excel", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const loadUploaded = async () => {
    try {
      const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
      const r = await fetch(`${base}/api/asistencia-planillas`, { credentials: "include" });
      if (!r.ok) return;
      const list = (await r.json()) as Array<{ docente: string | null; codigoCurso: string | null; seccion: string | null }>;
      const set = new Set<string>();
      const cnt = new Map<string, number>();
      for (const p of list) {
        if (!p.docente || !p.codigoCurso) continue;
        const k = `${p.docente.toUpperCase().trim()}|${p.codigoCurso.trim()}|${p.seccion || ""}`;
        set.add(k);
        const dk = p.docente.toUpperCase().trim();
        cnt.set(dk, (cnt.get(dk) || 0) + 1);
      }
      setUploaded(set);
      setUploadedByDocente(cnt);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
        const all: Row[] = [];
        for (const f of FACULTADES) {
          try {
            const r = await fetch(`${base}/${f.file}`);
            if (!r.ok) continue;
            const arr = (await r.json()) as Row[];
            arr.forEach((row) => all.push(row));
          } catch { /* ignore */ }
        }
        setData(all);
        await loadUploaded();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const teachers = useMemo(() => {
    const map = new Map<string, { count: number; carreras: Set<string>; sedes: Set<Sede> }>();
    for (const r of data) {
      // Solo ciclos 1 y 2
      if (String(r.ciclo) !== "1" && String(r.ciclo) !== "2") continue;
      const k = r.docente?.toUpperCase().trim();
      if (!k) continue;
      if (!map.has(k)) map.set(k, { count: 0, carreras: new Set(), sedes: new Set() });
      const v = map.get(k)!;
      v.count++;
      v.carreras.add(r.carrera);
      v.sedes.add(sedeFromLocal(r.local));
    }
    return Array.from(map.entries())
      .map(([n, v]) => ({ nombre: n, sesiones: v.count, carreras: Array.from(v.carreras), sedes: Array.from(v.sedes) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return teachers.filter((t) => {
      if (sedeFiltro !== "TODAS" && !t.sedes.includes(sedeFiltro)) return false;
      if (q && !t.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [teachers, search, sedeFiltro]);

  // Agrupar docentes filtrados por sede
  const teachersGrouped = useMemo(() => {
    const groups = new Map<Sede, typeof filtered>();
    for (const s of SEDES) groups.set(s, []);
    for (const t of filtered) {
      // Si el docente trabaja en varias sedes, lo mostramos en cada una (a menos que se filtre por una)
      if (sedeFiltro !== "TODAS") {
        groups.get(sedeFiltro)!.push(t);
      } else {
        for (const s of t.sedes) groups.get(s)!.push(t);
      }
    }
    return groups;
  }, [filtered, sedeFiltro]);

  /* Cursos únicos del docente (agrupados por código + sección) */
  const cursos = useMemo(() => {
    if (!selected) return [];
    const rows = data.filter(
      (r) =>
        r.docente?.toUpperCase().trim() === selected &&
        (String(r.ciclo) === "1" || String(r.ciclo) === "2"),
    );
    const map = new Map<string, Row & { sesiones: number }>();
    for (const r of rows) {
      const k = `${r.codigo}|${r.seccion}|${r.carrera}|${r.ciclo}`;
      if (!map.has(k)) map.set(k, { ...r, sesiones: 0 });
      map.get(k)!.sesiones++;
    }
    return Array.from(map.values()).sort((a, b) => {
      const c = a.carrera.localeCompare(b.carrera);
      if (c !== 0) return c;
      const ci = a.ciclo.localeCompare(b.ciclo);
      if (ci !== 0) return ci;
      return a.seccion.localeCompare(b.seccion);
    });
  }, [data, selected]);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Asistencia 2026-1
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecciona un docente, abre cualquiera de sus cursos e importa el Excel "Reporte de Asistencia de Estudiantes".
            Al ver una planilla aparecerá también el horario por aula que se está formando para esos estudiantes.
          </p>
        </div>
        <Button
          onClick={exportarPorCarrera}
          disabled={exporting}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
        >
          {exporting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
            : <><Download className="h-4 w-4" /> Excel por Carrera</>
          }
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando docentes…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Lista de docentes */}
          <div className="lg:col-span-4 bg-white rounded-lg border border-border/50 shadow-sm flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-border/50 space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <User className="h-4 w-4 text-primary" />
                Docentes ({filtered.length})
              </h2>
              <div className="flex flex-wrap gap-1">
                {(["TODAS", ...SEDES] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSedeFiltro(s)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                      sedeFiltro === s
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-muted-foreground border-border hover:bg-muted/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar docente…"
                  className="pl-8 h-9"
                  data-testid="input-search-docente"
                />
              </div>
            </div>
            <div className="overflow-auto flex-1">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Sin coincidencias</div>
              ) : (
                SEDES.filter((s) => (teachersGrouped.get(s) ?? []).length > 0).map((sede) => (
                  <div key={sede}>
                    <div className="sticky top-0 z-[1] px-3 py-1.5 bg-slate-100 border-y border-border/40 text-[10px] font-bold uppercase tracking-wide text-slate-700 flex items-center justify-between">
                      <span>📍 {sede}</span>
                      <span className="text-slate-500">{(teachersGrouped.get(sede) ?? []).length}</span>
                    </div>
                    {(teachersGrouped.get(sede) ?? []).map((t) => (
                      <button
                        key={`${sede}-${t.nombre}`}
                        onClick={() => setSelected(t.nombre)}
                        className={`w-full text-left px-4 py-2.5 text-sm border-b border-border/30 transition-colors flex items-center gap-2 ${
                          selected === t.nombre ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-muted/40"
                        }`}
                        data-testid={`button-docente-${t.nombre}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{t.nombre}</div>
                          <div className="text-[10px] text-muted-foreground flex gap-1 mt-0.5 flex-wrap">
                            {t.carreras.map((c) => (
                              <Badge key={c} variant="outline" className="text-[9px] px-1 py-0 h-4">{c}</Badge>
                            ))}
                            <span className="ml-1">{t.sesiones} ses.</span>
                            {(uploadedByDocente.get(t.nombre) || 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5 ml-1 text-emerald-600 font-semibold">
                                <CheckCircle2 className="h-3 w-3" />
                                {uploadedByDocente.get(t.nombre)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cursos del docente */}
          <div className="lg:col-span-8 bg-white rounded-lg border border-border/50 shadow-sm flex flex-col max-h-[80vh]">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-12 text-center">
                <div>
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Selecciona un docente para ver sus cursos</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-border/50">
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Cursos de <span className="text-primary">{selected}</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{cursos.length} cursos · click en "Planilla" para importar/ver el Excel y el horario del aula</p>
                </div>
                <div className="overflow-auto flex-1">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-center font-semibold w-8"></th>
                        <th className="px-3 py-2 text-left font-semibold">Carrera</th>
                        <th className="px-3 py-2 text-center font-semibold">Ciclo</th>
                        <th className="px-3 py-2 text-center font-semibold">Sec</th>
                        <th className="px-3 py-2 text-left font-semibold">Código</th>
                        <th className="px-3 py-2 text-left font-semibold">Curso</th>
                        <th className="px-3 py-2 text-left font-semibold">Modalidad</th>
                        <th className="px-3 py-2 text-center font-semibold">Sesiones</th>
                        <th className="px-3 py-2 text-right font-semibold">Asistencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cursos.map((c, i) => {
                        const isUploaded = uploaded.has(`${selected}|${c.codigo}|${c.seccion}`);
                        return (
                        <tr key={i} className={`${i % 2 ? "bg-muted/20" : ""} ${isUploaded ? "bg-emerald-50/40" : ""}`}>
                          <td className="px-3 py-2 text-center">
                            {isUploaded && (
                              <span title="Planilla subida">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 inline-block" />
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[10px]">{c.carrera}</Badge>
                          </td>
                          <td className="px-3 py-2 text-center font-semibold">{c.ciclo}</td>
                          <td className="px-3 py-2 text-center font-mono">{c.seccion}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{c.codigo}</td>
                          <td className="px-3 py-2 font-medium max-w-[220px]">
                            <span className="line-clamp-2">{c.curso}</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{c.modalidad}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{c.sesiones}</td>
                          <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 gap-1 text-[10px] border-blue-300 text-blue-700 hover:bg-blue-50"
                              onClick={() => exportarCurso(c)}
                              disabled={exportingCurso === `${c.codigo}|${c.seccion}`}
                              title="Descargar Excel de este curso"
                              data-testid={`button-excel-curso-${i}`}
                            >
                              {exportingCurso === `${c.codigo}|${c.seccion}`
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Download className="h-3.5 w-3.5" />}
                              Excel
                            </Button>
                            <Button
                              size="sm"
                              variant={isUploaded ? "outline" : "default"}
                              className={`h-7 px-2.5 gap-1.5 text-[10px] ${isUploaded ? "border-emerald-500 text-emerald-700 hover:bg-emerald-50" : ""}`}
                              onClick={() => setAsistenciaCurso({
                                docente: selected,
                                codigoCurso: c.codigo,
                                nombreCurso: c.curso,
                                carrera: c.carrera,
                                ciclo: c.ciclo,
                                seccion: c.seccion,
                                turno: c.turno || turnoFromHora(c.hora),
                                sede: c.local,
                                modalidad: c.modalidad,
                                dia: c.dia,
                              })}
                              data-testid={`button-planilla-${i}`}
                            >
                              {isUploaded ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                              {isUploaded ? "Subida" : "Planilla"}
                            </Button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {asistenciaCurso && (
        <AsistenciaPlanillaDialog
          open={!!asistenciaCurso}
          curso={asistenciaCurso}
          onClose={() => { setAsistenciaCurso(null); loadUploaded(); }}
          allRows={data}
        />
      )}
    </div>
  );
}
