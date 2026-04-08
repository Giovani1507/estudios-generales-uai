import React, { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Search,
  X,
  RefreshCw,
  Merge,
  Users,
  UserX,
  UserCheck,
  Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const NAVY = "#001F5F";
const GOLD = "#C9A84C";

type AnyRow = Record<string, string>;

/* ── helpers ─────────────────────────────────────────────── */
function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function str(v: unknown) { return String(v ?? "").trim(); }

function findCol(headers: string[], kws: string[]): string {
  return headers.find(h => kws.some(k => norm(h).includes(k))) ?? "";
}

function readExcel(file: File): Promise<AnyRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error leyendo archivo"));
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<AnyRow>(ws, { defval: "" });
        resolve(json.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, str(v)]))));
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

/* ── Detect columns ──────────────────────────────────────── */
type ColMap = {
  keyCol: string;
  apellidosCol: string;
  nombresCol: string;
  dniCol: string;
  programaCol: string;
  asistenciaCol: string;
  pagoCol: string;
  condicionCol: string;
  modalidadCol: string;
  turnoCol: string;
  sedeCol: string;
};

function detectColsA(headers: string[]): Partial<ColMap> {
  const keyCol = findCol(headers, ["codigo", "cod", "matricula"]);
  return {
    keyCol,
    apellidosCol: findCol(headers, ["apellido"]),
    nombresCol:   headers.find(h => norm(h).includes("nombre") && !norm(h).includes("apellido")) ?? "",
    dniCol:       findCol(headers, ["dni", "documento"]),
    modalidadCol: headers.find(h => norm(h).includes("modalidad") && norm(h).includes("estudio"))
                  ?? headers.find(h => norm(h).includes("modalidad") && !norm(h).includes("ingreso"))
                  ?? "",
    turnoCol:     findCol(headers, ["turno"]),
    sedeCol:      findCol(headers, ["sede", "filial", "local"]),
  };
}

function detectColsB(headers: string[]): Partial<ColMap> {
  const keyCol = findCol(headers, ["codigo", "cod", "matricula"]);
  return {
    keyCol,
    apellidosCol:  findCol(headers, ["apellido"]),
    nombresCol:    headers.find(h => norm(h).includes("nombre") && !norm(h).includes("apellido")) ?? "",
    dniCol:        findCol(headers, ["dni", "documento"]),
    programaCol:   findCol(headers, ["programa", "carrera", "area"]),
    asistenciaCol: findCol(headers, ["asistencia", "asistio", "asistió"]),
    pagoCol:       findCol(headers, ["pago", "matricula", "monto"]),
    condicionCol:  findCol(headers, ["condicion", "condición", "resultado", "ingreso"]),
    modalidadCol:  headers.find(h => norm(h).includes("modalidad") && norm(h).includes("estudio"))
                   ?? headers.find(h => norm(h).includes("modalidad") && !norm(h).includes("ingreso"))
                   ?? "",
    turnoCol:      findCol(headers, ["turno"]),
    sedeCol:       findCol(headers, ["sede", "filial", "local"]),
  };
}

/* ── File state ──────────────────────────────────────────── */
type FileState = {
  name: string;
  headers: string[];
  rows: AnyRow[];
  cols: Partial<ColMap>;
};

/* ── Result row ──────────────────────────────────────────── */
type ResultRow = {
  codigo: string;
  inA: boolean;
  inB: boolean;
  apellidosNombres: string;
  dni: string;
  programa: string;
  asistencia: string;
  pago: string;
  pagado: boolean;
  condicion: string;
  modalidad: string;
  turno: string;
  sede: string;
  dataA: AnyRow | null;
  dataB: AnyRow | null;
};

