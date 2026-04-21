import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Search, Download, GraduationCap, BookOpen, ClipboardCheck,
  CheckCircle2, XCircle, TrendingUp, Users,
} from "lucide-react";
import * as ExcelJS from "exceljs";
import { toPng } from "html-to-image";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LabelList,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const UMBRAL = 6;

type PlanillaListItem = {
  id: number; docente: string | null; carrera: string | null; ciclo: string | null;
  seccion: string | null; codigoCurso: string | null; nombreCurso: string | null; sede: string | null;
};
type AlumnoRow = { numero: string; nombre: string; marcas: string[]; porcentaje: number };
type PlanillaDetail = PlanillaListItem & {
  weeks: Array<{ label: string; fecha?: string; dia?: string; slots?: 1 | 2 }>;
  alumnos: AlumnoRow[];
};

type AlumnoStat = {
  alumno: string;
  asistencias: number;
  inasistencias: number;
  totalSemanas: number;
  pctAsistencia: number;
  pctInasistencia: number;
  estado: "APROBADO" | "DESAPROBADO";
  curso: string; codigoCurso: string; docente: string;
  carrera: string; ciclo: string; seccion: string; sede: string;
};

const sedeNorm = (v?: string | null) => {
  const s = (v || "").toUpperCase().trim();
  if (s === "PRINCIPAL" || s === "ICA" || s === "") return "SEDE";
  return s;
};

const COLORS = {
  green: "#15803d",
  red: "#b91c1c",
  navy: "#001f5f",
  gold: "#c9a84c",
};

