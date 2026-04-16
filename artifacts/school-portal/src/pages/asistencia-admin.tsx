import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download, Printer, BarChart3, Users, Search, X, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const COLORS = ["#001F5F", "#C9A84C", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

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
  const [search, setSearch] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);

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

  const filtered = registros.filter((r) => {
    const q = search.toLowerCase();
    return !q || [r.apellidos, r.nombres, r.docente, r.curso, r.carrera, r.seccion, r.dia].some((v) => v.toLowerCase().includes(q));
  });

  // Count registrations per student (apellidos + nombres)
  const studentCount: Record<string, number> = {};
  for (const r of registros) {
    const key = `${r.apellidos}|${r.nombres}`;
    studentCount[key] = (studentCount[key] || 0) + 1;
  }

  const handleExcel = () => {
    const rows = filtered.map((r, i) => ({
      "#": i + 1,
      Apellidos: r.apellidos,
      Nombres: r.nombres,
      Docente: r.docente,
      Curso: r.curso,
      Carrera: r.carrera,
      Ciclo: r.ciclo,
      Sección: r.seccion,
      Día: r.dia,
      Fecha: r.fecha,
      "Hora de registro": new Date(r.createdAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencias");
    XLSX.writeFile(wb, `asistencias-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const size = 320;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement("a");
      a.download = `qr-asistencia-uai.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrintQR = () => {
    const url = getQrUrl();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Asistencia UAI</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; }
        .card { border: 2px solid #001F5F; border-radius: 12px; padding: 28px 24px; max-width: 320px; width: 100%; text-align: center; }
        .logo-row { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px; }
        h1 { color: #001F5F; font-size: 17px; margin: 0 0 2px 0; }
        .sub { color: #555; font-size: 12px; margin: 0 0 16px 0; }
        .qr { margin: 0 auto 16px auto; }
        .instr { background: #f0f4ff; border-radius: 8px; padding: 10px; text-align: left; font-size: 12px; color: #333; margin-bottom: 10px; }
        .url { font-size: 9px; color: #aaa; word-break: break-all; margin-top: 6px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      <div class="card">
        <h1>📋 Registro de Asistencia</h1>
        <p class="sub">Universidad Autónoma de Ica</p>
        <div class="qr" id="qr"></div>
        <div class="instr">
          <b>¿Cómo registrarse?</b><br/>
          1. Escanea el QR con tu celular<br/>
          2. Completa el formulario con tus datos y los del docente<br/>
          3. Presiona "Registrar mi asistencia"
        </div>
        <p class="url">${url}</p>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
      <script>
        QRCode.toCanvas(document.createElement('canvas'), "${url}", { width: 220 }, function(err, canvas) {
          canvas.style.display = 'block';
          document.getElementById('qr').appendChild(canvas);
          setTimeout(() => window.print(), 600);
        });
      </script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reporte de Asistencia</h1>
          <p className="text-sm text-gray-500 mt-0.5">Los estudiantes registran su asistencia escaneando el QR institucional</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: "registros", label: "Registros", Icon: Users },
          { key: "graficos", label: "Gráficos", Icon: BarChart3 },
          { key: "qr", label: "QR", Icon: Download },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? "bg-white text-[#001F5F] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* REGISTROS TAB */}
      {tab === "registros" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, docente, curso..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/30 w-72"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
              <button
                onClick={handleExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
              >
                <Download className="w-4 h-4" />
                Descargar Excel
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#001F5F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "Sin resultados para esa búsqueda." : "Aún no hay registros de asistencia."}</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["#", "Apellidos", "Nombres", "Asist.", "Docente", "Curso", "Carrera", "Ciclo", "Sec.", "Día", "Fecha", "Hora"].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{r.apellidos}</td>
                        <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.nombres}</td>
                        <td className="px-3 py-2.5 text-center">
                          {(() => {
                            const count = studentCount[`${r.apellidos}|${r.nombres}`] || 1;
                            return (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${count > 1 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                                {count} {count === 1 ? "asistencia" : "asistencias"}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.docente}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.curso}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs bg-[#001F5F]/10 text-[#001F5F] px-2 py-0.5 rounded-full font-medium">{r.carrera}</span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 text-center">{r.ciclo}</td>
                        <td className="px-3 py-2.5 text-gray-600 text-center">{r.seccion}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs bg-[#C9A84C]/15 text-[#8a6e1f] px-2 py-0.5 rounded-full font-medium">{r.dia}</span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{r.fecha}</td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GRÁFICOS TAB */}
      {tab === "graficos" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Registros", value: reporte?.totalRegistros ?? 0, color: "text-[#001F5F]" },
              { label: "Carreras", value: reporte?.porCarrera.length ?? 0, color: "text-emerald-700" },
              { label: "Cursos", value: reporte?.porCurso.length ?? 0, color: "text-[#8a6e1f]" },
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

      {/* QR TAB */}
      {tab === "qr" && (
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm flex flex-col items-center gap-5 max-w-xs w-full">
            <div>
              <h2 className="text-center font-bold text-gray-900 text-base">QR Institucional de Asistencia</h2>
              <p className="text-center text-xs text-gray-500 mt-1">Comparte o imprime este código para que los estudiantes registren su asistencia.</p>
            </div>

            <div ref={qrRef} className="p-3 border-2 border-[#001F5F]/20 rounded-xl">
              <QRCodeSVG
                value={getQrUrl()}
                size={220}
                bgColor="#ffffff"
                fgColor="#001F5F"
                level="H"
              />
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-center w-full">
              <p className="text-xs text-gray-400 font-mono break-all">{getQrUrl()}</p>
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={handleDownloadQR}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 font-medium"
              >
                <Download className="w-4 h-4" />
                Descargar
              </button>
              <button
                onClick={handlePrintQR}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#001F5F] text-white text-sm font-medium hover:bg-[#001F5F]/90"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-xs w-full text-sm text-blue-800">
            <p className="font-semibold mb-1">Instrucciones para estudiantes:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Escanear el QR con el celular</li>
              <li>Llenar apellidos y nombres</li>
              <li>Escribir el nombre del docente</li>
              <li>Indicar el curso, carrera, ciclo y sección</li>
              <li>Seleccionar el día y confirmar la fecha</li>
              <li>Presionar "Registrar mi asistencia"</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
