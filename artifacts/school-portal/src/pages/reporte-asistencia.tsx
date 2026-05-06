import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Search, Download, ClipboardCheck, ChevronUp, ChevronDown,
} from "lucide-react";
import * as ExcelJS from "exceljs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLogPageEntry } from "@/hooks/use-activity-log";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

type PlanillaItem = {
  id: number; docente: string | null; carrera: string | null; ciclo: string | null;
  seccion: string | null; codigoCurso: string | null; nombreCurso: string | null; sede: string | null;
};
type AlumnoRow = { numero: string; nombre: string; marcas: string[] };
type PlanillaDetail = PlanillaItem & {
  weeks: Array<{ label: string; fecha?: string; dia?: string; slots?: 1 | 2 }>;
  alumnos: AlumnoRow[];
};

type Fila = {
  docente: string;
  curso: string;
  codigo: string;
  seccion: string;
  local: string;
  codAlumno: string;
  alumno: string;
  presentes: number;
  ausentes: number;
  pct: number;
  estado: "APROBADO" | "DESAPROBADO";
};

type SortKey = keyof Fila;

const sedeLabel = (v: string | null | undefined) => {
  const s = (v || "").toUpperCase().trim();
  if (!s || s === "PRINCIPAL" || s === "ICA") return "PRINCIPAL";
  if (s === "FILIAL" || s === "CHINCHA") return "FILIAL";
  return s;
};

