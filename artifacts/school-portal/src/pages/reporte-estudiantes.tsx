import { useState, useEffect, useMemo } from "react";
import { Users, Download, Trash2, Search, RefreshCw, Phone, CalendarCheck, Clock, Printer } from "lucide-react";
import * as ExcelJS from "exceljs";

interface StudentReg {
  id: number;
  dni: string | null;
  apellidos: string;
  nombres: string;
  telefono: string;
  carrera: string;
  ciclo: string | null;
  horarioAsignado: boolean;
  createdAt: string;
  pagado: boolean;
  apellidosNombres: string | null;
  codigoEstudiante: string | null;
  carreraIngresante: string | null;
  modalidadEstudio: string | null;
  turno: string | null;
  seccion: string | null;
  sede: string | null;
  celular: string | null;
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

function printQR(url: string) {
  const encoded   = encodeURIComponent(url);
  const qrSrc     = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&margin=20&data=${encoded}`;
  const logoSrc   = `${window.location.origin}${(import.meta.env.BASE_URL || "").replace(/\/$/, "")}/escudo.png`;

  const win = window.open("", "_blank", "width=680,height=900");
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>QR Registro Estudiantes – UAI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Calibri, Arial, sans-serif;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 30px;
      color: #111;
    }
    .header {
      background: #001F5F;
      color: #fff;
      width: 100%;
      max-width: 500px;
      border-radius: 14px;
      padding: 22px 30px;
      display: flex;
      align-items: center;
      gap: 18px;
      margin-bottom: 28px;
    }
    .header img { width: 64px; height: 64px; object-fit: contain; flex-shrink: 0; }
    .header-text h1 { font-size: 17px; font-weight: 700; line-height: 1.3; }
    .header-text p  { font-size: 11px; opacity: .75; margin-top: 3px; }
    .title {
      color: #C9A84C;
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      margin-top: 6px;
      text-transform: uppercase;
      letter-spacing: .5px;
    }
    .qr-box {
      border: 2px solid #e5e7eb;
      border-radius: 18px;
      padding: 22px;
      background: #f9fafb;
      margin-bottom: 20px;
    }
    .qr-box img { display: block; }
    .instructions {
      font-size: 13px;
      color: #374151;
      text-align: center;
      max-width: 380px;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .url-box {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 8px 14px;
      font-size: 10px;
      color: #6b7280;
      word-break: break-all;
      text-align: center;
      max-width: 440px;
    }
    .footer {
      margin-top: 28px;
      font-size: 10px;
      color: #9ca3af;
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoSrc}" alt="UAI" onerror="this.style.display='none'"/>
    <div class="header-text">
      <h1>UNIVERSIDAD AUTÓNOMA DE ICA</h1>
      <p>Dirección Académica · Semestre 2026-1</p>
      <p class="title">Registro de Estudiantes sin Horario Asignado</p>
    </div>
  </div>
  <div class="qr-box">
    <img src="${qrSrc}" width="280" height="280" alt="QR Registro"/>
  </div>
  <p class="instructions">
    Escanea este código QR con tu dispositivo móvil para registrarte en el sistema de estudiantes sin horario asignado.
  </p>
  <div class="url-box">${url}</div>
  <p class="footer">Portal Académico UAI · ${new Date().toLocaleDateString("es-PE", { dateStyle: "long" })}</p>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 600); };
  </script>
</body>
</html>`);
  win.document.close();
}

