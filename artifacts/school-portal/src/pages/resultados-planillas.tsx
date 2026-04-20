import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Search, Download, GraduationCap, BookOpen } from "lucide-react";
import * as ExcelJS from "exceljs";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const UMBRAL = 6;

type PlanillaListItem = {
  id: number;
  docente: string | null;
  carrera: string | null;
  ciclo: string | null;
  seccion: string | null;
  codigoCurso: string | null;
  nombreCurso: string | null;
  sede: string | null;
  totalAlumnos: number;
};

type AlumnoRow = {
  numero: string;
  nombre: string;
  marcas: string[];
  porcentaje: number;
};

type PlanillaDetail = PlanillaListItem & {
  weeks: Array<{ label: string; fecha?: string; dia?: string }>;
  alumnos: AlumnoRow[];
};

type JaladoRow = {
  alumno: string;
  inasistencias: number;
  asistencias: number;
  porcentaje: number;
  curso: string;
  codigoCurso: string;
  docente: string;
  carrera: string;
  ciclo: string;
  seccion: string;
  sede: string;
  totalSemanas: number;
};

const sedeNorm = (v?: string | null) => {
  const s = (v || "").toUpperCase().trim();
  if (s === "PRINCIPAL" || s === "ICA" || s === "") return "SEDE";
  return s;
};