export default function ReporteAsistencia() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const pieRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const cursoRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<AlumnoStat[]>([]);
  const [search, setSearch] = useState("");
  const [sedeF, setSedeF] = useState<string>("TODAS");
  const [carreraF, setCarreraF] = useState<string>("TODAS");
  const [cicloF, setCicloF] = useState<string>("TODOS");
  const [estadoF, setEstadoF] = useState<"TODOS" | "APROBADO" | "DESAPROBADO">("TODOS");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const base = apiBase + "/";
        const [r, ficaPlan, fcsPlan] = await Promise.all([
          fetch(`${apiBase}/api/asistencia-planillas`, { credentials: "include" }),
          fetch(`${base}planificacion-fica-2026-1.json`).then(x => x.ok ? x.json() : []).catch(() => []),
          fetch(`${base}planificacion-fcs-2026-1.json`).then(x => x.ok ? x.json() : []).catch(() => []),
        ]);
        // Map carrera code → carreraFull
        const carreraMap = new Map<string, string>();
        for (const row of [...(Array.isArray(ficaPlan) ? ficaPlan : []), ...(Array.isArray(fcsPlan) ? fcsPlan : [])]) {
          if (row?.carrera && row?.carreraFull) {
            carreraMap.set(String(row.carrera).toUpperCase().trim(), String(row.carreraFull).trim());
          }
        }
        const resolveCarrera = (c: string | null | undefined): string => {
          const raw = String(c || "").trim();
          if (!raw) return "";
          const up = raw.toUpperCase();
          return carreraMap.get(up) || raw;
        };
        if (!r.ok) throw new Error("list");
        const list = (await r.json()) as PlanillaListItem[];
        const detalles = await Promise.all(
          list.map(async (p) => {
            try {
              const d = await fetch(`${apiBase}/api/asistencia-planillas/${p.id}`, { credentials: "include" });
              if (!d.ok) return null;
              return (await d.json()) as PlanillaDetail;
            } catch { return null; }
          })
        );
        const out: AlumnoStat[] = [];
        for (const det of detalles) {
          if (!det) continue;
          const weeksLen = det.weeks?.length || 0;
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
            const total = asis + inas;
            out.push({
              alumno: a.nombre,
              asistencias: asis,
              inasistencias: inas,
              totalSemanas: N,
              pctAsistencia: total > 0 ? Math.round((asis / total) * 1000) / 10 : 0,
              pctInasistencia: N > 0 ? Math.round((inas / N) * 1000) / 10 : 0,
              estado: inas >= UMBRAL ? "DESAPROBADO" : "APROBADO",
              curso: det.nombreCurso || "",
              codigoCurso: det.codigoCurso || "",
              docente: det.docente || "",
              carrera: resolveCarrera(det.carrera),
              ciclo: det.ciclo || "",
              seccion: det.seccion || "",
              sede: sedeNorm(det.sede),
            });
          }
        }
        out.sort((a, b) =>
          a.carrera.localeCompare(b.carrera, "es") ||
          a.ciclo.localeCompare(b.ciclo) ||
          a.seccion.localeCompare(b.seccion) ||
          a.curso.localeCompare(b.curso, "es") ||
          a.alumno.localeCompare(b.alumno, "es")
        );
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

  const sedes = useMemo(() => Array.from(new Set(rows.map(r => r.sede))).sort(), [rows]);
  const carreras = useMemo(() => Array.from(new Set(rows.map(r => r.carrera))).filter(Boolean).sort(), [rows]);
  const ciclos = useMemo(() => Array.from(new Set(rows.map(r => r.ciclo))).filter(Boolean).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter(r => {
      if (sedeF !== "TODAS" && r.sede !== sedeF) return false;
      if (carreraF !== "TODAS" && r.carrera !== carreraF) return false;
      if (cicloF !== "TODOS" && r.ciclo !== cicloF) return false;
      if (estadoF !== "TODOS" && r.estado !== estadoF) return false;
      if (q) {
        const blob = `${r.alumno} ${r.curso} ${r.docente} ${r.codigoCurso} ${r.carrera}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, sedeF, carreraF, cicloF, estadoF]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const aprob = filtered.filter(r => r.estado === "APROBADO").length;
    const desap = total - aprob;
    const sumPctAsis = filtered.reduce((s, r) => s + r.pctAsistencia, 0);
    const sumPctIna  = filtered.reduce((s, r) => s + r.pctInasistencia, 0);
    return {
      total, aprob, desap,
      pctAprob: total > 0 ? (aprob / total) * 100 : 0,
      pctDesap: total > 0 ? (desap / total) * 100 : 0,
      promPctAsis: total > 0 ? sumPctAsis / total : 0,
      promPctIna: total > 0 ? sumPctIna / total : 0,
    };
  }, [filtered]);

  // Datos para el gráfico de barras: asistencias e inasistencias por carrera
  const barCarrera = useMemo(() => {
    const m = new Map<string, { asis: number; inas: number }>();
    for (const r of filtered) {
      if (!m.has(r.carrera)) m.set(r.carrera, { asis: 0, inas: 0 });
      const v = m.get(r.carrera)!;
      v.asis += r.asistencias;
      v.inas += r.inasistencias;
    }
    return Array.from(m.entries())
      .map(([carrera, v]) => ({ carrera, Asistencias: v.asis, Inasistencias: v.inas }))
      .sort((a, b) => a.carrera.localeCompare(b.carrera, "es"));
  }, [filtered]);

  // Totales globales para gráfico de torta de asistencia
  const totalesAsistencia = useMemo(() => {
    let asis = 0, inas = 0;
    for (const r of filtered) { asis += r.asistencias; inas += r.inasistencias; }
    return { asis, inas, total: asis + inas };
  }, [filtered]);

  // Top 10 cursos con menor % asistencia
  const chartCursos = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    for (const r of filtered) {
      const k = r.curso || r.codigoCurso || "—";
      if (!m.has(k)) m.set(k, { sum: 0, n: 0 });
      const v = m.get(k)!;
      v.sum += r.pctAsistencia; v.n++;
    }
    return Array.from(m.entries())
      .map(([curso, v]) => ({
        curso: curso.length > 28 ? curso.slice(0, 28) + "…" : curso,
        pct: v.n > 0 ? +(v.sum / v.n).toFixed(1) : 0,
      }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 10);
  }, [filtered]);

  // Agrupar por carrera+ciclo+seccion para visualización
  const grouped = useMemo(() => {
    const m = new Map<string, AlumnoStat[]>();
    for (const r of filtered) {
      const k = `${r.carrera} · Ciclo ${r.ciclo} · Sección ${r.seccion}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filtered]);

  const captureChart = async (el: HTMLElement | null): Promise<string | null> => {
    if (!el) return null;
    // Esperar 2 frames para asegurar que Recharts terminó de pintar
    await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    const rect = el.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    try {
      return await toPng(el, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width,
        height,
        cacheBust: true,
        skipFonts: true,
        style: { transform: "none" },
      });
    } catch (e) {
      console.warn("toPng failed, intentando con SVG directo:", e);
    }
    // Fallback: serializar el primer SVG dentro del contenedor manualmente
    try {
      const svg = el.querySelector("svg");
      if (!svg) return null;
      const clone = svg.cloneNode(true) as SVGElement;
      const w = svg.clientWidth || width;
      const h = svg.clientHeight || height;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(w));
      clone.setAttribute("height", String(h));
      const xml = new XMLSerializer().serializeToString(clone);
      const svgBase64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
      const img = new Image();
      img.crossOrigin = "anonymous";
      const dataUrl = await new Promise<string | null>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = w * 2;
          canvas.height = h * 2;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve(null);
        img.src = svgBase64;
      });
      return dataUrl;
    } catch (e) {
      console.warn("captureChart fallback failed", e);
      return null;
    }
  };

  const exportXLSX = async () => {
    setExporting(true);
    try {
    const wb = new ExcelJS.Workbook();

    // Hoja 1 — Gráficos
    const ws0 = wb.addWorksheet("Gráficos");
    ws0.columns = Array.from({ length: 14 }, () => ({ width: 12 }));
    let titleRow = ws0.getRow(1);
    titleRow.getCell(1).value = "REPORTE DE ASISTENCIA · 2026-1";
    titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: "FF001F5F" } };
    ws0.mergeCells(1, 1, 1, 14);
    titleRow.alignment = { horizontal: "center" };
    titleRow.height = 26;

    // Resumen numérico
    const summary = [
      ["Estudiantes evaluados", stats.total],
      ["Aprobados", `${stats.aprob} (${stats.pctAprob.toFixed(1)}%)`],
      ["Desaprobados", `${stats.desap} (${stats.pctDesap.toFixed(1)}%)`],
      ["Total marcas asistencia", totalesAsistencia.asis],
      ["Total marcas inasistencia", totalesAsistencia.inas],
      ["% Asistencia promedio", `${stats.promPctAsis.toFixed(1)}%`],
      ["% Inasistencia promedio", `${stats.promPctIna.toFixed(1)}%`],
    ];
    summary.forEach((row, i) => {
      const r = ws0.getRow(3 + i);
      r.getCell(1).value = row[0];
      r.getCell(1).font = { bold: true };
      r.getCell(2).value = row[1] as string | number;
      ws0.mergeCells(3 + i, 1, 3 + i, 3);
      ws0.mergeCells(3 + i, 4, 3 + i, 6);
    });

    // Capturar gráficas
    const [pieImg, barImg, cursoImg] = await Promise.all([
      captureChart(pieRef.current),
      captureChart(barRef.current),
      captureChart(cursoRef.current),
    ]);

    let imgRow = 12;
    const placeImg = (dataUrl: string | null, label: string, width: number, height: number) => {
      const lbl = ws0.getRow(imgRow);
      lbl.getCell(1).value = label;
      lbl.getCell(1).font = { bold: true, size: 12, color: { argb: "FF001F5F" } };
      ws0.mergeCells(imgRow, 1, imgRow, 14);
      imgRow++;
      if (!dataUrl) {
        ws0.getRow(imgRow).getCell(1).value = "(no se pudo capturar el gráfico)";
        imgRow += 2;
        return;
      }
      const id = wb.addImage({ base64: dataUrl, extension: "png" });
      ws0.addImage(id, {
        tl: { col: 0, row: imgRow - 1 },
        ext: { width, height },
      });
      imgRow += Math.ceil(height / 20) + 2;
    };

    placeImg(pieImg, "Asistencia vs Inasistencia (global)", 480, 320);
    placeImg(barImg, "Asistencia / Inasistencia por carrera", 760, 320);
    placeImg(cursoImg, "% Asistencia promedio por curso (Top 10)", 760, 360);

    // Hoja 2 — Detalle
    const ws = wb.addWorksheet("Detalle");
    ws.columns = [
      { width: 6 }, { width: 36 }, { width: 28 }, { width: 12 }, { width: 8 }, { width: 8 },
      { width: 11 }, { width: 12 }, { width: 11 }, { width: 12 }, { width: 22 }, { width: 32 }, { width: 12 },
    ];
    const head = ws.getRow(1);
    ["N°","Alumno","Curso","Código","Ciclo","Sec","Asistencias","Inasistencias","% Asist.","% Inas.","Estado","Docente","Sede"]
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
      row.getCell(9).value = r.pctAsistencia;
      row.getCell(10).value = r.pctInasistencia;
      row.getCell(11).value = r.estado;
      row.getCell(12).value = r.docente;
      row.getCell(13).value = r.sede;
      row.eachCell((c, col) => {
        c.alignment = { horizontal: col === 2 || col === 3 || col === 12 ? "left" : "center", vertical: "middle", wrapText: true };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        c.font = { size: 10 };
      });
      if (r.estado === "DESAPROBADO") {
        row.getCell(11).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB91C1C" } };
        row.getCell(11).font = { size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      } else {
        row.getCell(11).font = { size: 10, bold: true, color: { argb: "FF15803D" } };
      }
      row.height = 18;
    });
    const buf = await wb.xlsx.writeBuffer() as ArrayBuffer;
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Reporte_Asistencia_2026-1.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error(e);
      toast({ title: "Error al exportar", description: "No se pudo generar el archivo Excel.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Calculando reporte de asistencia…
        </div>
      </div>
    );
  }

  const pieData = [
    { name: "Asistencia", value: totalesAsistencia.asis, color: COLORS.green },
    { name: "Inasistencia", value: totalesAsistencia.inas, color: COLORS.red },
  ];

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#001f5f]">
            <ClipboardCheck className="h-6 w-6 text-emerald-600" />
            Reporte de Asistencia por Carrera, Curso, Ciclo y Sección
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consolidado de asistencia 2026-1. Umbral de desaprobación:
            <b className="text-red-600 ml-1">≥ {UMBRAL} inasistencias</b>.
          </p>
        </div>
        <Button onClick={exportXLSX} disabled={filtered.length === 0 || exporting} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? "Generando…" : "Excel con gráficos"}
        </Button>
      </div>

      {/* Cards de KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Estudiantes" value={stats.total.toString()} icon={<Users className="h-5 w-5" />} accent="navy" />
        <KpiCard title="Asistencias" value={totalesAsistencia.asis.toString()} suffix={totalesAsistencia.total > 0 ? `(${((totalesAsistencia.asis / totalesAsistencia.total) * 100).toFixed(1)}%)` : ""} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        <KpiCard title="Inasistencias" value={totalesAsistencia.inas.toString()} suffix={totalesAsistencia.total > 0 ? `(${((totalesAsistencia.inas / totalesAsistencia.total) * 100).toFixed(1)}%)` : ""} icon={<XCircle className="h-5 w-5" />} accent="red" />
        <KpiCard title="% Asist. promedio" value={`${stats.promPctAsis.toFixed(1)}%`} suffix={`Inas: ${stats.promPctIna.toFixed(1)}%`} icon={<TrendingUp className="h-5 w-5" />} accent="gold" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div ref={pieRef}>
          <ChartCard title="Asistencia vs Inasistencia" subtitle="Distribución global de marcas registradas">
            {totalesAsistencia.total === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent! * 100).toFixed(1)}%)`}
                    isAnimationActive={false}
                  >
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="#fff" strokeWidth={2} />)}
                  </Pie>
                  <RTooltip formatter={(v: number, n: string) => [`${v} marcas`, n]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <div className="lg:col-span-2" ref={barRef}>
          <ChartCard title="Asistencia / Inasistencia por carrera" subtitle="Total de marcas por carrera">
            {barCarrera.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barCarrera} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="carrera" tick={{ fontSize: 11, fill: "#475569" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#475569" }} allowDecimals={false} />
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Asistencias" stackId="a" fill={COLORS.green} radius={[0, 0, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="Asistencias" position="center" style={{ fill: "#fff", fontSize: 11, fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey="Inasistencias" stackId="a" fill={COLORS.red} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="Inasistencias" position="center" style={{ fill: "#fff", fontSize: 11, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>

      {/* Gráfico extra: % asistencia promedio por curso */}
      <div ref={cursoRef}>
        <ChartCard title="% Asistencia promedio por curso (Top 10)" subtitle="Cursos con menor desempeño en asistencia">
          {chartCursos.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={Math.max(220, chartCursos.length * 32)}>
              <BarChart data={chartCursos} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis type="category" dataKey="curso" tick={{ fontSize: 10, fill: "#475569" }} width={200} />
                <RTooltip formatter={(v: number) => [`${v}%`, "% Asistencia"]} />
                <Bar dataKey="pct" fill={COLORS.green} radius={[0, 6, 6, 0]} isAnimationActive={false}>
                  <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} style={{ fill: COLORS.navy, fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-border/50 shadow-sm p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar alumno, curso, docente…" className="pl-8 h-9" />
        </div>
        <FilterPills label="Sede" value={sedeF} onChange={setSedeF} options={["TODAS", ...sedes]} accentSelected="bg-emerald-600 border-emerald-600" />
        <FilterPills label="Estado" value={estadoF} onChange={(v) => setEstadoF(v as "TODOS" | "APROBADO" | "DESAPROBADO")} options={["TODOS", "APROBADO", "DESAPROBADO"]} accentSelected="bg-[#001f5f] border-[#001f5f]" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Carrera:</span>
          <select value={carreraF} onChange={(e) => setCarreraF(e.target.value)} className="h-8 text-xs border border-border rounded px-2 bg-white">
            <option value="TODAS">Todas</option>
            {carreras.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Ciclo:</span>
          <select value={cicloF} onChange={(e) => setCicloF(e.target.value)} className="h-8 text-xs border border-border rounded px-2 bg-white">
            <option value="TODOS">Todos</option>
            {ciclos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="text-xs gap-1">
            <GraduationCap className="h-3.5 w-3.5" /> {filtered.length} estudiantes
          </Badge>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-border/50 shadow-sm p-12 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Sin estudiantes que coincidan con los filtros</p>
          <p className="text-xs mt-1">Sube planillas en "Asistencia 2026-1" o cambia los filtros.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([titulo, list]) => {
            const aprob = list.filter(r => r.estado === "APROBADO").length;
            const desap = list.length - aprob;
            const pctA = list.length > 0 ? (aprob / list.length) * 100 : 0;
            const promAsis = list.length > 0 ? list.reduce((s, r) => s + r.pctAsistencia, 0) / list.length : 0;
            return (
              <div key={titulo} className="bg-white rounded-lg border border-border/50 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-[#001f5f] to-[#002b8a] text-white flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold">{titulo}</h3>
                  <div className="flex items-center gap-2 text-[11px]">
                    <Badge className="bg-white/20 text-white border-0">{list.length} estudiantes</Badge>
                    <Badge className="bg-emerald-500 text-white border-0">{aprob} aprob. ({pctA.toFixed(0)}%)</Badge>
                    <Badge className="bg-red-500 text-white border-0">{desap} desaprob.</Badge>
                    <Badge className="bg-[#c9a84c] text-white border-0">% Asist. {promAsis.toFixed(1)}%</Badge>
                  </div>
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
                      <th className="px-3 py-2 text-center w-44">% Asistencia</th>
                      <th className="px-3 py-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r, i) => (
                      <tr key={`${r.codigoCurso}-${r.alumno}-${i}`} className={`border-t border-border/30 ${r.estado === "DESAPROBADO" ? "bg-red-50/30 hover:bg-red-50/60" : "hover:bg-emerald-50/40"}`}>
                        <td className="px-3 py-2 text-center text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{r.alumno}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium line-clamp-1">{r.curso}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{r.codigoCurso}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.docente}</td>
                        <td className="px-3 py-2 text-center text-emerald-700 font-semibold">{r.asistencias}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded font-bold ${r.inasistencias >= UMBRAL ? "bg-red-100 text-red-700" : r.inasistencias > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                            {r.inasistencias}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <PctBar value={r.pctAsistencia} good={r.estado === "APROBADO"} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.estado === "APROBADO" ? (
                            <Badge className="bg-emerald-600 text-white border-0 text-[10px]">APROBADO</Badge>
                          ) : (
                            <Badge className="bg-red-600 text-white border-0 text-[10px]">DESAPROBADO</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Helpers visuales ---------- */

function KpiCard({ title, value, suffix, icon, accent }: {
  title: string; value: string; suffix?: string; icon: React.ReactNode;
  accent: "green" | "red" | "navy" | "gold";
}) {
  const palette: Record<string, { bg: string; text: string; ring: string }> = {
    green: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
    red:   { bg: "bg-red-50",     text: "text-red-700",     ring: "ring-red-200" },
    navy:  { bg: "bg-slate-50",   text: "text-[#001f5f]",   ring: "ring-slate-200" },
    gold:  { bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200" },
  };
  const p = palette[accent];
  return (
    <div className={`rounded-xl border border-border/50 ${p.bg} p-4 shadow-sm ring-1 ${p.ring}`}>
      <div className="flex items-center justify-between mb-1">
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${p.text}`}>{title}</p>
        <span className={p.text}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${p.text}`}>{value}</p>
      {suffix && <p className="text-[11px] text-muted-foreground mt-0.5">{suffix}</p>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border/50 shadow-sm p-4">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-[#001f5f]">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">
      Sin datos para mostrar
    </div>
  );
}

function PctBar({ value, good }: { value: number; good: boolean }) {
  const color = good ? "bg-emerald-500" : "bg-red-500";
  const text = good ? "text-emerald-700" : "text-red-700";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className={`font-mono text-[11px] font-bold tabular-nums w-12 text-right ${text}`}>{value.toFixed(1)}%</span>
    </div>
  );
}

function FilterPills({ label, value, onChange, options, accentSelected }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; accentSelected: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${value === o ? `${accentSelected} text-white` : "bg-white text-muted-foreground border-border hover:bg-muted/40"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}