export default function ReporteEstudiantes() {
  const [students, setStudents] = useState<StudentReg[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState("");
  const [filterCiclo, setFilterCiclo] = useState<"all" | "1" | "2">("all");
  const [filterHorario, setFilterHorario] = useState<"all" | "asignado" | "pendiente">("all");
  const [filterPago, setFilterPago] = useState<"all" | "pagado" | "nopagado">("all");
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
      const displayName = s.apellidosNombres || `${s.apellidos} ${s.nombres}`;
      const displayCarrera = s.carreraIngresante || s.carrera;
      const matchSearch = !q ||
        displayName.toLowerCase().includes(q) ||
        displayCarrera.toLowerCase().includes(q) ||
        (s.celular || "").includes(q) ||
        (s.dni || "").includes(q);
      const matchCiclo = filterCiclo === "all" || s.ciclo === filterCiclo;
      const matchHorario =
        filterHorario === "all" ||
        (filterHorario === "asignado") === s.horarioAsignado;
      const matchPago =
        filterPago === "all" ||
        (filterPago === "pagado") === s.pagado;
      return matchSearch && matchCiclo && matchHorario && matchPago;
    });
  }, [students, search, filterCiclo, filterHorario, filterPago]);

  const totalAsignado  = students.filter(s => s.horarioAsignado).length;
  const totalPendiente = students.filter(s => !s.horarioAsignado).length;
  const totalCiclo1    = students.filter(s => s.ciclo === "1").length;
  const totalCiclo2    = students.filter(s => s.ciclo === "2").length;
  const totalPagado    = students.filter(s => s.pagado).length;
  const totalNoPagado  = students.filter(s => !s.pagado).length;

  async function downloadExcel() {
    const NAV   = "001F5F";
    const GOLD  = "C9A84C";
    const WHITE = "FFFFFF";
    const LGRAY = "F2F5FB";
    const DGRAY = "4B5563";
    const GREEN = "166534";
    const GRNBG = "DCFCE7";
    const REDBG = "FEE2E2";
    const REDTX = "991B1B";

    const wb = new ExcelJS.Workbook();
    wb.creator = "Portal Académico UAI";
    wb.created = new Date();

    const ws = wb.addWorksheet("Reporte Estudiantes", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    });

    // Column widths  (col A is wider to hold the logo in the header)
    ws.columns = [
      { key: "n",               width: 6  },
      { key: "codigo",          width: 16 },
      { key: "nombre",          width: 32 },
      { key: "dni",             width: 12 },
      { key: "carrera",         width: 30 },
      { key: "pago",            width: 12 },
      { key: "modalidad",       width: 16 },
      { key: "turno",           width: 12 },
      { key: "seccion",         width: 10 },
      { key: "sede",            width: 12 },
      { key: "horario",         width: 16 },
      { key: "fecha",           width: 18 },
      { key: "telefono",        width: 14 },
    ];

    const TOTAL_COLS = 13;

    // ── Try to embed logo (escudo/crest, fixed pixel size) ───────────────
    try {
      const logoUrl = `${window.location.origin}${apiBase}/escudo.png`;
      const resp = await fetch(logoUrl);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const logoId = wb.addImage({ buffer: arrayBuf, extension: "png" });
        // Use ext (fixed px) so the image is never distorted/squashed
        ws.addImage(logoId, {
          tl: { col: 0.08, row: 0.12 },
          ext: { width: 88, height: 88 },
          editAs: "oneCell",
        } as any);
      }
    } catch { /* skip logo if unavailable */ }

    // ── Row 1-4: Institution header block ─────────────────────────────────
    const styleHeaderCell = (row: number, col: number, value: string, opts: {
      size?: number; bold?: boolean; color?: string; italic?: boolean; align?: ExcelJS.Alignment["horizontal"];
    } = {}) => {
      const cell = ws.getCell(row, col);
      cell.value = value;
      cell.font = {
        name: "Calibri", size: opts.size ?? 11,
        bold: opts.bold ?? false, italic: opts.italic ?? false,
        color: { argb: "FF" + (opts.color ?? WHITE) },
      };
      cell.alignment = { vertical: "middle", horizontal: opts.align ?? "center", wrapText: true };
    };

    // Merge cols 2-8 for header text (col 1 is logo)
    ws.mergeCells(1, 1, 4, 1); // logo area
    ws.mergeCells(1, 2, 1, TOTAL_COLS);
    ws.mergeCells(2, 2, 2, TOTAL_COLS);
    ws.mergeCells(3, 2, 3, TOTAL_COLS);
    ws.mergeCells(4, 2, 4, TOTAL_COLS);

    for (let r = 1; r <= 4; r++) {
      for (let c = 1; c <= TOTAL_COLS; c++) {
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAV } };
      }
      ws.getRow(r).height = r === 1 ? 34 : r === 2 ? 26 : r === 3 ? 20 : 16;
    }

    styleHeaderCell(1, 2, "UNIVERSIDAD AUTÓNOMA DE ICA", { size: 16, bold: true, color: WHITE });
    styleHeaderCell(2, 2, "Dirección Académica · Semestre 2026-1", { size: 11, color: "BBCFEE", italic: true });
    styleHeaderCell(3, 2, "REPORTE DE ESTUDIANTES SIN HORARIO ASIGNADO", { size: 13, bold: true, color: GOLD });
    const now = new Date();
    styleHeaderCell(4, 2,
      `Generado: ${now.toLocaleDateString("es-PE", { dateStyle: "long" })} · ${now.toLocaleTimeString("es-PE", { timeStyle: "short" })} · Total: ${filtered.length} registros`,
      { size: 9, color: "BBCFEE" }
    );

    // ── Row 5: empty spacer ───────────────────────────────────────────────
    ws.getRow(5).height = 6;

    // ── Row 6: summary stats ──────────────────────────────────────────────
    const asignados  = filtered.filter(s => s.horarioAsignado).length;
    const pendientes = filtered.filter(s => !s.horarioAsignado).length;
    const ciclo1     = filtered.filter(s => s.ciclo === "1").length;
    const ciclo2     = filtered.filter(s => s.ciclo === "2").length;

    const pagados     = filtered.filter(s => s.pagado).length;
    const sinData     = filtered.filter(s => !s.pagado).length;

    const summaryPairs: [string, string | number][] = [
      ["Total", filtered.length],
      ["Con horario", asignados],
      ["Pendientes", pendientes],
      ["Pagados", pagados],
      ["Sin Data", sinData],
      ["Ciclo 1", ciclo1],
      ["Ciclo 2", ciclo2],
    ];

    ws.mergeCells(6, 1, 6, TOTAL_COLS);
    const summaryRow = ws.getRow(6);
    summaryRow.height = 18;

    // Build a single merged summary cell string
    const summaryText = summaryPairs.map(([k, v]) => `${k}: ${v}`).join("   |   ");
    const summCell = ws.getCell(6, 1);
    summCell.value = summaryText;
    summCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF" + NAV } };
    summCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF8" } };
    summCell.alignment = { horizontal: "center", vertical: "middle" };
    summCell.border = {
      bottom: { style: "medium", color: { argb: "FF" + NAV } },
    };

    // ── Row 7: empty spacer ───────────────────────────────────────────────
    ws.getRow(7).height = 4;

    // ── Row 8: Column headers ─────────────────────────────────────────────
    const HEADERS = ["N°", "Cód. Estudiante", "Apellidos y Nombres", "DNI", "Carrera", "Pago", "Modalidad", "Turno", "Sección", "Sede", "Horario", "Fecha Registro", "Nro. Celular"];
    const headerRow = ws.getRow(8);
    headerRow.height = 22;
    HEADERS.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF" + WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAV } };
      cell.alignment = { horizontal: idx === 0 ? "center" : "left", vertical: "middle" };
      cell.border = {
        top:    { style: "thin", color: { argb: "FF" + GOLD } },
        bottom: { style: "thin", color: { argb: "FF" + GOLD } },
        left:   { style: "thin", color: { argb: "FF304B80" } },
        right:  { style: "thin", color: { argb: "FF304B80" } },
      };
    });

    // ── Data rows (starting row 9) ────────────────────────────────────────
    filtered.forEach((s, i) => {
      const rowNum = 9 + i;
      const dataRow = ws.getRow(rowNum);
      dataRow.height = 16;
      const isEven = i % 2 === 1;
      const bgColor = isEven ? LGRAY : WHITE;

      const PAGADOBG = "F0FDF4"; const PAGADOTX = "16a34a";
      const NOPAGBG  = "FFFBEB"; const NOPAGTX  = "B45309";

      const displayName    = s.apellidosNombres || `${s.apellidos} ${s.nombres}`.trim() || "—";
      const displayCarrera = s.carreraIngresante || s.carrera || "—";
      const values: (string | number)[] = [
        i + 1,
        s.codigoEstudiante || "—",
        displayName,
        s.dni || "—",
        displayCarrera,
        s.pagado ? "✓ PAGADO" : "✗ SIN DATA",
        s.modalidadEstudio || "—",
        s.turno || "—",
        s.seccion || "—",
        s.sede || "—",
        s.horarioAsignado ? "✓ ASIGNADO" : "⏳ PENDIENTE",
        new Date(s.createdAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }),
        s.celular || "—",
      ];

      values.forEach((val, colIdx) => {
        const cell = dataRow.getCell(colIdx + 1);
        cell.value = val;
        cell.font = { name: "Calibri", size: 10, color: { argb: "FF" + DGRAY } };
        cell.alignment = { vertical: "middle", horizontal: colIdx === 0 || colIdx === 6 ? "center" : "left" };

        if (colIdx === 5) {
          // Pago column
          cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF" + (s.pagado ? PAGADOTX : NOPAGTX) } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + (s.pagado ? PAGADOBG : NOPAGBG) } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colIdx === 10) {
          // Horario column
          cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF" + (s.horarioAsignado ? GREEN : REDTX) } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + (s.horarioAsignado ? GRNBG : REDBG) } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bgColor } };
        }

        cell.border = {
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left:   { style: "thin", color: { argb: "FFE2E8F0" } },
          right:  { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    });

    // ── Footer row ────────────────────────────────────────────────────────
    const footerRowNum = 9 + filtered.length + 1;
    ws.mergeCells(footerRowNum, 1, footerRowNum, TOTAL_COLS);
    const footerCell = ws.getCell(footerRowNum, 1);
    footerCell.value = "Documento generado por el Portal Académico de la Universidad Autónoma de Ica — Uso interno";
    footerCell.font = { name: "Calibri", size: 8, italic: true, color: { argb: "FF9CA3AF" } };
    footerCell.alignment = { horizontal: "center", vertical: "middle" };
    footerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFF" } };
    ws.getRow(footerRowNum).height = 14;

    // ── Freeze panes & generate ───────────────────────────────────────────
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 8, activeCell: "A9" }];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const dateStr = now.toISOString().slice(0, 10);
    a.download = `UAI-Reporte-Estudiantes-${dateStr}.xlsx`;
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
          <button
            onClick={() => printQR(formUrl)}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Descargar / Imprimir QR
          </button>
        </div>

        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
          {[
            { label: "Total registros", value: students.length,  color: "#2f5aa6" },
            { label: "Con horario",     value: totalAsignado,    color: "#16a34a" },
            { label: "Pendientes",      value: totalPendiente,   color: "#dc2626" },
            { label: "En Data (pagado)",value: totalPagado,      color: "#7c3aed" },
            { label: "Sin Data",        value: totalNoPagado,    color: "#f59e0b" },
            { label: "Ciclo 1",         value: totalCiclo1,      color: "#0891b2" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 flex flex-col gap-1">
              <div className="w-8 h-1 rounded-full mb-2" style={{ background: s.color }} />
              <p className="text-2xl font-extrabold leading-none" style={{ color: s.color }}>{s.value}</p>
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

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["all","pagado","nopagado"] as const).map(v => (
              <button
                key={v}
                onClick={() => setFilterPago(v)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  filterPago === v ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {v === "all" ? "Pago: Todos" : v === "pagado" ? "✓ En Data" : "✗ Sin Data"}
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
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">DNI</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Apellidos y Nombres</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Nro. Celular</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Carrera</th>
                  <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Ciclo</th>
                  <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Pago</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Modalidad / Turno / Sección</th>
                  <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Horario</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-3 font-mono text-xs font-bold text-gray-700 whitespace-nowrap">
                      {s.dni || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 max-w-[220px]">
                      {s.apellidosNombres ? (
                        <>
                          <p className="font-semibold text-gray-800 text-xs leading-snug">{s.apellidosNombres}</p>
                          {s.codigoEstudiante && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold text-primary bg-primary/10 rounded px-1.5 py-px tracking-wider">
                              {s.codigoEstudiante}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-gray-800 text-xs">{s.apellidos}</p>
                          <p className="text-gray-500 text-xs">{s.nombres}</p>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                        <Phone className="w-3 h-3 text-gray-400" />
                        {s.celular || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs max-w-[160px] truncate">
                      {s.carreraIngresante || s.carrera || "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {s.ciclo ? (
                        <span className="inline-block bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                          {s.ciclo}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {s.pagado ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          ✓ Pagado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          ✗ Sin data
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {s.pagado ? (
                        <div className="flex flex-col gap-0.5">
                          {s.modalidadEstudio && (
                            <span className="inline-block bg-violet-50 text-violet-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                              {s.modalidadEstudio}
                            </span>
                          )}
                          <div className="flex gap-1 flex-wrap">
                            {s.turno && (
                              <span className="inline-block bg-blue-50 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                {s.turno}
                              </span>
                            )}
                            {s.seccion && (
                              <span className="inline-block bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                Sec. {s.seccion}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggleHorario(s)}
                        disabled={toggling === s.id}
                        title={s.horarioAsignado ? "Marcar como pendiente" : "Marcar horario asignado"}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${
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
                            <CalendarCheck className="w-3 h-3" />
                            Asignado
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            Pendiente
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-3">
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
