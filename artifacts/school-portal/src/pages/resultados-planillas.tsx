import { useEffect, useMemo, useState } from "react";
import {
  Search, Loader2, GraduationCap, BookOpen, ChevronRight,
  ClipboardCheck, User as UserIcon, Download, Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ExcelJS from "exceljs";

type PlanRow = {
  carrera: string;
  carreraFull?: string;
  facultad?: string;
  ciclo: string;
  seccion: string;
  codigo: string;
  curso: string;
  docente?: string | null;
  modalidad?: string | null;
  horas?: number | null;
};

const PLAN_FILES = ["planificacion-fica-2026-1.json", "planificacion-fcs-2026-1.json"];

// Carreras a excluir (no existen en la planificación oficial)
const EXCLUDED_CARRERAS = new Set(["T3"]); // T3 = FARMACIA Y BIOQUÍMICA
// Ciclos permitidos
const ALLOWED_CICLOS = new Set(["1", "2"]);

async function loadPlanificacion(): Promise<PlanRow[]> {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const out: PlanRow[] = [];
  for (const f of PLAN_FILES) {
    try {
      const r = await fetch(`${base}/${f}`);
      if (!r.ok) continue;
      const arr = (await r.json()) as PlanRow[];
      for (const row of arr) {
        if (EXCLUDED_CARRERAS.has(row.carrera)) continue;
        if (!ALLOWED_CICLOS.has(String(row.ciclo))) continue;
        out.push(row);
      }
    } catch { /* ignore */ }
  }
  return out;
}

const cicloOrder = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 999 : n;
};

