import { useState, useEffect, useMemo } from "react";
import { Users, Download, Trash2, Search, RefreshCw, Phone, CalendarCheck, Clock } from "lucide-react";
import * as ExcelJS from "exceljs";

interface StudentReg {
  id: number;
  apellidos: string;
  nombres: string;
  telefono: string;
  carrera: string;
  ciclo: string | null;
  horarioAsignado: boolean;
  createdAt: string;
}

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

function getFormUrl(): string {
  const origin = window.location.origin;
  return `${origin}${apiBase}/registroestudiantesinhorario`;
}

function QrImage({ url }: { url: string }) {
  const encoded = encodeURIComponent(url);
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encoded}`}
      alt="QR de registro"
      className="rounded-xl shadow-sm"
      style={{ width: 160, height: 160 }}
    />
  );
}

export default function ReporteEstudiantes() {
  const [students, setStudents] = useState<StudentReg[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState("");
  const [filterCiclo, setFilterCiclo] = useState<"all" | "1" | "2">("all");
  const [filterHorario, setFilterHorario] = useState<"all" | "asignado" | "pendiente">("all");
  const [toggling, setToggling] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const formUrl = getFormUrl();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/students/register`, { credentials: "include" });
      if (res.ok) setStudents(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleHorario(s: StudentReg) {
    setToggling(s.id);
    const newVal = !s.horarioAsignado;
    try {
      const res = await fetch(`${apiBase}/api/students/register/${s.id}/horario`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ horarioAsignado: newVal }),
      });
      if (res.ok) {
        setStudents(prev => prev.map(x => x.id === s.id ? { ...x, horarioAsignado: newVal } : x));
      }
    } catch {}
    setToggling(null);
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este registro?")) return;
    setDeleting(id);
    try {
      await fetch(`${apiBase}/api/students/register/${id}`, { method: "DELETE", credentials: "include" });
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch {}
    setDeleting(null);
  }

  const filtered = useMemo(() => {
    return students.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        s.apellidos.toLowerCase().includes(q) ||
        s.nombres.toLowerCase().includes(q) ||
        (s.telefono || "").includes(q) ||
        s.carrera.toLowerCase().includes(q);
      const matchCiclo = filterCiclo === "all" || s.ciclo === filterCiclo;
      const matchHorario =
        filterHorario === "all" ||
        (filterHorario === "asignado") === s.horarioAsignado;
      return matchSearch && matchCiclo && matchHorario;
    });
  }, [students, search, filterCiclo, filterHorario]);

  const totalAsignado  = students.filter(s => s.horarioAsignado).length;
  const totalPendiente = students.filter(s => !s.horarioAsignado).length;
  const totalCiclo1    = students.filter(s => s.ciclo === "1").length;
  const totalCiclo2    = students.filter(s => s.ciclo === "2").length;

  async function downloadExcel() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reporte Estudiantes");
    ws.columns = [
      { header: "N°",              key: "n",              width: 5  },
      { header: "Apellidos",       key: "apellidos",      width: 24 },
      { header: "Nombres",         key: "nombres",        width: 24 },
      { header: "Teléfono",        key: "telefono",       width: 14 },
      { header: "Carrera",         key: "carrera",        width: 32 },
      { header: "Ciclo",           key: "ciclo",          width: 8  },
      { header: "Horario Asignado", key: "horario",       width: 16 },
      { header: "Fecha",           key: "createdAt",      width: 20 },
    ];
    filtered.forEach((s, i) => {
      ws.addRow({
        n: i + 1,
        apellidos: s.apellidos,
        nombres: s.nombres,
        telefono: s.telefono || "—",
        carrera: s.carrera,
        ciclo: s.ciclo || "—",
        horario: s.horarioAsignado ? "SÍ" : "PENDIENTE",
        createdAt: new Date(s.createdAt).toLocaleString("es-PE"),
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reporte-estudiantes-${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reporte de Estudiantes sin Horario</h1>
          <p className="text-sm text-gray-500">Registros recibidos mediante formulario QR · 2026-1</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* QR Panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-4">
          <p className="text-sm font-bold text-gray-700">Código QR para estudiantes</p>
          <QrImage url={formUrl} />
          <p className="text-xs text-gray-400 text-center leading-snug">
            Los estudiantes sin horario escanean este código para registrarse
          </p>
          <div className="w-full border border-gray-100 rounded-xl px-3 py-2 bg-gray-50">
            <p className="text-[10px] text-gray-400 mb-0.5">Enlace directo:</p>
            <a
              href={formUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-primary break-all hover:underline"
            >
              {formUrl}
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 content-start">
          {[
            { label: "Total registros", value: students.length,  color: "#2f5aa6", bg: "#dbeafe" },
            { label: "Con horario",     value: totalAsignado,    color: "#16a34a", bg: "#dcfce7" },
            { label: "Pendientes",      value: totalPendiente,   color: "#dc2626", bg: "#fee2e2" },
            { label: "Ciclo 1",         value: totalCiclo1,      color: "#7c3aed", bg: "#ede9fe" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5 flex flex-col gap-1">
              <div className="w-8 h-1 rounded-full mb-2" style={{ background: s.color }} />
              <p className="text-3xl font-extrabold leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-semibold text-gray-600 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 h-9 flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono o carrera…"
              className="bg-transparent text-sm flex-1 focus:outline-none"
            />
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["all","1","2"] as const).map(v => (
              <button
                key={v}
                onClick={() => setFilterCiclo(v)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  filterCiclo === v ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {v === "all" ? "Todos" : `Ciclo ${v}`}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["all","pendiente","asignado"] as const).map(v => (
              <button
                key={v}
                onClick={() => setFilterHorario(v)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  filterHorario === v ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {v === "all" ? "Todos" : v === "asignado" ? "Con horario" : "Pendientes"}
              </button>
            ))}
          </div>

          <button
            onClick={load}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={downloadExcel}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
              Cargando registros…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users className="w-10 h-10 mb-3 text-gray-200" />
              <p className="text-sm font-medium">Sin registros aún</p>
              <p className="text-xs mt-1">Comparte el QR con los estudiantes para recibir datos</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Apellidos y Nombres</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Teléfono</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Carrera</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Ciclo</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Horario Asignado</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800 text-xs">{s.apellidos}</p>
                      <p className="text-gray-500 text-xs">{s.nombres}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                        <Phone className="w-3 h-3 text-gray-400" />
                        {s.telefono || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{s.carrera}</td>
                    <td className="px-4 py-3 text-center">
                      {s.ciclo ? (
                        <span className="inline-block bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                          Ciclo {s.ciclo}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleHorario(s)}
                        disabled={toggling === s.id}
                        title={s.horarioAsignado ? "Marcar como pendiente" : "Marcar horario asignado"}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${
                          toggling === s.id ? "opacity-50 cursor-wait" : "cursor-pointer hover:scale-105 active:scale-95"
                        }`}
                        style={s.horarioAsignado ? {
                          background: "#dcfce7",
                          borderColor: "#16a34a",
                          color: "#16a34a",
                        } : {
                          background: "#f9fafb",
                          borderColor: "#e5e7eb",
                          color: "#9ca3af",
                        }}
                      >
                        {s.horarioAsignado ? (
                          <>
                            <CalendarCheck className="w-3.5 h-3.5" />
                            Asignado
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            Pendiente
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={deleting === s.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            Mostrando {filtered.length} de {students.length} registros
          </div>
        )}
      </div>
    </div>
  );
}
