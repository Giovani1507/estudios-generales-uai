import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import * as XLSX from "xlsx";
import { Download, RefreshCw, QrCode, Trash2, Loader2 } from "lucide-react";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

const PROBLEMA_LABEL: Record<string, string> = {
  plataforma: "Problemas de plataforma",
  cursos_no_aparecen: "No aparecen sus cursos",
  no_aparece_lista_docente: "No aparece en lista del docente",
  aula_virtual: "Aula virtual",
  otros: "Otros",
};

type Reporte = {
  id: number;
  apellidosNombres: string;
  carrera: string;
  ciclo: string;
  seccion: string;
  problema: string;
  descripcion: string | null;
  createdAt: string;
};

export default function ProblemasEstudiantes() {
  const [data, setData] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const publicUrl = useMemo(() => {
    const base = `${window.location.origin}${import.meta.env.BASE_URL || ""}`.replace(/\/$/, "");
    return `${base}/reportar-problema`;
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/student-problems`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este reporte?")) return;
    const res = await fetch(`${apiBase}/api/student-problems/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) setData((d) => d.filter((r) => r.id !== id));
  }

  function safeText(v: string | null | undefined): string {
    if (v == null) return "";
    return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  }

  function exportExcel() {
    const rows = data.map((r) => ({
      "ID": r.id,
      "Apellidos y Nombres": safeText(r.apellidosNombres),
      "Carrera": safeText(r.carrera),
      "Ciclo": safeText(r.ciclo),
      "Sección": safeText(r.seccion),
      "Tipo de Problema": PROBLEMA_LABEL[r.problema] || r.problema,
      "Descripción": safeText(r.descripcion || ""),
      "Fecha de Registro": new Date(r.createdAt).toLocaleString("es-PE"),
    }));

    const ws = XLSX.utils.json_to_sheet(rows, {
      header: [
        "ID",
        "Apellidos y Nombres",
        "Carrera",
        "Ciclo",
        "Sección",
        "Tipo de Problema",
        "Descripción",
        "Fecha de Registro",
      ],
    });

    ws["!cols"] = [
      { wch: 6 },
      { wch: 32 },
      { wch: 28 },
      { wch: 8 },
      { wch: 10 },
      { wch: 26 },
      { wch: 50 },
      { wch: 22 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reportes");

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `reportes-problemas-${fecha}.xlsx`);
  }

  function downloadQR() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-reporte-problemas.png";
    a.click();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reportes de Problemas</h1>
          <p className="text-sm text-slate-500">
            Reportes enviados por estudiantes desde el código QR público.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowQR((v) => !v)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <QrCode className="w-4 h-4" /> {showQR ? "Ocultar QR" : "Mostrar QR"}
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
          <button
            onClick={exportExcel}
            disabled={data.length === 0}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Descargar Excel
          </button>
        </div>
      </div>

      {showQR && (
        <div className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div ref={qrRef} className="bg-white p-3 border border-slate-200 rounded-xl">
              <QRCodeCanvas value={publicUrl} size={200} includeMargin />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-800 mb-1">Código QR público</h3>
              <p className="text-sm text-slate-600 mb-2">
                Compártelo con los estudiantes para que reporten sus problemas sin necesidad de iniciar sesión.
              </p>
              <p className="text-xs text-slate-500 break-all bg-slate-50 border border-slate-200 rounded p-2 mb-3">
                {publicUrl}
              </p>
              <button
                onClick={downloadQR}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                <Download className="w-4 h-4" /> Descargar QR
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <tr>
                <Th>Fecha</Th>
                <Th>Apellidos y Nombres</Th>
                <Th>Carrera</Th>
                <Th>Ciclo</Th>
                <Th>Sección</Th>
                <Th>Problema</Th>
                <Th>Descripción</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Cargando…
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Aún no hay reportes. Comparte el QR para empezar a recibirlos.
                  </td>
                </tr>
              ) : (
                data.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <Td className="whitespace-nowrap text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleString("es-PE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </Td>
                    <Td className="font-medium text-slate-800">{r.apellidosNombres}</Td>
                    <Td className="text-slate-600">{r.carrera}</Td>
                    <Td>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-xs font-semibold">
                        {r.ciclo}
                      </span>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center justify-center w-7 h-6 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">
                        {r.seccion}
                      </span>
                    </Td>
                    <Td>
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        {PROBLEMA_LABEL[r.problema] || r.problema}
                      </span>
                    </Td>
                    <Td className="max-w-xs text-slate-600 text-xs">
                      {r.descripcion || <span className="text-slate-300">—</span>}
                    </Td>
                    <Td className="text-right">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left font-semibold text-xs uppercase tracking-wide px-4 py-3 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