export default function ResultadosPlanillas() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [search, setSearch] = useState("");
  const [openCarrera, setOpenCarrera] = useState<string | null>(null);
  const [openCiclo, setOpenCiclo] = useState<string | null>(null);
  const [openSeccion, setOpenSeccion] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setRows(await loadPlanificacion());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Carrera → Ciclo → Sección → Cursos (únicos por código). */
  const grouped = useMemo(() => {
    type CursoItem = { codigo: string; curso: string; docentes: Set<string>; modalidad?: string | null; horas: number };
    type SeccionGroup = { seccion: string; cursos: Map<string, CursoItem> };
    type CicloGroup = { ciclo: string; secciones: Map<string, SeccionGroup> };
    type CarreraGroup = { carrera: string; carreraFull: string; ciclos: Map<string, CicloGroup> };

    const carrMap = new Map<string, CarreraGroup>();
    for (const p of rows) {
      const cKey = p.carrera || "—";
      if (!carrMap.has(cKey)) {
        carrMap.set(cKey, { carrera: cKey, carreraFull: p.carreraFull || cKey, ciclos: new Map() });
      }
      const cg = carrMap.get(cKey)!;
      if (p.carreraFull && !cg.carreraFull) cg.carreraFull = p.carreraFull;

      const iKey = p.ciclo || "—";
      if (!cg.ciclos.has(iKey)) cg.ciclos.set(iKey, { ciclo: iKey, secciones: new Map() });
      const ig = cg.ciclos.get(iKey)!;

      const sKey = p.seccion || "—";
      if (!ig.secciones.has(sKey)) ig.secciones.set(sKey, { seccion: sKey, cursos: new Map() });
      const sg = ig.secciones.get(sKey)!;

      const code = p.codigo || "—";
      if (!sg.cursos.has(code)) {
        sg.cursos.set(code, {
          codigo: code,
          curso: p.curso || code,
          docentes: new Set<string>(),
          modalidad: p.modalidad || null,
          horas: 0,
        });
      }
      const ci = sg.cursos.get(code)!;
      if (p.docente) ci.docentes.add(p.docente);
      if (p.horas && p.horas > ci.horas) ci.horas = p.horas;
    }

    return Array.from(carrMap.values())
      .map(g => ({
        ...g,
        ciclosArr: Array.from(g.ciclos.values())
          .map(ic => ({
            ...ic,
            seccionesArr: Array.from(ic.secciones.values())
              .map(sc => ({
                ...sc,
                cursosArr: Array.from(sc.cursos.values()).sort((a, b) => a.curso.localeCompare(b.curso, "es")),
              }))
              .sort((a, b) => a.seccion.localeCompare(b.seccion, "es")),
          }))
          .sort((a, b) => cicloOrder(a.ciclo) - cicloOrder(b.ciclo)),
      }))
      .sort((a, b) => a.carreraFull.localeCompare(b.carreraFull, "es"));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return grouped;
    return grouped
      .map(g => ({
        ...g,
        ciclosArr: g.ciclosArr
          .map(ic => ({
            ...ic,
            seccionesArr: ic.seccionesArr
              .map(sc => ({
                ...sc,
                cursosArr: sc.cursosArr.filter(c =>
                  c.curso.toLowerCase().includes(q) ||
                  c.codigo.toLowerCase().includes(q) ||
                  Array.from(c.docentes).some(d => d.toLowerCase().includes(q)),
                ),
              }))
              .filter(sc =>
                sc.cursosArr.length > 0 ||
                sc.seccion.toLowerCase().includes(q) ||
                `${ic.ciclo}.${sc.seccion}`.toLowerCase().includes(q),
              ),
          }))
          .filter(ic => ic.seccionesArr.length > 0 || ic.ciclo.toLowerCase().includes(q)),
      }))
      .filter(g =>
        g.carrera.toLowerCase().includes(q) ||
        g.carreraFull.toLowerCase().includes(q) ||
        g.ciclosArr.length > 0,
      );
  }, [grouped, search]);

  const totals = useMemo(() => {
    let secciones = 0, cursos = 0;
    for (const g of grouped) {
      for (const ic of g.ciclosArr) {
        secciones += ic.seccionesArr.length;
        for (const sc of ic.seccionesArr) cursos += sc.cursosArr.length;
      }
    }
    return { carreras: grouped.length, secciones, cursos };
  }, [grouped]);

  const downloadAll = async () => {
    if (grouped.length === 0) return;
    setDownloading(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Portal Académico UAI";
      wb.created = new Date();

      // Intentar cargar el logo (opcional)
      let logoId: number | null = null;
      try {
        const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
        const r = await fetch(`${base}/uai-logo.png`);
        if (r.ok) {
          const buf = await r.arrayBuffer();
          logoId = wb.addImage({ buffer: buf, extension: "png" });
        }
      } catch { /* sin logo */ }

      const usedNames = new Set<string>();
      const sheetName = (raw: string) => {
        let n = raw.replace(/[\\/*?:[\]]/g, " ").slice(0, 31).trim();
        if (!n) n = "Hoja";
        let candidate = n, i = 2;
        while (usedNames.has(candidate.toLowerCase())) {
          const suf = ` (${i++})`;
          candidate = n.slice(0, 31 - suf.length) + suf;
        }
        usedNames.add(candidate.toLowerCase());
        return candidate;
      };

      const SEMANAS = 16;
      const STUDENT_ROWS = 40;

      const buildSheet = (
        carreraFull: string,
        ciclo: string,
        seccion: string,
        codigo: string,
        curso: string,
        docente: string,
        modalidad: string,
      ) => {
        const sectionLabel = `${ciclo}${seccion}`;
        const ws = wb.addWorksheet(sheetName(`${carreraFull.slice(0, 10)} ${sectionLabel} ${codigo}`));
        ws.pageSetup = {
          orientation: "landscape",
          paperSize: 9,
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 1,
          margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
        };

        // Cabecera fija (columnas A..G) + 16 semanas × 3 cols (T,P,TOTAL) + OBSERVACIONES
        const fixedCols = ["N°", "APELLIDOS Y NOMBRES", "CICLO", "SECCION", "LOCAL", "PROGRAMA", "CURSO"];
        const totalCols = fixedCols.length + SEMANAS * 3 + 1;

        // Logo (si está disponible) en A1:B4
        if (logoId !== null) {
          ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 110, height: 70 } });
        }

        // Filas de cabecera institucional
        ws.mergeCells(1, 3, 1, totalCols);
        const r1 = ws.getCell(1, 3);
        r1.value = "UNIVERSIDAD AUTONOMA DE ICA";
        r1.font = { bold: true, size: 13 };
        r1.alignment = { horizontal: "center", vertical: "middle" };

        ws.mergeCells(2, 3, 2, totalCols);
        const r2 = ws.getCell(2, 3);
        r2.value = "GENERACIÓN QUE INSPIRA EL CAMBIO";
        r2.font = { italic: true, size: 10 };
        r2.alignment = { horizontal: "center" };

        ws.mergeCells(3, 1, 3, totalCols);
        const r3 = ws.getCell(3, 1);
        r3.value = "DEPARTAMENTO ACADÉMICO DE ESTUDIOS GENERALES";
        r3.font = { bold: true, size: 11 };
        r3.alignment = { horizontal: "center" };
        r3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };

        ws.mergeCells(4, 1, 4, totalCols);
        const r4 = ws.getCell(4, 1);
        r4.value = "REPORTE DE ASISTENCIAS, INASISTENCIAS DE ESTUDIANTES DEL DEPARTAMENTO DE ESTUDIOS GENERALES";
        r4.font = { bold: true, size: 11, color: { argb: "FF7F1D1D" } };
        r4.alignment = { horizontal: "center" };
        r4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };

        // Datos del curso (fila 5 y 6)
        const halfCol = Math.max(8, Math.floor(totalCols / 2));
        const setLabel = (row: number, col: number, label: string, value: string, valueColSpan: number) => {
          const lbl = ws.getCell(row, col);
          lbl.value = label;
          lbl.font = { bold: true, size: 9 };
          ws.mergeCells(row, col + 1, row, col + valueColSpan);
          const val = ws.getCell(row, col + 1);
          val.value = value;
          val.font = { size: 9 };
          val.alignment = { horizontal: "left", vertical: "middle" };
          val.border = { bottom: { style: "thin" } };
        };
        setLabel(5, 1, "PROGRAMA ACADÉMICO:", carreraFull, 4);
        setLabel(5, halfCol, "CICLO:", `${ciclo}${seccion}`, 3);
        setLabel(6, 1, "SEDE:", "CHINCHA", 4);
        setLabel(6, halfCol, "HORA DE INICIO:", "", 3);
        setLabel(7, 1, "FECHA:", "", 4);
        setLabel(7, halfCol, "HORA DE TERMINO:", "", 3);
        setLabel(8, 1, "DOCENTE:", docente, 4);
        setLabel(9, 1, "CURSO:", curso, 4);
        setLabel(9, halfCol, "MODALIDAD:", modalidad, 3);

        // Cabecera de la tabla — 2 filas
        const headerTop = 11;
        const headerBot = 12;

        // Columnas fijas (merge vertical en cabecera)
        fixedCols.forEach((label, idx) => {
          const col = idx + 1;
          ws.mergeCells(headerTop, col, headerBot, col);
          const cell = ws.getCell(headerTop, col);
          cell.value = label;
          cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          cell.border = {
            top: { style: "thin" }, bottom: { style: "thin" },
            left: { style: "thin" }, right: { style: "thin" },
          };
        });

        // "FECHAS" header agrupado
        const semStart = fixedCols.length + 1;
        ws.mergeCells(headerTop, semStart, headerTop, semStart + SEMANAS * 3 - 1);
        const fechasCell = ws.getCell(headerTop, semStart);
        fechasCell.value = "FECHAS";
        fechasCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        fechasCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
        fechasCell.alignment = { horizontal: "center", vertical: "middle" };

        // SEMANA n (merge 3 cols) en headerBot y T/P/TOTAL en tptRow
        for (let s = 0; s < SEMANAS; s++) {
          const col = semStart + s * 3;
          // SEMANA n en fila headerBot
          ws.mergeCells(headerBot, col, headerBot, col + 2);
          const semCell = ws.getCell(headerBot, col);
          semCell.value = `SEMANA ${s + 1}`;
          semCell.font = { bold: true, size: 8, color: { argb: "FFFFFFFF" } };
          semCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
          semCell.alignment = { horizontal: "center", vertical: "middle", textRotation: 90 };
          semCell.border = {
            top: { style: "thin" }, bottom: { style: "thin" },
            left: { style: "thin" }, right: { style: "thin" },
          };
        }

        // Fila headerBot+1 = T / P / TOTAL para cada semana
        const tptRow = headerBot + 1;
        for (let s = 0; s < SEMANAS; s++) {
          const col = semStart + s * 3;
          (["T", "P", "TOTAL"] as const).forEach((lab, k) => {
            const cell = ws.getCell(tptRow, col + k);
            cell.value = lab;
            cell.font = { bold: true, size: 8, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = {
              top: { style: "thin" }, bottom: { style: "thin" },
              left: { style: "thin" }, right: { style: "thin" },
            };
          });
        }

        // Pintamos la fila tptRow en las columnas fijas para que la cabecera se vea continua
        fixedCols.forEach((_, idx) => {
          const col = idx + 1;
          const cell = ws.getCell(tptRow, col);
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
          cell.border = {
            top: { style: "thin" }, bottom: { style: "thin" },
            left: { style: "thin" }, right: { style: "thin" },
          };
        });

        // Columna OBSERVACIONES al final
        const obsCol = totalCols;
        ws.mergeCells(headerTop, obsCol, tptRow, obsCol);
        const obsCell = ws.getCell(headerTop, obsCol);
        obsCell.value = "OBSERVACIONES";
        obsCell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
        obsCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
        obsCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        obsCell.border = {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" },
        };

        // Filas de estudiantes (vacías, listas para llenar)
        const dataStart = tptRow + 1;
        for (let i = 0; i < STUDENT_ROWS; i++) {
          const r = dataStart + i;
          const numCell = ws.getCell(r, 1);
          numCell.value = String(i + 1).padStart(2, "0");
          numCell.alignment = { horizontal: "center" };
          numCell.font = { size: 9 };
          // Pre-rellenamos los datos repetidos (CICLO/SECCION/LOCAL/PROGRAMA/CURSO)
          ws.getCell(r, 3).value = ciclo;
          ws.getCell(r, 4).value = seccion;
          ws.getCell(r, 5).value = "CHINCHA";
          ws.getCell(r, 6).value = carreraFull.slice(0, 8).toUpperCase();
          ws.getCell(r, 7).value = curso;
          for (let c = 1; c <= totalCols; c++) {
            const cell = ws.getCell(r, c);
            if (!cell.font) cell.font = { size: 9 };
            cell.border = {
              top: { style: "thin", color: { argb: "FFD1D5DB" } },
              bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
              left: { style: "thin", color: { argb: "FFD1D5DB" } },
              right: { style: "thin", color: { argb: "FFD1D5DB" } },
            };
            if (c >= 3 && c <= 7) cell.alignment = { horizontal: "center", vertical: "middle" };
          }
        }

        // Anchos de columna
        ws.getColumn(1).width = 4;    // N°
        ws.getColumn(2).width = 32;   // APELLIDOS Y NOMBRES
        ws.getColumn(3).width = 6;    // CICLO
        ws.getColumn(4).width = 7;    // SECCION
        ws.getColumn(5).width = 9;    // LOCAL
        ws.getColumn(6).width = 11;   // PROGRAMA
        ws.getColumn(7).width = 18;   // CURSO
        for (let s = 0; s < SEMANAS; s++) {
          const col = semStart + s * 3;
          ws.getColumn(col).width = 3;
          ws.getColumn(col + 1).width = 3;
          ws.getColumn(col + 2).width = 5;
        }
        ws.getColumn(obsCol).width = 18;

        // Altura de cabeceras
        ws.getRow(headerBot).height = 50;
        ws.getRow(tptRow).height = 16;

        // Vista
        ws.views = [{ state: "frozen", xSplit: 2, ySplit: tptRow }];
      };

      // Hoja índice
      const idx = wb.addWorksheet("Índice");
      idx.columns = [
        { header: "Carrera", key: "carrera", width: 36 },
        { header: "Ciclo.Sección", key: "secc", width: 14 },
        { header: "Código", key: "codigo", width: 14 },
        { header: "Curso", key: "curso", width: 40 },
        { header: "Docente", key: "docente", width: 36 },
      ];
      idx.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      idx.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
      usedNames.add("índice");

      // Generar una hoja por (carrera × ciclo × sección × curso)
      let count = 0;
      for (const g of grouped) {
        for (const ic of g.ciclosArr) {
          for (const sc of ic.seccionesArr) {
            for (const c of sc.cursosArr) {
              const docente = Array.from(c.docentes).join(" / ") || "—";
              buildSheet(g.carreraFull, ic.ciclo, sc.seccion, c.codigo, c.curso, docente, c.modalidad || "PRESENCIAL");
              idx.addRow({
                carrera: g.carreraFull,
                secc: `${ic.ciclo}.${sc.seccion}`,
                codigo: c.codigo,
                curso: c.curso,
                docente,
              });
              count++;
            }
          }
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Plantillas_Asistencia_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Excel generado", description: `${count} plantillas listas para usar.` });
    } catch (err) {
      console.error(err);
      toast({ title: "Error al generar Excel", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Plantilla de Cursos por Sección
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estructura completa según la planificación: cada carrera dividida por ciclo y sección
            (ej. <span className="font-mono">ADMINISTRACION DE EMPRESAS 1.C</span>) con todos sus cursos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">{totals.carreras} carreras</Badge>
          <Badge variant="outline" className="text-xs">{totals.secciones} secciones</Badge>
          <Badge variant="outline" className="text-xs">{totals.cursos} cursos</Badge>
          <Button
            size="sm"
            onClick={downloadAll}
            disabled={downloading || grouped.length === 0}
            className="gap-1.5"
            data-testid="button-descargar-excel"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar Excel
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por carrera, ciclo, sección, curso o docente…"
          className="pl-8 h-9"
          data-testid="input-search-resultados"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando planificación…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground border-2 border-dashed rounded">
          No hay resultados.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => {
            const carreraOpen = openCarrera === g.carrera;
            const totalSecciones = g.ciclosArr.reduce((a, ic) => a + ic.seccionesArr.length, 0);
            const totalCursos = g.ciclosArr.reduce(
              (a, ic) => a + ic.seccionesArr.reduce((b, sc) => b + sc.cursosArr.length, 0), 0);
            return (
              <div key={g.carrera} className="bg-white rounded-lg border border-border/50 shadow-sm overflow-hidden">
                <button
                  onClick={() => { setOpenCarrera(carreraOpen ? null : g.carrera); setOpenCiclo(null); setOpenSeccion(null); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  data-testid={`button-resultado-carrera-${g.carrera}`}
                >
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${carreraOpen ? "rotate-90" : ""}`} />
                  <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                      <span className="uppercase">{g.carreraFull}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{g.carrera}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {g.ciclosArr.length} ciclos · {totalSecciones} secciones · {totalCursos} cursos
                    </div>
                  </div>
                </button>

                {carreraOpen && (
                  <div className="border-t bg-muted/10">
                    {g.ciclosArr.map((ic) => {
                      const cicloKey = `${g.carrera}|${ic.ciclo}`;
                      const cicloOpen = openCiclo === cicloKey;
                      const cicloCursos = ic.seccionesArr.reduce((a, sc) => a + sc.cursosArr.length, 0);
                      return (
                        <div key={cicloKey} className="border-b last:border-b-0">
                          <button
                            onClick={() => { setOpenCiclo(cicloOpen ? null : cicloKey); setOpenSeccion(null); }}
                            className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-blue-50/50 transition-colors text-left bg-blue-50/20"
                            data-testid={`button-resultado-ciclo-${ic.ciclo}`}
                          >
                            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${cicloOpen ? "rotate-90" : ""}`} />
                            <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px]">CICLO {ic.ciclo}</Badge>
                            <div className="flex-1 min-w-0 text-xs text-muted-foreground">
                              {ic.seccionesArr.length} sección(es) · {cicloCursos} cursos
                            </div>
                          </button>

                          {cicloOpen && (
                            <div className="bg-white">
                              {ic.seccionesArr.map((sc) => {
                                const seccKey = `${cicloKey}|${sc.seccion}`;
                                const seccOpen = openSeccion === seccKey;
                                const label = `${g.carreraFull} ${ic.ciclo}.${sc.seccion}`;
                                return (
                                  <div key={seccKey} className="border-t">
                                    <button
                                      onClick={() => setOpenSeccion(seccOpen ? null : seccKey)}
                                      className="w-full flex items-center gap-3 px-8 py-2 hover:bg-amber-50/60 transition-colors text-left bg-amber-50/30"
                                      data-testid={`button-resultado-seccion-${sc.seccion}`}
                                    >
                                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${seccOpen ? "rotate-90" : ""}`} />
                                      <Layers className="h-4 w-4 text-amber-700" />
                                      <Badge variant="outline" className="bg-amber-100 border-amber-300 text-amber-900 text-[10px] font-mono">
                                        {ic.ciclo}.{sc.seccion}
                                      </Badge>
                                      <span className="text-sm font-semibold text-amber-900 uppercase truncate">{label}</span>
                                      <div className="flex-1" />
                                      <span className="text-xs text-muted-foreground">{sc.cursosArr.length} cursos</span>
                                    </button>

                                    {seccOpen && (
                                      <div className="px-8 pb-4 pt-2 bg-white">
                                        <table className="w-full text-xs border rounded overflow-hidden">
                                          <thead className="bg-slate-100 text-slate-700">
                                            <tr>
                                              <th className="px-2 py-1.5 text-left w-28">Código</th>
                                              <th className="px-2 py-1.5 text-left">Curso</th>
                                              <th className="px-2 py-1.5 text-left">Docente</th>
                                              <th className="px-2 py-1.5 text-left w-24">Modalidad</th>
                                              <th className="px-2 py-1.5 text-right w-14">Horas</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {sc.cursosArr.map((c, i) => (
                                              <tr key={c.codigo} className={i % 2 ? "bg-slate-50/60" : ""}>
                                                <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{c.codigo}</td>
                                                <td className="px-2 py-1.5 flex items-center gap-1.5">
                                                  <BookOpen className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                                                  <span className="font-medium">{c.curso}</span>
                                                </td>
                                                <td className="px-2 py-1.5">
                                                  {Array.from(c.docentes).map((d, k) => (
                                                    <span key={k} className="inline-flex items-center gap-1 mr-2">
                                                      <UserIcon className="h-3 w-3 text-muted-foreground" />{d}
                                                    </span>
                                                  ))}
                                                </td>
                                                <td className="px-2 py-1.5 text-muted-foreground">{c.modalidad || "—"}</td>
                                                <td className="px-2 py-1.5 text-right font-mono">{c.horas || "—"}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
