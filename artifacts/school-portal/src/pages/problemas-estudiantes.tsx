import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import ExcelJS from "exceljs";
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

  async function exportExcel() {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Universidad Autónoma de Ica";
    wb.created = new Date();

    const ws = wb.addWorksheet("Reportes de Problemas", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      properties: { defaultRowHeight: 18 },
    });

    const COLS = [
      { header: "N°", key: "n", width: 6 },
      { header: "Apellidos y Nombres", key: "apellidosNombres", width: 34 },
      { header: "Carrera", key: "carrera", width: 30 },
      { header: "Ciclo", key: "ciclo", width: 8 },
      { header: "Sección", key: "seccion", width: 10 },
      { header: "Tipo de Problema", key: "problema", width: 28 },
      { header: "Descripción", key: "descripcion", width: 50 },
      { header: "Fecha de Registro", key: "fecha", width: 22 },
    ];
    const totalCols = COLS.length;
    const lastColLetter = String.fromCharCode(64 + totalCols);

    // Logo
    try {
      const logoRes = await fetch(`${import.meta.env.BASE_URL}logo.png`);
      const logoBuf = await logoRes.arrayBuffer();
      const logoId = wb.addImage({ buffer: logoBuf, extension: "png" });
      ws.addImage(logoId, {
        tl: { col: 0.15, row: 0.15 },
        ext: { width: 90, height: 90 },
        editAs: "absolute",
      });
    } catch {
      /* ignore logo errors */
    }

    // Reserve logo rows
    ws.getRow(1).height = 24;
    ws.getRow(2).height = 24;
    ws.getRow(3).height = 24;
    ws.getRow(4).height = 24;

    // Title block (right of logo)
    ws.mergeCells(`B1:${lastColLetter}1`);
    const t1 = ws.getCell("B1");
    t1.value = "UNIVERSIDAD AUTÓNOMA DE ICA";
    t1.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    t1.alignment = { vertical: "middle", horizontal: "center" };
    t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A1F5C" } };

    ws.mergeCells(`B2:${lastColLetter}2`);
    const t2 = ws.getCell("B2");
    t2.value = "Estudios Generales · Portal Académico";
    t2.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    t2.alignment = { vertical: "middle", horizontal: "center" };
    t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };

    ws.mergeCells(`B3:${lastColLetter}3`);
    const t3 = ws.getCell("B3");
    t3.value = "REPORTE DE PROBLEMAS DE ESTUDIANTES";
    t3.font = { name: "Calibri", size: 13, bold: true, color: { argb: "FF0A1F5C" } };
    t3.alignment = { vertical: "middle", horizontal: "center" };
    t3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };

    ws.mergeCells(`B4:${lastColLetter}4`);
    const t4 = ws.getCell("B4");
    const ahora = new Date().toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short" });
    t4.value = `Total de reportes: ${data.length}    ·    Generado: ${ahora}`;
    t4.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF475569" } };
    t4.alignment = { vertical: "middle", horizontal: "center" };
    t4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

    // Set widths
    COLS.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width;
    });

    // Header row at row 6 (row 5 left blank as spacer)
    ws.getRow(5).height = 6;
    const headerRowIdx = 6;
    const headerRow = ws.getRow(headerRowIdx);
    COLS.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A1F5C" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FF0A1F5C" } },
        bottom: { style: "thin", color: { argb: "FF0A1F5C" } },
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });
    headerRow.height = 30;

    // Data rows
    data.forEach((r, idx) => {
      const rowIdx = headerRowIdx + 1 + idx;
      const row = ws.getRow(rowIdx);
      const values = [
        idx + 1,
        safeText(r.apellidosNombres),
        safeText(r.carrera),
        safeText(r.ciclo),
        safeText(r.seccion),
        PROBLEMA_LABEL[r.problema] || r.problema,
        safeText(r.descripcion || ""),
        new Date(r.createdAt).toLocaleString("es-PE"),
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.font = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
        cell.alignment = {
          vertical: "middle",
          horizontal: i === 0 || i === 3 || i === 4 ? "center" : "left",
          wrapText: true,
        };
        const zebra = idx % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
      row.height = Math.max(20, Math.min(60, Math.ceil((r.descripcion?.length || 0) / 50) * 16 + 20));
    });

    // Freeze header
    ws.views = [{ state: "frozen", ySplit: headerRowIdx }];

    // Auto filter
    ws.autoFilter = {
      from: { row: headerRowIdx, column: 1 },
      to: { row: headerRowIdx + data.length, column: totalCols },
    };

    // Footer
    const footerIdx = headerRowIdx + data.length + 2;
    ws.mergeCells(`A${footerIdx}:${lastColLetter}${footerIdx}`);
    const f = ws.getCell(`A${footerIdx}`);
    f.value = "Universidad Autónoma de Ica · Documento generado automáticamente desde el Portal Académico";
    f.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF94A3B8" } };
    f.alignment = { vertical: "middle", horizontal: "center" };

    // Download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `UAI-reportes-problemas-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