export default function ReporteAsistencia() {
  useLogPageEntry("Reporte de Asistencia");
  const { toast } = useToast();

  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch]       = useState("");
  const [sedeF, setSedeF]         = useState("TODAS");
  const [docenteF, setDocenteF]   = useState("TODOS");
  const [estadoF, setEstadoF]     = useState<"TODOS" | "APROBADO" | "DESAPROBADO">("TODOS");
  const [sortKey, setSortKey]     = useState<SortKey>("docente");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");

  const abortRef = useRef<AbortController | null>(null);

  const cargar = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setLoaded(false);
    setFilas([]);

    try {
      const r = await fetch(`${apiBase}/api/asistencia-planillas`, {
        credentials: "include", signal: ctrl.signal,
      });
      if (!r.ok) throw new Error("list");
      const list = (await r.json()) as PlanillaItem[];

      const detalles = await Promise.all(
        list.map(async (p) => {
          try {
            const d = await fetch(`${apiBase}/api/asistencia-planillas/${p.id}`, {
              credentials: "include", signal: ctrl.signal,
            });
            if (!d.ok) return null;
            return (await d.json()) as PlanillaDetail;
          } catch { return null; }
        })
      );

      const out: Fila[] = [];
      for (const det of detalles) {
        if (!det) continue;
        const weeksLen = det.weeks?.length || 0;
        let maxMarcas = 0;
        for (const a of det.alumnos || []) {
          if ((a.marcas?.length || 0) > maxMarcas) maxMarcas = a.marcas.length;
        }
        const N = weeksLen > 0 ? weeksLen : Math.ceil(maxMarcas / 2);

        for (const a of det.alumnos || []) {
          let pres = 0, inas = 0;
          for (let w = 0; w < N; w++) {
            const m1 = (a.marcas?.[w * 2]     || "").toUpperCase().trim();
            const m2 = (a.marcas?.[w * 2 + 1] || "").toUpperCase().trim();
            if (m1 === "F" || m2 === "F") inas++;
            else if (m1 === "A" || m2 === "A") pres++;
          }
          const total = pres + inas;
          const pct = total > 0 ? Math.round((pres / total) * 10000) / 100 : 0;
          out.push({
            docente:   (det.docente   || "").toUpperCase(),
            curso:     (det.nombreCurso || "").toUpperCase(),
            codigo:    (det.codigoCurso || "").toUpperCase(),
            seccion:   (det.seccion   || "").toUpperCase(),
            local:     sedeLabel(det.sede),
            codAlumno: (a.numero || "").toUpperCase(),
            alumno:    (a.nombre  || "").toUpperCase(),
            presentes: pres,
            ausentes:  inas,
            pct,
            estado:    pres === 0 ? "DESAPROBADO" : "APROBADO",
          });
        }
      }
      setFilas(out);
      setLoaded(true);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        toast({ title: "Error al cargar", description: String(e.message), variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Derivados ─────────────────────────────────────────────────── */
  const sedes    = useMemo(() => ["TODAS", ...Array.from(new Set(filas.map(f => f.local))).sort()], [filas]);
  const docentes = useMemo(() => ["TODOS", ...Array.from(new Set(filas.map(f => f.docente))).sort()], [filas]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return filas.filter(f => {
      if (sedeF    !== "TODAS"  && f.local    !== sedeF)    return false;
      if (docenteF !== "TODOS"  && f.docente  !== docenteF) return false;
      if (estadoF  !== "TODOS"  && f.estado   !== estadoF)  return false;
      if (q && ![f.alumno, f.codAlumno, f.curso, f.codigo, f.docente, f.seccion].some(v => v.includes(q))) return false;
      return true;
    });
  }, [filas, sedeF, docenteF, estadoF, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  /* ── Estadísticas resumen ──────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = filtered.length;
    const apro  = filtered.filter(f => f.estado === "APROBADO").length;
    const des   = total - apro;
    return { total, apro, des };
  }, [filtered]);

  /* ── Exportar Excel ────────────────────────────────────────────── */
  const exportar = async () => {
    if (!sorted.length) return;
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Reporte");

      const NAVY = "001f5f"; const GOLD = "c9a84c"; const WHITE = "FFFFFF";
      const RED  = "b91c1c"; const GREEN = "15803d";

      ws.columns = [
        { key: "docente",   width: 38 },
        { key: "curso",     width: 40 },
        { key: "codigo",    width: 14 },
        { key: "seccion",   width: 10 },
        { key: "local",     width: 12 },
        { key: "codAlumno", width: 16 },
        { key: "alumno",    width: 38 },
        { key: "pres",      width: 12 },
        { key: "aus",       width: 12 },
        { key: "pct",       width: 14 },
        { key: "estado",    width: 15 },
      ];

      const header = ws.addRow([
        "Docente","Curso","Código","Sección","Local",
        "COD ALUMNO","Alumno","Presentes","Ausentes","% Asistencia","Estado",
      ]);
      header.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
        cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: GOLD } },
          bottom: { style: "thin", color: { argb: GOLD } },
          left: { style: "thin", color: { argb: GOLD } },
          right: { style: "thin", color: { argb: GOLD } },
        };
      });
      header.height = 22;

      sorted.forEach((f, i) => {
        const row = ws.addRow([
          f.docente, f.curso, f.codigo, f.seccion, f.local,
          f.codAlumno, f.alumno, f.presentes, f.ausentes, f.pct, f.estado,
        ]);
        const bg = i % 2 === 0 ? "F8F9FA" : "FFFFFF";
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
          cell.font = { size: 9 };
          cell.alignment = { vertical: "middle" };
          cell.border = {
            left:  { style: "hair", color: { argb: "DDDDDD" } },
            right: { style: "hair", color: { argb: "DDDDDD" } },
            bottom:{ style: "hair", color: { argb: "DDDDDD" } },
          };
        });
        // color estado
        const estadoCell = row.getCell(11);
        const isApro = f.estado === "APROBADO";
        estadoCell.font = { bold: true, color: { argb: isApro ? GREEN : RED }, size: 9 };
        // color pct
        const pctCell = row.getCell(10);
        pctCell.numFmt = "0.00";
        pctCell.alignment = { horizontal: "center" };
        // numeric cols center
        [8, 9].forEach(c => { row.getCell(c).alignment = { horizontal: "center" }; });
      });

      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.autoFilter = { from: "A1", to: "K1" };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = `UAI-Reporte-Asistencia-${date}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast({ title: "Excel generado", description: `${sorted.length} filas exportadas.` });
    } catch (e: any) {
      toast({ title: "Error al exportar", description: String(e.message), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  /* ── Columnas de la tabla ──────────────────────────────────────── */
  const cols: { key: SortKey; label: string; cls?: string }[] = [
    { key: "docente",   label: "Docente" },
    { key: "curso",     label: "Curso" },
    { key: "codigo",    label: "Código",   cls: "hidden md:table-cell" },
    { key: "seccion",   label: "Secc.",    cls: "hidden md:table-cell" },
    { key: "local",     label: "Local",    cls: "hidden lg:table-cell" },
    { key: "codAlumno", label: "Cód. Alumno", cls: "hidden lg:table-cell" },
    { key: "alumno",    label: "Alumno" },
    { key: "presentes", label: "Pres.",    cls: "text-center" },
    { key: "ausentes",  label: "Aus.",     cls: "text-center" },
    { key: "pct",       label: "% Asist.", cls: "text-center hidden sm:table-cell" },
    { key: "estado",    label: "Estado",   cls: "text-center" },
  ];

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? null :
    sortDir === "asc"
      ? <ChevronUp className="inline h-3 w-3 ml-0.5" />
      : <ChevronDown className="inline h-3 w-3 ml-0.5" />;

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-indigo-600" />
            Reporte de Asistencia 2026-1
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Resumen por alumno generado desde las planillas importadas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={cargar} disabled={loading} variant="outline" className="gap-2">
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</>
              : loaded ? "↺ Recargar" : "Cargar datos"
            }
          </Button>
          {loaded && (
            <Button
              onClick={exportar}
              disabled={exporting || !sorted.length}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {exporting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
                : <><Download className="h-4 w-4" /> Excel</>
              }
            </Button>
          )}
        </div>
      </div>

      {!loaded && !loading && (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-3">
          <ClipboardCheck className="h-12 w-12 opacity-20" />
          <p className="text-sm">Presiona <strong>Cargar datos</strong> para generar el reporte.</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-3">
          <Loader2 className="h-10 w-10 animate-spin opacity-40" />
          <p className="text-sm">Calculando reporte desde las planillas…</p>
        </div>
      )}

      {loaded && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total alumnos",  val: stats.total, color: "text-gray-800" },
              { label: "Aprobados",      val: stats.apro,  color: "text-emerald-700" },
              { label: "Desaprobados",   val: stats.des,   color: "text-rose-700" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white rounded-xl border border-border/60 p-4 text-center shadow-sm">
                <div className={`text-3xl font-bold ${color}`}>{val.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar alumno, código, curso…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Select value={sedeF} onValueChange={setSedeF}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Local" /></SelectTrigger>
              <SelectContent>
                {sedes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={docenteF} onValueChange={setDocenteF}>
              <SelectTrigger className="w-56 h-9 text-xs"><SelectValue placeholder="Docente" /></SelectTrigger>
              <SelectContent>
                {docentes.map(d => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={estadoF} onValueChange={v => setEstadoF(v as typeof estadoF)}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="APROBADO">Aprobado</SelectItem>
                <SelectItem value="DESAPROBADO">Desaprobado</SelectItem>
              </SelectContent>
            </Select>
            <span className="self-center text-xs text-muted-foreground whitespace-nowrap">
              {sorted.length.toLocaleString()} filas
            </span>
          </div>

          {/* Tabla */}
          <div className="rounded-xl border border-border/60 overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-[#001f5f] text-white">
                  <tr>
                    {cols.map(c => (
                      <th
                        key={c.key}
                        onClick={() => toggleSort(c.key)}
                        className={`px-3 py-2.5 font-semibold cursor-pointer select-none whitespace-nowrap hover:bg-[#003080] transition-colors ${c.cls ?? ""}`}
                      >
                        {c.label}<SortIcon k={c.key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={cols.length} className="text-center py-16 text-muted-foreground">
                        Sin resultados
                      </td>
                    </tr>
                  ) : sorted.map((f, i) => (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? "bg-white hover:bg-indigo-50/40" : "bg-gray-50/60 hover:bg-indigo-50/40"}
                    >
                      <td className="px-3 py-1.5 max-w-[220px] truncate" title={f.docente}>{f.docente}</td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate" title={f.curso}>{f.curso}</td>
                      <td className="px-3 py-1.5 hidden md:table-cell font-mono">{f.codigo}</td>
                      <td className="px-3 py-1.5 hidden md:table-cell text-center">{f.seccion}</td>
                      <td className="px-3 py-1.5 hidden lg:table-cell text-center">{f.local}</td>
                      <td className="px-3 py-1.5 hidden lg:table-cell font-mono">{f.codAlumno}</td>
                      <td className="px-3 py-1.5 max-w-[220px] truncate" title={f.alumno}>{f.alumno}</td>
                      <td className="px-3 py-1.5 text-center font-semibold text-emerald-700">{f.presentes}</td>
                      <td className="px-3 py-1.5 text-center font-semibold text-rose-700">{f.ausentes}</td>
                      <td className="px-3 py-1.5 text-center hidden sm:table-cell">{f.pct.toFixed(2)}%</td>
                      <td className="px-3 py-1.5 text-center">
                        <Badge
                          className={f.estado === "APROBADO"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-1.5"
                            : "bg-rose-100 text-rose-800 border-rose-200 text-[10px] px-1.5"
                          }
                          variant="outline"
                        >
                          {f.estado}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