function buildRow(codigo: string, dataA: AnyRow | null, dataB: AnyRow | null,
                  colsA: Partial<ColMap>, colsB: Partial<ColMap>): ResultRow {
  // Name: prefer B (has full nombres/apellidos), fallback A
  const get = (row: AnyRow | null, col?: string) => col && row ? (row[col] ?? "") : "";
  const apellidos = get(dataB, colsB.apellidosCol) || get(dataA, colsA.apellidosCol);
  const nombres   = get(dataB, colsB.nombresCol)   || get(dataA, colsA.nombresCol);
  const apellidosNombres = apellidos && nombres ? `${apellidos} ${nombres}` : apellidos || nombres;

  const pago      = get(dataB, colsB.pagoCol);
  const pagoNum   = parseFloat(pago.replace(/[^0-9.]/g, "")) || 0;
  const pagado    = pago !== "" && pago.toUpperCase() !== "NO" && pagoNum > 0;

  return {
    codigo,
    inA: dataA !== null,
    inB: dataB !== null,
    apellidosNombres,
    dni:        get(dataB, colsB.dniCol)        || get(dataA, colsA.dniCol),
    programa:   get(dataB, colsB.programaCol),
    asistencia: get(dataB, colsB.asistenciaCol),
    pago,
    pagado,
    condicion:  get(dataB, colsB.condicionCol),
    modalidad:  get(dataB, colsB.modalidadCol)  || get(dataA, colsA.modalidadCol),
    turno:      get(dataA, colsA.turnoCol)       || get(dataB, colsB.turnoCol),
    sede:       get(dataA, colsA.sedeCol)        || get(dataB, colsB.sedeCol),
    dataA,
    dataB,
  };
}

