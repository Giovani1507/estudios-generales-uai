import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Plus, Trash2, Download, Printer, ChevronDown, ChevronUp, BarChart3, Users, BookOpen, X } from "lucide-react";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const COLORS = ["#001F5F", "#C9A84C", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

interface Sesion {
  id: number;
  docente: string;
  curso: string;
  carrera: string;
  ciclo: string;
  seccion: string;
  dia: string;
  fecha: string;
}

interface Registro {
  id: number;
  sesionId: number;
  apellidos: string;
  nombres: string;
  createdAt: string;
}

interface Reporte {
  totalSesiones: number;
  totalRegistros: number;
  porCarrera: { name: string; value: number }[];
  porCurso: { name: string; value: number }[];
  porDocente: { name: string; value: number }[];
}

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const emptyForm = {
  docente: "",
  curso: "",
  carrera: "",
  ciclo: "",
  seccion: "",
  dia: "",
  fecha: new Date().toISOString().slice(0, 10),
};

function getRegistroUrl(id: number) {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${window.location.origin}${base}/registro-asistencia?id=${id}`;
}

export default function AsistenciaAdmin() {
  const [tab, setTab] = useState<"sesiones" | "reportes">("sesiones");
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedSesion, setSelectedSesion] = useState<Sesion | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loadingRegistros, setLoadingRegistros] = useState(false);
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [qrModal, setQrModal] = useState<Sesion | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const fetchSesiones = () => {
    setLoading(true);
    fetch(`${apiBase}/api/asistencia/sesiones`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setSesiones(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  const fetchReporte = () => {
    fetch(`${apiBase}/api/asistencia/reporte`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setReporte(data));
  };

  useEffect(() => {
    fetchSesiones();
    fetchReporte();
  }, []);

  const fetchRegistros = (id: number) => {
    setLoadingRegistros(true);
    fetch(`${apiBase}/api/asistencia/sesiones/${id}/registros`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setRegistros(Array.isArray(data) ? data : []))
      .finally(() => setLoadingRegistros(false));
  };

  const handleSelect = (s: Sesion) => {
    if (selectedSesion?.id === s.id) {
      setSelectedSesion(null);
      setRegistros([]);
    } else {
      setSelectedSesion(s);
      fetchRegistros(s.id);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`${apiBase}/api/asistencia/sesiones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setForm(emptyForm);
      setShowForm(false);
      fetchSesiones();
      fetchReporte();
    } catch {
      alert("Error al crear sesión");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta sesión y todos sus registros?")) return;
    await fetch(`${apiBase}/api/asistencia/sesiones/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (selectedSesion?.id === id) {
      setSelectedSesion(null);
      setRegistros([]);
    }
    fetchSesiones();
    fetchReporte();
  };

  const handleDownloadQR = () => {
    if (!qrModal) return;
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 300, 300);
      ctx.drawImage(img, 0, 0, 300, 300);
      const a = document.createElement("a");
      a.download = `asistencia-qr-${qrModal.id}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrintQR = () => {
    if (!qrModal) return;
    const url = getRegistroUrl(qrModal.id);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Asistencia</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; }
        .card { border: 2px solid #001F5F; border-radius: 12px; padding: 24px; max-width: 320px; width: 100%; text-align: center; }
        h1 { color: #001F5F; font-size: 16px; margin-bottom: 4px; }
        p { color: #555; font-size: 12px; margin: 2px 0; }
        .qr { margin: 16px 0; }
        .info { background: #f9f6ec; border-radius: 8px; padding: 10px; text-align: left; margin-top: 12px; font-size: 11px; }
        .info b { color: #001F5F; }
        .url { font-size: 9px; color: #888; word-break: break-all; margin-top: 8px; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style></head><body>
      <div class="card">
        <h1>📋 Registro de Asistencia</h1>
        <p>Universidad Autónoma de Ica</p>
        <div class="qr" id="qr"></div>
        <div class="info">
          <p><b>Docente:</b> ${qrModal.docente}</p>
          <p><b>Curso:</b> ${qrModal.curso}</p>
          <p><b>Carrera:</b> ${qrModal.carrera}</p>
          <p><b>Ciclo / Sección:</b> ${qrModal.ciclo} — ${qrModal.seccion}</p>
          <p><b>Día:</b> ${qrModal.dia} · ${qrModal.fecha}</p>
        </div>
        <p class="url">${url}</p>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
      <script>
        QRCode.toCanvas(document.createElement('canvas'), "${url}", { width: 200 }, function(err, canvas) {
          document.getElementById('qr').appendChild(canvas);
          setTimeout(() => window.print(), 500);
        });
      </script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reporte de Asistencia</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de sesiones y registro de estudiantes vía QR</p>
        </div>
        <button
          onClick={() => setShowForm((o) => !o)}
          className="flex items-center gap-2 bg-[#001F5F] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#001F5F]/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Sesión
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Crear Sesión de Asistencia</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Docente", key: "docente", placeholder: "Apellidos y nombres del docente" },
              { label: "Curso", key: "curso", placeholder: "Nombre del curso" },
              { label: "Carrera", key: "carrera", placeholder: "Ej: INGENIERÍA CIVIL" },
              { label: "Ciclo", key: "ciclo", placeholder: "Ej: III" },
              { label: "Sección", key: "seccion", placeholder: "Ej: A" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{label} *</label>
                <input
                  type="text"
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F]"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Día *</label>
              <select
                value={form.dia}
                onChange={(e) => setForm((f) => ({ ...f, dia: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F]"
              >
                <option value="">Seleccionar</option>
                {DIAS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Fecha *</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F]"
              />
            </div>

            <div className="col-span-2 md:col-span-3 flex gap-2 justify-end mt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 rounded-lg text-sm bg-[#001F5F] text-white font-medium hover:bg-[#001F5F]/90 disabled:opacity-60"
              >
                {creating ? "Creando..." : "Crear y generar QR"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: "sesiones", label: "Sesiones", Icon: Users },
          { key: "reportes", label: "Gráficos", Icon: BarChart3 },
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

      {/* Sessions tab */}
      {tab === "sesiones" && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-3 border-[#001F5F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sesiones.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay sesiones creadas aún.</p>
              <p className="text-xs">Crea una sesión para generar el QR.</p>
            </div>
          ) : (
            sesiones.map((s) => {
              const isOpen = selectedSesion?.id === s.id;
              return (
                <div key={s.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{s.curso}</span>
                        <span className="text-xs bg-[#001F5F]/10 text-[#001F5F] px-2 py-0.5 rounded-full font-medium">{s.carrera}</span>
                        <span className="text-xs bg-[#C9A84C]/15 text-[#8a6e1f] px-2 py-0.5 rounded-full font-medium">{s.dia} · {s.fecha}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{s.docente} · Ciclo {s.ciclo} · Sec. {s.seccion}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setQrModal(s)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-[#C9A84C] text-white font-medium hover:bg-[#b8942f] transition-colors"
                      >
                        Ver QR
                      </button>
                      <button
                        onClick={() => handleSelect(s)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#001F5F] hover:bg-gray-100 transition-colors"
                      >
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                      {loadingRegistros ? (
                        <p className="text-sm text-gray-400 text-center py-4">Cargando registros...</p>
                      ) : registros.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Ningún estudiante ha registrado asistencia aún.</p>
                      ) : (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            {registros.length} estudiante{registros.length !== 1 ? "s" : ""} registrados
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
                                  <th className="pb-1 pr-4 font-medium">#</th>
                                  <th className="pb-1 pr-4 font-medium">Apellidos</th>
                                  <th className="pb-1 pr-4 font-medium">Nombres</th>
                                  <th className="pb-1 font-medium">Hora</th>
                                </tr>
                              </thead>
                              <tbody>
                                {registros.map((r, i) => (
                                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                                    <td className="py-1.5 pr-4 text-gray-400">{i + 1}</td>
                                    <td className="py-1.5 pr-4 font-medium text-gray-800">{r.apellidos}</td>
                                    <td className="py-1.5 pr-4 text-gray-700">{r.nombres}</td>
                                    <td className="py-1.5 text-gray-400 text-xs">
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
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Reports tab */}
      {tab === "reportes" && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Total Sesiones", value: reporte?.totalSesiones ?? 0, color: "bg-[#001F5F]" },
              { label: "Asistencias Registradas", value: reporte?.totalRegistros ?? 0, color: "bg-[#C9A84C]" },
              { label: "Carreras con Asistencia", value: reporte?.porCarrera.length ?? 0, color: "bg-emerald-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
                <p className={`text-3xl font-bold mt-1 ${color === "bg-[#001F5F]" ? "text-[#001F5F]" : color === "bg-[#C9A84C]" ? "text-[#8a6e1f]" : "text-emerald-700"}`}>{value}</p>
              </div>
            ))}
          </div>

          {reporte && reporte.totalRegistros > 0 ? (
            <>
              {/* Por carrera */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Asistencia por Carrera</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={reporte.porCarrera} margin={{ top: 0, right: 0, left: -20, bottom: 60 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Asistencias" fill="#001F5F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Por curso */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Asistencia por Curso</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={reporte.porCurso} margin={{ top: 0, right: 0, left: -20, bottom: 80 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Asistencias" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Por docente — pie */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Asistencia por Docente</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={reporte.porDocente}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {reporte.porDocente.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} asistencias`]} />
                    <Legend formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aún no hay datos suficientes para mostrar gráficos.</p>
              <p className="text-xs">Crea sesiones y espera que los estudiantes registren su asistencia.</p>
            </div>
          )}
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-[#001F5F] px-5 py-4 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">QR de Asistencia</h2>
              <button onClick={() => setQrModal(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <div ref={qrRef} className="flex justify-center mb-4">
                <QRCodeSVG
                  value={getRegistroUrl(qrModal.id)}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#001F5F"
                  level="H"
                />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1 mb-4">
                <p><span className="font-semibold text-gray-600">Docente:</span> {qrModal.docente}</p>
                <p><span className="font-semibold text-gray-600">Curso:</span> {qrModal.curso}</p>
                <p><span className="font-semibold text-gray-600">Carrera:</span> {qrModal.carrera}</p>
                <p><span className="font-semibold text-gray-600">Ciclo / Sección:</span> {qrModal.ciclo} — {qrModal.seccion}</p>
                <p><span className="font-semibold text-gray-600">Día / Fecha:</span> {qrModal.dia} · {qrModal.fecha}</p>
              </div>
              <p className="text-[10px] text-gray-400 text-center mb-4 break-all">{getRegistroUrl(qrModal.id)}</p>
              <div className="flex gap-2">
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
          </div>
        </div>
      )}
    </div>
  );
}
