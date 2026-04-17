import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import * as XLSX from "xlsx";
import { Download, RefreshCw, QrCode, Trash2, Loader2, Printer } from "lucide-react";

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

  function printQR() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const qrDataUrl = canvas.toDataURL("image/png");
    const logoUrl = `${window.location.origin}${import.meta.env.BASE_URL || ""}logo.png`;

    const w = window.open("", "_blank", "width=820,height=1100");
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>QR · Reporte de Problemas · UAI</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0; padding: 24px;
    color: #0a1f5c;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .card {
    max-width: 640px; margin: 0 auto;
    border: 3px solid #0a1f5c; border-radius: 18px;
    padding: 32px 28px; text-align: center;
    background: #fff;
  }
  .top { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 4px; }
  .top img { height: 70px; }
  .top .titles { text-align: left; }
  .top .titles h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; line-height: 1.1; }
  .top .titles p  { margin: 0; font-size: 12px; color: #475569; font-weight: 600; }
  .divider { height: 4px; background: linear-gradient(90deg,#0a1f5c,#2563eb); margin: 18px 0 22px; border-radius: 2px; }
  .heading { font-size: 26px; font-weight: 800; margin: 0 0 6px; }
  .sub { font-size: 14px; color: #334155; margin: 0 0 22px; }
  .qr-wrap { display: inline-block; padding: 14px; background: #fff; border: 2px solid #e2e8f0; border-radius: 14px; }
  .qr-wrap img { display: block; width: 320px; height: 320px; }
  .steps { margin-top: 22px; text-align: left; background: #f1f5f9; border-radius: 12px; padding: 14px 18px; font-size: 13px; color: #1e293b; line-height: 1.55; }
  .steps b { color: #0a1f5c; }
  .url { margin-top: 18px; font-size: 11px; color: #64748b; word-break: break-all; }
  .footer { margin-top: 22px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { .noprint { display: none; } }
  .actions { text-align: center; margin-top: 18px; }
  .actions button {
    background: #0a1f5c; color: #fff; border: 0; padding: 10px 22px;
    border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;
    margin: 0 4px;
  }
  .actions button.alt { background: #475569; }
</style>
</head>
<body>
  <div class="card">
    <div class="top">
      <img src="${logoUrl}" alt="UAI" onerror="this.style.display='none'" />
      <div class="titles">
        <h1>UNIVERSIDAD AUTÓNOMA DE ICA</h1>
        <p>Estudios Generales · Portal Académico</p>
      </div>
    </div>
    <div class="divider"></div>
    <h2 class="heading">Reporta tu problema</h2>
    <p class="sub">Escanea el código QR con tu celular para registrar tu reporte.</p>
    <div class="qr-wrap"><img src="${qrDataUrl}" alt="QR" /></div>
    <div class="steps">
      <b>¿Cómo usarlo?</b><br/>
      1. Abre la cámara de tu celular.<br/>
      2. Apunta al código QR y toca el aviso que aparece.<br/>
      3. Llena el formulario con tus datos y describe tu problema.
    </div>
    <div class="url">${publicUrl}</div>
    <div class="footer">Universidad Autónoma de Ica · Portal Académico © ${new Date().getFullYear()}</div>
  </div>
  <div class="actions noprint">
    <button onclick="window.print()">Imprimir</button>
    <button class="alt" onclick="window.close()">Cerrar</button>
  </div>
  <script>
    const img = document.querySelector('.qr-wrap img');
    const logo = document.querySelector('.top img');
    Promise.all([img, logo].map(el => {
      if (!el || el.complete) return Promise.resolve();
      return new Promise(r => { el.onload = r; el.onerror = r; });
    })).then(() => setTimeout(() => window.print(), 300));
  <\/script>
</body>
</html>`);
    w.document.close();
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
              <QRCodeCanvas
                value={publicUrl}
                size={220}
                includeMargin
                level="H"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-800 mb-1">Código QR público</h3>
              <p className="text-sm text-slate-600 mb-2">
                Compártelo con los estudiantes para que reporten sus problemas sin necesidad de iniciar sesión.
              </p>
              <p className="text-xs text-slate-500 break-all bg-slate-50 border border-slate-200 rounded p-2 mb-3">
                {publicUrl}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={printQR}
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  <Printer className="w-4 h-4" /> Imprimir con logo UAI
                </button>
                <button
                  onClick={downloadQR}
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  <Download className="w-4 h-4" /> Descargar PNG
                </button>
              </div>
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