/* ── Upload card ─────────────────────────────────────────── */
function UploadCard({ id, badge, hint, fileState, onLoad, onClear }: {
  id: "a" | "b";
  badge: string;
  hint: string;
  fileState: FileState | null;
  onLoad: (s: FileState) => void;
  onClear: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const color = id === "a" ? "#1d4ed8" : "#7c3aed";

  async function handleFile(file: File) {
    try {
      const rows = await readExcel(file);
      if (!rows.length) return;
      const headers = Object.keys(rows[0]);
      const cols = id === "a" ? detectColsA(headers) : detectColsB(headers);
      onLoad({ name: file.name, headers, rows, cols });
    } catch { alert("Error leyendo el archivo Excel."); }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, []);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="py-3 px-4 pb-2">
        <CardTitle className="text-xs font-bold flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-bold" style={{ background: color }}>{badge}</span>
          <span className="text-muted-foreground font-normal">{hint}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => ref.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${drag ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
        >
          <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          <FileSpreadsheet className="w-7 h-7 mx-auto mb-1.5 text-gray-300" />
          {fileState ? (
            <>
              <p className="text-xs font-semibold" style={{ color }}>{fileState.name}</p>
              <p className="text-[11px] text-muted-foreground">{fileState.rows.length} filas · haz clic para cambiar</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Arrastra tu Excel aquí o haz clic</p>
          )}
        </div>

        {fileState && (
          <>
            <div className="bg-gray-50 rounded-lg text-[10px] border overflow-hidden">
              <div className="px-3 py-1.5 bg-gray-100 font-semibold text-gray-500 grid grid-cols-2 gap-2">
                <span>Columnas detectadas</span><span>Columna Excel</span>
              </div>
              {Object.entries(id === "a"
                ? { Código: fileState.cols.keyCol, Modalidad: fileState.cols.modalidadCol, Turno: fileState.cols.turnoCol, Sede: fileState.cols.sedeCol }
                : { Código: fileState.cols.keyCol, Apellidos: fileState.cols.apellidosCol, Nombres: fileState.cols.nombresCol, Programa: fileState.cols.programaCol, Asistencia: fileState.cols.asistenciaCol, Pago: fileState.cols.pagoCol, Condición: fileState.cols.condicionCol }
              ).map(([label, col]) => (
                <div key={label} className="px-3 py-1 border-t border-gray-100 grid grid-cols-2 gap-2">
                  <span className="text-gray-500">{label}</span>
                  <span className={`font-semibold font-mono ${col ? "text-blue-700" : "text-red-400"}`}>{col || "—no detectado—"}</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
              <X className="w-3 h-3 mr-1" /> Quitar archivo
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function VerificacionData() {
  const { toast } = useToast();

  const [fileA, setFileA] = useState<FileState | null>(null);
  const [fileB, setFileB] = useState<FileState | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [filterMatch, setFilterMatch] = useState<"all" | "both" | "onlyA" | "onlyB">("both");
  const [filterAsist, setFilterAsist] = useState<"all" | "asistio" | "no_asistio">("all");
  const [filterPago, setFilterPago] = useState<"all" | "pago" | "no_pago">("all");
  const [search, setSearch] = useState("");

  /* ── Merge ──────────────────────────────────────────── */
  function merge() {
    if (!fileA || !fileB) return;
    const mapA = new Map<string, AnyRow>();
    fileA.rows.forEach(r => { const k = (r[fileA.cols.keyCol!] || "").toUpperCase().trim(); if (k) mapA.set(k, r); });
    const mapB = new Map<string, AnyRow>();
    fileB.rows.forEach(r => { const k = (r[fileB.cols.keyCol!] || "").toUpperCase().trim(); if (k) mapB.set(k, r); });

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
    const out: ResultRow[] = [];
    allKeys.forEach(codigo => {
      out.push(buildRow(codigo, mapA.get(codigo) ?? null, mapB.get(codigo) ?? null, fileA.cols, fileB.cols));
    });
    out.sort((a, b) => {
      const s = (r: ResultRow) => r.inA && r.inB ? 0 : r.inA ? 1 : 2;
      return s(a) - s(b) || a.apellidosNombres.localeCompare(b.apellidosNombres);
    });
    setResults(out);
    setFilterMatch("both");
    setFilterAsist("all");
    setFilterPago("all");
    const both = out.filter(r => r.inA && r.inB).length;
    toast({ title: "Cruce completado", description: `${both} códigos coinciden en ambos archivos` });
  }

  /* ── Filtered ────────────────────────────────────────── */
  const base = results ?? [];
  const filtered = base.filter(r => {
    if (filterMatch === "both"  && !(r.inA && r.inB))  return false;
    if (filterMatch === "onlyA" && !(r.inA && !r.inB)) return false;
    if (filterMatch === "onlyB" && !(!r.inA && r.inB)) return false;
    if (filterAsist === "asistio"    && norm(r.asistencia) !== "asistio" && norm(r.asistencia) !== "asistió") return false;
    if (filterAsist === "no_asistio" && norm(r.asistencia) !== "no asistio" && norm(r.asistencia) !== "no asistió") return false;
    if (filterPago === "pago"    && !r.pagado)  return false;
    if (filterPago === "no_pago" && r.pagado)   return false;
    const q = search.trim().toUpperCase();
    if (!q) return true;
    return r.codigo.includes(q) || r.apellidosNombres.toUpperCase().includes(q) || r.dni.includes(q) || r.programa.toUpperCase().includes(q);
  });

  const stats = results ? {
    total: base.length,
    both:  base.filter(r => r.inA && r.inB).length,
    onlyA: base.filter(r => r.inA && !r.inB).length,
    onlyB: base.filter(r => !r.inA && r.inB).length,
    asistio:   base.filter(r => r.inB && (norm(r.asistencia) === "asistio" || norm(r.asistencia) === "asistió")).length,
    noAsistio: base.filter(r => r.inB && (norm(r.asistencia) === "no asistio" || norm(r.asistencia) === "no asistió")).length,
    pago:    base.filter(r => r.pagado).length,
    noPago:  base.filter(r => r.inB && !r.pagado).length,
  } : null;

  /* ── Export Excel con encabezado UAI ────────────────── */
  async function exportXlsx() {
    const src = filtered;
    if (!src.length) return;

    // Load logo as base64
    let logoBase64 = "";
    try {
      const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
      const res = await fetch(`${base}/logo-uai.png`);
      const blob = await res.blob();
      logoBase64 = await new Promise<string>(resolve => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
        r.readAsDataURL(blob);
      });
    } catch { /* skip logo if not found */ }

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Portal Académico UAI";
    wb.created = new Date();

    const ws = wb.addWorksheet("Verificación de Data");
    ws.properties.defaultRowHeight = 16;

    // ── Column widths ────────────────────────────────
    ws.columns = [
      { width: 5  },   // N°
      { width: 14 },   // Código
      { width: 36 },   // Apellidos y Nombres
      { width: 13 },   // DNI
      { width: 30 },   // Programa/Carrera
      { width: 13 },   // Asistencia
      { width: 18 },   // Pago de Matrícula
      { width: 12 },   // ¿Pagó?
      { width: 18 },   // Condición
      { width: 18 },   // Modalidad de Estudio
      { width: 10 },   // Turno
      { width: 20 },   // Sede/Filial
    ];

    // ── Logo + header rows ───────────────────────────
    // Row 1: logo (tall row)
    ws.addRow([]);
    ws.getRow(1).height = 55;

    if (logoBase64) {
      const imgId = wb.addImage({ base64: logoBase64, extension: "png" });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 130, height: 65 } });
    }

    // Row 2: University name
    const r2 = ws.addRow(["UNIVERSIDAD AUTÓNOMA DE ICA"]);
    ws.mergeCells("A2:L2");
    const c2 = ws.getCell("A2");
    c2.font = { bold: true, size: 14, color: { argb: "FF001F5F" } };
    c2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 22;

    // Row 3: Subtitle
    const r3 = ws.addRow(["VERIFICACIÓN DE DATA — Resultado de Examen de Admisión"]);
    ws.mergeCells("A3:L3");
    const c3 = ws.getCell("A3");
    c3.font = { bold: true, size: 11, color: { argb: "FFC9A84C" } };
    c3.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(3).height = 18;

    // Row 4: Date + filter info
    const dateStr = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
    const asistText = filterAsist === "asistio" ? "Solo Asistió" : filterAsist === "no_asistio" ? "Solo No Asistió" : "Todos";
    const pagoText  = filterPago  === "pago"    ? "Solo Pagaron"  : filterPago  === "no_pago"   ? "Solo No Pagaron"  : "Todos";
    const r4 = ws.addRow([`Fecha de exportación: ${dateStr}   |   Filtro asistencia: ${asistText}   |   Filtro pago: ${pagoText}   |   Total registros: ${src.length}`]);
    ws.mergeCells("A4:L4");
    const c4 = ws.getCell("A4");
    c4.font = { size: 9, italic: true, color: { argb: "FF555555" } };
    c4.alignment = { horizontal: "center" };
    ws.getRow(4).height = 14;

    // Row 5: empty separator
    ws.addRow([]);
    ws.getRow(5).height = 6;

    // Row 6: Column headers
    const headers = ["N°", "Código Estudiante", "Apellidos y Nombres", "DNI",
      "Programa / Carrera", "Asistencia", "Pago de Matrícula", "¿Pagó?",
      "Condición", "Modalidad de Estudio", "Turno", "Sede / Filial"];
    const headerRow = ws.addRow(headers);
    headerRow.height = 20;
    headerRow.eachCell(cell => {
      cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top:    { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        left:   { style: "thin", color: { argb: "FF001F5F" } },
        right:  { style: "thin", color: { argb: "FF001F5F" } },
      };
    });

    // ── Data rows ────────────────────────────────────
    src.forEach((r, i) => {
      const pagoDisplay = r.pago ? (r.pagado ? `S/ ${r.pago}` : r.pago) : "—";
      const row = ws.addRow([
        i + 1,
        r.codigo,
        r.apellidosNombres,
        r.dni,
        r.programa,
        r.asistencia,
        pagoDisplay,
        r.pagado ? "SÍ" : (r.pago === "" ? "—" : "NO"),
        r.condicion,
        r.modalidad,
        r.turno,
        r.sede,
      ]);
      row.height = 15;

      const isOdd = i % 2 === 0;
      const baseFill = isOdd ? "FFF0F4FF" : "FFFFFFFF";

      row.eachCell((cell, colNum) => {
        cell.font = { size: 9 };
        cell.alignment = { vertical: "middle", wrapText: false };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseFill } };
        cell.border = {
          top:    { style: "hair", color: { argb: "FFD0D8E8" } },
          bottom: { style: "hair", color: { argb: "FFD0D8E8" } },
          left:   { style: "hair", color: { argb: "FFD0D8E8" } },
          right:  { style: "hair", color: { argb: "FFD0D8E8" } },
        };

        // Asistencia coloring (col 6)
        if (colNum === 6) {
          const v = norm(r.asistencia);
          if (v === "asistio" || v === "asistió") {
            cell.font = { size: 9, bold: true, color: { argb: "FF166534" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
          } else if (v === "no asistio" || v === "no asistió") {
            cell.font = { size: 9, bold: true, color: { argb: "FF991B1B" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          }
        }
        // Pagó coloring (col 8)
        if (colNum === 8) {
          if (r.pagado) {
            cell.font = { size: 9, bold: true, color: { argb: "FF166534" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
          } else if (r.pago !== "") {
            cell.font = { size: 9, bold: true, color: { argb: "FF991B1B" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          }
        }
        // Center N°, código, DNI, asistencia, pagó, turno
        if ([1, 2, 4, 6, 8, 11].includes(colNum)) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });
    });

    // ── Summary row ──────────────────────────────────
    ws.addRow([]);
    const sumRow = ws.addRow([
      "", "", "", "", "",
      `Asistió: ${src.filter(r => norm(r.asistencia) === "asistio" || norm(r.asistencia) === "asistió").length}`,
      "", `Pagaron: ${src.filter(r => r.pagado).length}  /  No pagaron: ${src.filter(r => r.inB && !r.pagado).length}`,
    ]);
    sumRow.height = 16;
    sumRow.eachCell(cell => {
      cell.font = { bold: true, size: 9, color: { argb: "FF001F5F" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
    });

    // ── Footer ───────────────────────────────────────
    ws.addRow([]);
    const footRow = ws.addRow(["Portal Académico · Universidad Autónoma de Ica · 2026"]);
    ws.mergeCells(`A${footRow.number}:L${footRow.number}`);
    const fc = ws.getCell(`A${footRow.number}`);
    fc.font = { size: 8, italic: true, color: { argb: "FF888888" } };
    fc.alignment = { horizontal: "center" };

    // ── Write file ───────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `UAI-Verificacion-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Excel exportado con éxito" });
  }

  /* ── UI ──────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-5 p-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Verificación de Data</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cruza dos Excels por código de estudiante · detecta cuáles se repiten · filtra por asistencia y pago
          </p>
        </div>
        {results && filtered.length > 0 && (
          <Button size="sm" onClick={exportXlsx} style={{ background: NAVY, color: "#fff" }}>
            <Download className="w-4 h-4 mr-1.5" /> Exportar Excel UAI
          </Button>
        )}
      </div>

      {/* Upload */}
      <div className="grid md:grid-cols-2 gap-4">
        <UploadCard id="a" badge="Archivo A" hint="DATA · con turno, modalidad, sede…"
          fileState={fileA}
          onLoad={setFileA}
          onClear={() => { setFileA(null); setResults(null); }} />
        <UploadCard id="b" badge="Archivo B" hint="Resultado examen · con pago, carrera, asistencia…"
          fileState={fileB}
          onLoad={setFileB}
          onClear={() => { setFileB(null); setResults(null); }} />
      </div>

      {/* Action */}
      {fileA && fileB && (
        <div className="flex items-center gap-3">
          <Button onClick={merge} style={{ background: NAVY, color: "#fff" }} className="gap-2">
            <Merge className="w-4 h-4" />
            Cruzar Archivos ({fileA.rows.length} + {fileB.rows.length})
          </Button>
          {results && (
            <Button variant="outline" size="sm" onClick={() => { setResults(null); setSearch(""); }}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Nuevo cruce
            </Button>
          )}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: "both" as const,  label: "Se repiten (ambos)",   value: stats.both,      color: "#16a34a", bg: "bg-green-50",    Icon: CheckCircle2 },
            { key: "onlyA" as const, label: "Solo en Archivo A",    value: stats.onlyA,     color: "#2563eb", bg: "bg-blue-50",     Icon: FileSpreadsheet },
            { key: "onlyB" as const, label: "Solo en Archivo B",    value: stats.onlyB,     color: "#7c3aed", bg: "bg-purple-50",   Icon: FileSpreadsheet },
            { key: "all" as const,   label: "Total códigos únicos", value: stats.total,     color: NAVY,      bg: "bg-slate-50",    Icon: Users },
          ].map(({ key, label, value, color, bg, Icon }) => (
            <Card key={key} className={`rounded-xl shadow-sm cursor-pointer transition-all ${filterMatch === key ? "ring-2 ring-offset-1" : "hover:shadow-md"}`}
              style={filterMatch === key ? { outline: `2px solid ${color}` } : {}}
              onClick={() => setFilterMatch(key)}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-full p-2.5 ${bg}`}><Icon className="w-5 h-5" style={{ color }} /></div>
                <div>
                  <p className="text-xl font-bold" style={{ color }}>{value}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      {results && (
        <div className="flex flex-wrap gap-3 items-center">
          {/* Asistencia filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground mr-1">Asistencia:</span>
            {([
              { key: "all"       as const, label: "Todos",       count: stats!.asistio + stats!.noAsistio, Icon: Users,      color: "gray" },
              { key: "asistio"   as const, label: "Asistió",     count: stats!.asistio,                    Icon: UserCheck,  color: "green" },
              { key: "no_asistio"as const, label: "No Asistió",  count: stats!.noAsistio,                  Icon: UserX,      color: "red" },
            ] as const).map(({ key, label, count, Icon, color }) => (
              <button key={key} onClick={() => setFilterAsist(key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  filterAsist === key
                    ? color === "green" ? "bg-green-600 text-white border-green-600"
                    : color === "red"   ? "bg-red-600 text-white border-red-600"
                    :                    "text-white border-gray-700" : "bg-white border-gray-200 hover:border-gray-400 text-gray-600"
                }`}
                style={filterAsist === key && color === "gray" ? { background: NAVY, borderColor: NAVY } : {}}
              >
                <Icon className="w-3 h-3" /> {label} <span className="opacity-70">({count})</span>
              </button>
            ))}
          </div>

          {/* Pago filter */}
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Pago:</span>
            {([
              { key: "all"    as const, label: "Todos",       count: stats!.pago + stats!.noPago, color: "gray" },
              { key: "pago"   as const, label: "Sí pagó",     count: stats!.pago,                 color: "green" },
              { key: "no_pago"as const, label: "No pagó",     count: stats!.noPago,               color: "red" },
            ] as const).map(({ key, label, count, color }) => (
              <button key={key} onClick={() => setFilterPago(key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  filterPago === key
                    ? color === "green" ? "bg-green-600 text-white border-green-600"
                    : color === "red"   ? "bg-red-600 text-white border-red-600"
                    :                    "text-white border-gray-700"
                    : "bg-white border-gray-200 hover:border-gray-400 text-gray-600"
                }`}
                style={filterPago === key && color === "gray" ? { background: NAVY, borderColor: NAVY } : {}}
              >
                {label} <span className="opacity-70">({count})</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar código, nombre, DNI, carrera…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs w-64" />
            {search && <button className="absolute right-2 top-2" onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
        </div>
      )}

      {/* Table */}
      {results && (
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr style={{ background: NAVY }} className="text-white text-left">
                  {[
                    "#", "Código Estudiante", "Apellidos y Nombres", "DNI",
                    "Programa / Carrera", "Asistencia", "Pago Matrícula",
                    "¿Pagó?", "Condición", "Modalidad", "Turno", "Sede"
                  ].map((h, i) => (
                    <th key={i} className="px-3 py-3 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-muted-foreground">Sin resultados con los filtros actuales</td>
                  </tr>
                ) : filtered.map((r, i) => {
                  const isAsistio   = norm(r.asistencia) === "asistio" || norm(r.asistencia) === "asistió";
                  const isNoAsistio = norm(r.asistencia) === "no asistio" || norm(r.asistencia) === "no asistió";
                  const rowBg = i % 2 === 0 ? "bg-gray-50/40" : "bg-white";
                  return (
                    <tr key={`${r.codigo}-${i}`} className={`border-b border-gray-100 ${rowBg} hover:bg-blue-50/30`}>
                      <td className="px-3 py-2.5 text-muted-foreground text-center">{i + 1}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-center" style={{ color: NAVY }}>{r.codigo}</td>
                      <td className="px-3 py-2.5 font-medium max-w-[200px]">
                        <span title={r.apellidosNombres}>{r.apellidosNombres || <span className="text-gray-300 italic">—</span>}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-center">{r.dni || "—"}</td>
                      <td className="px-3 py-2.5 max-w-[180px]" title={r.programa}>{r.programa || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        {isAsistio ? (
                          <Badge className="text-[10px] px-1.5 bg-green-100 text-green-700 border border-green-200">
                            <UserCheck className="w-2.5 h-2.5 mr-0.5" /> Asistió
                          </Badge>
                        ) : isNoAsistio ? (
                          <Badge className="text-[10px] px-1.5 bg-red-100 text-red-600 border border-red-200">
                            <UserX className="w-2.5 h-2.5 mr-0.5" /> No Asistió
                          </Badge>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        {r.pago ? (r.pagado ? <span className="text-green-700 font-bold">S/ {r.pago}</span> : <span className="text-gray-400">{r.pago}</span>) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.pago === "" ? <span className="text-gray-300">—</span>
                          : r.pagado
                          ? <Badge className="text-[10px] px-1.5 bg-green-100 text-green-700 border border-green-200"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> SÍ</Badge>
                          : <Badge className="text-[10px] px-1.5 bg-red-100 text-red-600 border border-red-200"><XCircle className="w-2.5 h-2.5 mr-0.5" /> NO</Badge>}
                      </td>
                      <td className="px-3 py-2.5">{r.condicion || "—"}</td>
                      <td className="px-3 py-2.5">{r.modalidad || "—"}</td>
                      <td className="px-3 py-2.5 text-center">{r.turno || "—"}</td>
                      <td className="px-3 py-2.5">{r.sede || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t bg-gray-50 text-xs text-muted-foreground">
              <span>{filtered.filter(r => norm(r.asistencia) === "asistio" || norm(r.asistencia) === "asistió").length} asistieron · {filtered.filter(r => norm(r.asistencia) === "no asistio" || norm(r.asistencia) === "no asistió").length} no asistieron</span>
              <span>{filtered.filter(r => r.pagado).length} pagaron · {filtered.filter(r => r.inB && !r.pagado).length} no pagaron</span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportXlsx}>
                <Download className="w-3.5 h-3.5" /> Exportar ({filtered.length})
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Empty state */}
      {!fileA && !fileB && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Merge className="w-14 h-14 text-gray-200 mb-3" />
          <p className="text-base font-semibold text-muted-foreground">Sube dos Excels para cruzarlos</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            <strong>Archivo A</strong>: DATA (con turno, modalidad, sede)<br />
            <strong>Archivo B</strong>: resultado examen (con pago, carrera, asistencia, condición)<br />
            Filtra por <strong>Asistió / No Asistió</strong> y por <strong>Si pagó / No pagó</strong>
          </p>
        </div>
      )}
    </div>
  );
}
