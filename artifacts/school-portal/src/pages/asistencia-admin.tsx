import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download, Printer, BarChart3, Users, Search, X, RefreshCw, Trash2, Filter } from "lucide-react";
import * as XLSX from "xlsx";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const COLORS = ["#001F5F","#C9A84C","#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899"];

function getQrUrl() {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${window.location.origin}${base}/registro-asistencia`;
}

interface Registro {
  id: number;
  apellidos: string;
  nombres: string;
  docente: string;
  curso: string;
  carrera: string;
  ciclo: string;
  seccion: string;
  dia: string;
  fecha: string;
  createdAt: string;
}

interface Reporte {
  totalRegistros: number;
  porCarrera: { name: string; value: number }[];
  porCurso: { name: string; value: number }[];
  porDocente: { name: string; value: number }[];
  porDia: { name: string; value: number }[];
}

export default function AsistenciaAdmin() {
  const [tab, setTab] = useState<"registros" | "graficos" | "qr">("registros");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCarrera, setFilterCarrera] = useState("");
  const [filterCurso, setFilterCurso] = useState("");
  const [filterDocente, setFilterDocente] = useState("");
  const [filterFecha, setFilterFecha] = useState("");
  const [filterDia, setFilterDia] = useState("");

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`${apiBase}/api/asistencia/registros`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${apiBase}/api/asistencia/reporte`, { credentials: "include" }).then((r) => r.json()),
    ]).then(([regs, rep]) => {
      setRegistros(Array.isArray(regs) ? regs : []);
      setReporte(rep);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  // Unique dropdown options from data
  const uniqueValues = (key: keyof Registro) =>
    [...new Set(registros.map((r) => r[key] as string))].filter(Boolean).sort();

  // Apply all filters
  const filtered = registros.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || [r.apellidos, r.nombres, r.docente, r.curso, r.carrera, r.seccion, r.dia].some((v) => v.toLowerCase().includes(q));
    const matchCarrera = !filterCarrera || r.carrera === filterCarrera;
    const matchCurso = !filterCurso || r.curso === filterCurso;
    const matchDocente = !filterDocente || r.docente === filterDocente;
    const matchFecha = !filterFecha || r.fecha === filterFecha;
    const matchDia = !filterDia || r.dia === filterDia;
    return matchSearch && matchCarrera && matchCurso && matchDocente && matchFecha && matchDia;
  });

  const hasFilters = !!(search || filterCarrera || filterCurso || filterDocente || filterFecha || filterDia);
  const clearFilters = () => {
    setSearch(""); setFilterCarrera(""); setFilterCurso("");
    setFilterDocente(""); setFilterFecha(""); setFilterDia("");
  };

  // Count registrations per student
  const studentCount: Record<string, number> = {};
  for (const r of registros) {
    const key = `${r.apellidos}|${r.nombres}`;
    studentCount[key] = (studentCount[key] || 0) + 1;
  }
  const uniqueStudents = Object.keys(studentCount).length;

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este registro de asistencia?")) return;
    setDeletingId(id);
    try {
      await fetch(`${apiBase}/api/asistencia/registros/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchData();
    } finally {
      setDeletingId(null);
    }
  };

  const handleExcel = () => {
    const exportDate = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
    const exportTime = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

    // Header rows
    const header: any[][] = [
      ["UNIVERSIDAD AUTÓNOMA DE ICA"],
      ["Sistema de Control de Asistencia Académica"],
      [`Semestre: 2026-I`],
      [`Fecha de exportación: ${exportDate} ${exportTime}`],
      [`Total de registros: ${filtered.length}   |   Estudiantes únicos: ${uniqueStudents}`],
      [], // fila vacía
      ["#", "Apellidos", "Nombres", "Docente", "Curso", "Carrera", "Ciclo", "Sección", "Día", "Fecha", "Hora registro"],
    ];

    const dataRows = filtered.map((r, i) => [
      i + 1,
      r.apellidos,
      r.nombres,
      r.docente,
      r.curso,
      r.carrera,
      r.ciclo,
      r.seccion,
      r.dia,
      r.fecha,
      new Date(r.createdAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...header, ...dataRows]);

    // Merge cells for title row
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // row 1: universidad
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }, // row 2: sistema
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } }, // row 3: semestre
      { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } }, // row 4: fecha
      { s: { r: 4, c: 0 }, e: { r: 4, c: 10 } }, // row 5: totales
    ];

    // Column widths
    ws["!cols"] = [
      { wch: 5 }, { wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 35 },
      { wch: 28 }, { wch: 7 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencias");
    XLSX.writeFile(wb, `reporte-asistencia-uai-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const size = 320;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement("a");
      a.download = "qr-asistencia-uai.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrintQR = () => {
    const url = getQrUrl();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>QR Asistencia UAI</title>
      <style>
        body{font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .card{border:2px solid #001F5F;border-radius:12px;padding:28px 24px;max-width:320px;width:100%;text-align:center}
        h1{color:#001F5F;font-size:17px;margin:0 0 2px}
        .sub{color:#555;font-size:12px;margin:0 0 16px}
        .instr{background:#f0f4ff;border-radius:8px;padding:10px;text-align:left;font-size:12px;color:#333;margin-bottom:10px}
        .url{font-size:9px;color:#aaa;word-break:break-all;margin-top:6px}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body>
      <div class="card">
        <h1>📋 Registro de Asistencia</h1>
        <p class="sub">Universidad Autónoma de Ica</p>
        <div id="qr" style="margin:16px auto"></div>
        <div class="instr"><b>¿Cómo registrarse?</b><br/>1. Escanea el QR con tu celular<br/>2. Completa el formulario con tus datos y los del docente<br/>3. Presiona "Registrar mi asistencia"</div>
        <p class="url">${url}</p>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
      <script>QRCode.toCanvas(document.createElement('canvas'),"${url}",{width:220},function(err,c){c.style.display='block';document.getElementById('qr').appendChild(c);setTimeout(()=>window.print(),600)});</script>
      </body></html>`);
    win.document.close();
  };

  const selectCls = "border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/30 bg-white";

  return (
    <div className="min-h-screen bg-[#f0f4ff]">
      {/* ── Top header bar ── */}
      <div className="bg-[#001F5F] px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#C9A84C]" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">Reporte de Asistencia</h1>
            <p className="text-white/50 text-xs">Universidad Autónoma de Ica — 2026-I</p>
          </div>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#001F5F]/15 rounded-xl p-1 w-fit shadow-sm">
        {[
          { key: "registros", label: "Registros", Icon: Users },
          { key: "graficos", label: "Gráficos", Icon: BarChart3 },
          { key: "qr", label: "QR", Icon: Download },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? "bg-[#001F5F] text-white shadow-sm" : "text-gray-500 hover:text-[#001F5F]"}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── REGISTROS TAB ── */}
      {tab === "registros" && (
        <div className="space-y-3">

          {/* Search + Export bar */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, docente, curso..."
                className="pl-9 pr-4 py-2.5 border border-[#001F5F]/20 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/30 w-full shadow-sm" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button onClick={handleExcel}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-sm whitespace-nowrap">
              <Download className="w-4 h-4" /> Exportar Excel
            </button>
          </div>

          {/* Filter panel */}
          <div className="bg-white border border-[#001F5F]/15 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-[#001F5F] px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-[#C9A84C]" />
                <span className="text-white text-xs font-bold uppercase tracking-wider">Filtros de búsqueda</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/60 text-xs font-medium">
                  {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                </span>
                {hasFilters && (
                  <button onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-red-300 hover:text-red-200 font-medium">
                    <X className="w-3 h-3" /> Limpiar
                  </button>
                )}
              </div>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              <select value={filterCarrera} onChange={(e) => setFilterCarrera(e.target.value)} className={selectCls}>
                <option value="">Todas las carreras</option>
                {uniqueValues("carrera").map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filterCurso} onChange={(e) => setFilterCurso(e.target.value)} className={selectCls}>
                <option value="">Todos los cursos</option>
                {uniqueValues("curso").map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filterDocente} onChange={(e) => setFilterDocente(e.target.value)} className={selectCls}>
                <option value="">Todos los docentes</option>
                {uniqueValues("docente").map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filterDia} onChange={(e) => setFilterDia(e.target.value)} className={selectCls}>
                <option value="">Todos los días</option>
                {uniqueValues("dia").map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <input type="date" value={filterFecha} onChange={(e) => setFilterFecha(e.target.value)}
                className={selectCls} />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#001F5F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-[#001F5F]/10 rounded-2xl text-center py-16 text-gray-400 shadow-sm">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{hasFilters ? "Sin resultados para los filtros aplicados." : "Aún no hay registros de asistencia."}</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden shadow-md border border-[#001F5F]/20">
              {/* Table title bar */}
              <div className="bg-[#001F5F] px-4 py-2.5 flex items-center justify-between">
                <span className="text-white text-xs font-bold uppercase tracking-wider">
                  Lista de Asistencias
                </span>
                <span className="text-[#C9A84C] text-xs font-semibold">
                  {filtered.length} registro{filtered.length !== 1 ? "s" : ""} · {uniqueStudents} estudiante{uniqueStudents !== 1 ? "s" : ""} único{uniqueStudents !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#001F5F]/90">
                      {[
                        { label: "#", cls: "w-8 text-center" },
                        { label: "Apellidos", cls: "" },
                        { label: "Nombres", cls: "" },
                        { label: "Asist.", cls: "text-center" },
                        { label: "Docente", cls: "" },
                        { label: "Curso", cls: "" },
                        { label: "Carrera", cls: "" },
                        { label: "Ciclo", cls: "text-center" },
                        { label: "Sec.", cls: "text-center" },
                        { label: "Día", cls: "text-center" },
                        { label: "Fecha", cls: "" },
                        { label: "Hora", cls: "" },
                        { label: "", cls: "w-10" },
                      ].map((h, i) => (
                        <th key={i}
                          className={`px-3 py-2.5 text-left text-[10px] font-bold text-white/80 uppercase tracking-widest whitespace-nowrap border-r border-white/10 last:border-0 ${h.cls}`}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                    {/* Gold accent line */}
                    <tr>
                      <td colSpan={13} className="p-0">
                        <div className="h-[3px] bg-[#C9A84C] w-full" />
                      </td>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const count = studentCount[`${r.apellidos}|${r.nombres}`] || 1;
                      const isEven = i % 2 === 0;
                      const rowBg = isEven ? "bg-white" : "bg-[#f0f4ff]";
                      const cellBorder = "border-r border-[#001F5F]/8 last:border-0";
                      return (
                        <tr key={r.id}
                          className={`${rowBg} hover:bg-[#001F5F]/5 transition-colors border-b border-[#001F5F]/8`}>
                          <td className={`px-3 py-2.5 text-center text-xs font-bold text-[#001F5F]/40 ${cellBorder}`}>{i + 1}</td>
                          <td className={`px-3 py-2.5 font-bold text-[#001F5F] whitespace-nowrap ${cellBorder}`}>{r.apellidos}</td>
                          <td className={`px-3 py-2.5 text-gray-700 whitespace-nowrap ${cellBorder}`}>{r.nombres}</td>
                          <td className={`px-3 py-2.5 text-center ${cellBorder}`}>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${count > 1 ? "bg-red-100 text-red-700 border border-red-200" : "bg-emerald-100 text-emerald-700 border border-emerald-200"}`}>
                              {count}×
                            </span>
                          </td>
                          <td className={`px-3 py-2.5 text-gray-700 whitespace-nowrap text-xs ${cellBorder}`}>{r.docente}</td>
                          <td className={`px-3 py-2.5 text-gray-700 whitespace-nowrap text-xs ${cellBorder}`}>{r.curso}</td>
                          <td className={`px-3 py-2.5 whitespace-nowrap ${cellBorder}`}>
                            <span className="text-[11px] bg-[#001F5F] text-white px-2 py-0.5 rounded font-semibold">{r.carrera}</span>
                          </td>
                          <td className={`px-3 py-2.5 text-center font-bold text-[#001F5F] ${cellBorder}`}>{r.ciclo}</td>
                          <td className={`px-3 py-2.5 text-center font-semibold text-gray-600 ${cellBorder}`}>{r.seccion}</td>
                          <td className={`px-3 py-2.5 text-center ${cellBorder}`}>
                            <span className="text-[11px] bg-[#C9A84C]/20 text-[#7a5c00] px-2 py-0.5 rounded font-bold border border-[#C9A84C]/30">{r.dia}</span>
                          </td>
                          <td className={`px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap ${cellBorder}`}>{r.fecha}</td>
                          <td className={`px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap ${cellBorder}`}>
                            {new Date(r.createdAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <button
                              onClick={() => handleDelete(r.id)}
                              disabled={deletingId === r.id}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                              title="Eliminar registro">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Footer */}
              <div className="bg-[#001F5F]/5 border-t border-[#001F5F]/10 px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">Mostrando {filtered.length} de {registros.length} registros totales</span>
                <span className="text-xs text-[#001F5F] font-semibold">{uniqueStudents} estudiantes únicos</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GRÁFICOS TAB ── */}
      {tab === "graficos" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Registros", value: reporte?.totalRegistros ?? 0, color: "text-[#001F5F]" },
              { label: "Estudiantes Únicos", value: uniqueStudents, color: "text-emerald-700" },
              { label: "Carreras", value: reporte?.porCarrera.length ?? 0, color: "text-[#8a6e1f]" },
              { label: "Docentes", value: reporte?.porDocente.length ?? 0, color: "text-violet-700" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
                <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {reporte && reporte.totalRegistros > 0 ? (
            <>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Asistencia por Carrera</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={reporte.porCarrera} margin={{ top: 0, right: 0, left: -20, bottom: 70 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Registros" fill="#001F5F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Asistencia por Curso</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={reporte.porCurso.slice(0, 15)} margin={{ top: 0, right: 0, left: -20, bottom: 80 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Registros" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-4">Por Docente</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={reporte.porDocente} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {reporte.porDocente.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v} registros`]} />
                      <Legend formatter={(v) => <span style={{ fontSize: 10 }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-4">Por Día de la Semana</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={reporte.porDia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" name="Registros" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sin datos para mostrar gráficos aún.</p>
            </div>
          )}
        </div>
      )}

      {/* ── QR TAB ── */}
      {tab === "qr" && (
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm flex flex-col items-center gap-5 max-w-xs w-full">
            <div className="text-center">
              <h2 className="font-bold text-gray-900 text-base">QR Institucional de Asistencia</h2>
              <p className="text-xs text-gray-500 mt-1">Comparte o imprime este código para que los estudiantes registren su asistencia.</p>
            </div>
            <div ref={qrRef} className="p-3 border-2 border-[#001F5F]/20 rounded-xl">
              <QRCodeSVG value={getQrUrl()} size={220} bgColor="#ffffff" fgColor="#001F5F" level="H" />
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center w-full">
              <p className="text-xs text-gray-400 font-mono break-all">{getQrUrl()}</p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={handleDownloadQR}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 font-medium">
                <Download className="w-4 h-4" /> Descargar
              </button>
              <button onClick={handlePrintQR}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#001F5F] text-white text-sm font-medium hover:bg-[#001F5F]/90">
                <Printer className="w-4 h-4" /> Imprimir
              </button>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-xs w-full text-sm text-blue-800">
            <p className="font-semibold mb-1">Instrucciones para estudiantes:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Escanear el QR con el celular</li>
              <li>Llenar apellidos y nombres</li>
              <li>Seleccionar carrera, ciclo y sección</li>
              <li>El curso aparece automáticamente</li>
              <li>Escribir el nombre del docente</li>
              <li>Presionar "Registrar mi asistencia"</li>
            </ol>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