export default function ReporteJalados() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<JaladoRow[]>([]);
  const [search, setSearch] = useState("");
  const [sedeF, setSedeF] = useState<string>("TODAS");
  const [carreraF, setCarreraF] = useState<string>("TODAS");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${apiBase}/api/asistencia-planillas`, { credentials: "include" });
        if (!r.ok) throw new Error("list");
        const list = (await r.json()) as PlanillaListItem[];

        const detalles = await Promise.all(
          list.map(async (p) => {
            try {
              const d = await fetch(`${apiBase}/api/asistencia-planillas/${p.id}`, { credentials: "include" });
              if (!d.ok) return null;
              return (await d.json()) as PlanillaDetail;
            } catch { return null; }
          }),
        );

        const out: JaladoRow[] = [];
        for (const det of detalles) {
          if (!det) continue;
          const weeksLen = det.weeks?.length || 0;
          // Fallback: si la planilla quedó sin semanas pero tiene marcas, derivamos
          // el N a partir de la longitud máxima de marcas (2 slots por semana).
          let maxMarcas = 0;
          for (const a of det.alumnos || []) {
            if ((a.marcas?.length || 0) > maxMarcas) maxMarcas = a.marcas.length;
          }
          const N = weeksLen > 0 ? weeksLen : Math.ceil(maxMarcas / 2);
          for (const a of det.alumnos || []) {
            let asis = 0, inas = 0;
            for (let w = 0; w < N; w++) {
              const m1 = (a.marcas[w * 2]     || "").toUpperCase().trim();
              const m2 = (a.marcas[w * 2 + 1] || "").toUpperCase().trim();
              if (m1 === "F" || m2 === "F") inas++;
              else if (m1 === "A" || m2 === "A") asis++;
            }
            if (inas >= UMBRAL) {
              const total = asis + inas;
              out.push({
                alumno: a.nombre,
                inasistencias: inas,
                asistencias: asis,
                porcentaje: total > 0 ? Math.round((asis / total) * 1000) / 10 : 0,
                curso: det.nombreCurso || "",
                codigoCurso: det.codigoCurso || "",
                docente: det.docente || "",
                carrera: det.carrera || "",
                ciclo: det.ciclo || "",
                seccion: det.seccion || "",
                sede: sedeNorm(det.sede),
                totalSemanas: N,
              });
            }
          }
        }
        out.sort((a, b) => {
          const c = a.carrera.localeCompare(b.carrera, "es");
          if (c !== 0) return c;
          const ci = a.ciclo.localeCompare(b.ciclo);
          if (ci !== 0) return ci;
          const s = a.seccion.localeCompare(b.seccion);
          if (s !== 0) return s;
          return b.inasistencias - a.inasistencias;
        });
        setRows(out);
      } catch (e) {
        console.error(e);
        toast({ title: "Error al cargar", description: "No se pudo obtener el reporte.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sedes = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.sede));
    return Array.from(s).sort();
  }, [rows]);
  const carreras = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.carrera));
    return Array.from(s).filter(Boolean).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (sedeF !== "TODAS" && r.sede !== sedeF) return false;
      if (carreraF !== "TODAS" && r.carrera !== carreraF) return false;
      if (q) {
        const blob = `${r.alumno} ${r.curso} ${r.docente} ${r.codigoCurso} ${r.carrera}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, sedeF, carreraF]);

  // Datos para gráficos
  const chartCarrera = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.carrera, (m.get(r.carrera) || 0) + 1);
    return Array.from(m.entries())
      .map(([carrera, jalados]) => ({ carrera, jalados }))
      .sort((a, b) => b.jalados - a.jalados);
  }, [filtered]);

  const chartCurso = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      const k = r.curso || r.codigoCurso || "—";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([curso, jalados]) => ({ curso: curso.length > 22 ? curso.slice(0, 22) + "…" : curso, jalados }))
      .sort((a, b) => b.jalados - a.jalados)
      .slice(0, 8);
  }, [filtered]);

  // Agrupar por carrera para visualización
  const grouped = useMemo(() => {
    const m = new Map<string, JaladoRow[]>();
    for (const r of filtered) {
      const k = `${r.carrera} · ${r.ciclo}${r.seccion}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filtered]);

  const exportXLSX = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Jalados por Inasistencia");
    ws.columns = [
      { width: 6 }, { width: 36 }, { width: 28 }, { width: 12 }, { width: 8 }, { width: 8 },
      { width: 12 }, { width: 13 }, { width: 12 }, { width: 32 }, { width: 12 },
    ];
    const head = ws.getRow(1);
    ["N°","Alumno","Curso","Código","Ciclo","Sec","Asistencias","Inasistencias","% Asist.","Docente","Sede"]
      .forEach((h, i) => { head.getCell(i + 1).value = h; });
    head.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
    head.height = 22;

    filtered.forEach((r, i) => {
      const row = ws.getRow(i + 2);
      row.getCell(1).value = i + 1;
      row.getCell(2).value = r.alumno;
      row.getCell(3).value = r.curso;
      row.getCell(4).value = r.codigoCurso;
      row.getCell(5).value = r.ciclo;
      row.getCell(6).value = r.seccion;
      row.getCell(7).value = r.asistencias;
      row.getCell(8).value = r.inasistencias;
      row.getCell(9).value = r.porcentaje;
      row.getCell(10).value = r.docente;
      row.getCell(11).value = r.sede;
      row.eachCell((c, col) => {
        c.alignment = { horizontal: col === 2 || col === 3 || col === 10 ? "left" : "center", vertical: "middle", wrapText: true };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        c.font = { size: 10, color: { argb: col === 8 ? "FFB91C1C" : "FF000000" }, bold: col === 8 };
      });
      row.height = 18;
    });

    const buf = await wb.xlsx.writeBuffer() as ArrayBuffer;
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Jalados_Inasistencia_2026-1.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-red-50/20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            Reporte de Estudiantes Jalados por Inasistencia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lista consolidada de alumnos con <b className="text-red-600">{UMBRAL} o más inasistencias</b> en las planillas subidas (2026-1).
          </p>
        </div>
        <Button onClick={exportXLSX} disabled={filtered.length === 0} className="gap-2 bg-red-600 hover:bg-red-700 text-white shrink-0">
          <Download className="h-4 w-4" /> Excel
        </Button>
      </div>

      {/* Gráficos */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-border/50 shadow-sm p-4">
            <h3 className="text-sm font-bold text-[#001f5f] mb-1">Jalados por carrera</h3>
            <p className="text-[11px] text-muted-foreground mb-2">Distribución de estudiantes desaprobados por inasistencia</p>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={chartCarrera} dataKey="jalados" nameKey="carrera" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={3}
                  label={({ carrera, jalados, percent }) => `${carrera}: ${jalados} (${(percent! * 100).toFixed(0)}%)`} labelLine={false}
                >
                  {chartCarrera.map((_, i) => (
                    <Cell key={i} fill={["#b91c1c","#dc2626","#ef4444","#f87171","#fca5a5","#7f1d1d","#991b1b","#fee2e2"][i % 8]} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <RTooltip formatter={(v: number) => [`${v} estudiantes`, "Jalados"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2 bg-white rounded-xl border border-border/50 shadow-sm p-4">
            <h3 className="text-sm font-bold text-[#001f5f] mb-1">Top cursos con más jalados</h3>
            <p className="text-[11px] text-muted-foreground mb-2">Cursos con mayor número de estudiantes desaprobados</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartCurso} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#475569" }} allowDecimals={false} />
                <YAxis type="category" dataKey="curso" tick={{ fontSize: 10, fill: "#475569" }} width={150} />
                <RTooltip />
                <Bar dataKey="jalados" fill="#b91c1c" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="jalados" position="right" style={{ fill: "#b91c1c", fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-border/50 shadow-sm p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar alumno, curso, docente…" className="pl-8 h-9" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Sede:</span>
          {(["TODAS", ...sedes]).map((s) => (
            <button key={s} onClick={() => setSedeF(s)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${sedeF === s ? "bg-red-600 text-white border-red-600" : "bg-white text-muted-foreground border-border hover:bg-muted/40"}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Carrera:</span>
          <select value={carreraF} onChange={(e) => setCarreraF(e.target.value)} className="h-8 text-xs border border-border rounded px-2 bg-white">
            <option value="TODAS">Todas</option>
            {carreras.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="text-xs gap-1">
            <GraduationCap className="h-3.5 w-3.5" />
            {filtered.length} jalados
          </Badge>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Calculando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-border/50 shadow-sm p-12 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Sin estudiantes jalados por inasistencia</p>
          <p className="text-xs mt-1">Sube planillas en "Asistencia 2026-1" o cambia los filtros.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([titulo, list]) => (
            <div key={titulo} className="bg-white rounded-lg border border-border/50 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-border/50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">{titulo}</h3>
                <Badge variant="destructive" className="text-[10px]">{list.length} jalado{list.length !== 1 ? "s" : ""}</Badge>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-center w-10">#</th>
                    <th className="px-3 py-2 text-left">Alumno</th>
                    <th className="px-3 py-2 text-left">Curso</th>
                    <th className="px-3 py-2 text-left">Docente</th>
                    <th className="px-3 py-2 text-center">Asist.</th>
                    <th className="px-3 py-2 text-center">Inasist.</th>
                    <th className="px-3 py-2 text-center">% Asist.</th>
                    <th className="px-3 py-2 text-center">Sede</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r, i) => (
                    <tr key={`${r.codigoCurso}-${r.alumno}-${i}`} className="border-t border-border/30 hover:bg-red-50/30">
                      <td className="px-3 py-2 text-center text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{r.alumno}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium line-clamp-1">{r.curso}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{r.codigoCurso}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.docente}</td>
                      <td className="px-3 py-2 text-center text-emerald-700 font-semibold">{r.asistencias}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">
                          {r.inasistencias}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono">{r.porcentaje.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="outline" className="text-[10px]">{r.sede}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
