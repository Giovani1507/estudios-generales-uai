import React, { useState, useRef, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Download,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  X,
  Database,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";

/* ── Types ─────────────────────────────────────────────────── */
type Ingresante = {
  id: number;
  dni: string;
  apellidosNombres: string;
  codigoEstudiante: string | null;
  carrera: string | null;
  sede: string | null;
  modalidadIngreso: string | null;
  modalidadEstudio: string | null;
  turno: string | null;
  seccion: string | null;
  celular: string | null;
  correo: string | null;
};

type ExcelRow = {
  codigo: string;
  modalidad: string;
  turno: string;
};

type VerifiedRow = Ingresante & {
  excelModalidad: string | null;
  excelTurno: string | null;
  enExcel: boolean;
  modalidadMatch: boolean | null;
  turnoMatch: boolean | null;
};

/* ── Detect columns in uploaded Excel ──────────────────────── */
function detectExcelCols(headers: string[]) {
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const codeKw     = ["codigo", "code", "cod", "estudiante", "alumno", "usuario", "matricula"];
  const modalKw    = ["modalidad", "modal", "estudio", "tipo"];
  const turnoKw    = ["turno", "turn", "horario", "jornada"];

  const codeCol  = headers.find(h => codeKw.some(k  => n(h).includes(k)))  ?? headers[0] ?? "";
  const modalCol = headers.find(h => modalKw.some(k => n(h).includes(k)))  ?? headers[1] ?? "";
  const turnoCol = headers.find(h => turnoKw.some(k => n(h).includes(k)))  ?? headers[2] ?? "";
  return { codeCol, modalCol, turnoCol };
}

/* ── Component ─────────────────────────────────────────────── */
export default function VerificacionData() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [ingresantes, setIngresantes] = useState<Ingresante[]>([]);
  const [loadingMain, setLoadingMain] = useState(false);
  const [mainLoaded, setMainLoaded]   = useState(false);

  const [dragging, setDragging]       = useState(false);
  const [fileName, setFileName]       = useState("");
  const [allHeaders, setAllHeaders]   = useState<string[]>([]);
  const [codeCol, setCodeCol]         = useState("");
  const [modalCol, setModalCol]       = useState("");
  const [turnoCol, setTurnoCol]       = useState("");
  const [excelRows, setExcelRows]     = useState<ExcelRow[]>([]);
  const [verified, setVerified]       = useState<VerifiedRow[] | null>(null);
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState<"all"|"match"|"mismatch"|"noexcel">("all");

  /* Load main data */
  async function loadMainData() {
    setLoadingMain(true);
    try {
      const r = await fetch(`${apiBase}/api/students/ingresantes`, { credentials: "include" });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const data: Ingresante[] = await r.json();
      setIngresantes(data);
      setMainLoaded(true);
      setVerified(null);
      toast({ title: `Data principal cargada: ${data.length} ingresantes` });
    } catch (e) {
      toast({ title: "Error al cargar la data principal", description: String(e), variant: "destructive" });
    } finally {
      setLoadingMain(false);
    }
  }

  /* Parse uploaded Excel */
  function parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        if (json.length === 0) { toast({ title: "Archivo vacío", variant: "destructive" }); return; }

        const headers = Object.keys(json[0]);
        const { codeCol: dc, modalCol: dm, turnoCol: dt } = detectExcelCols(headers);

        setAllHeaders(headers);
        setCodeCol(dc); setModalCol(dm); setTurnoCol(dt);
        buildExcelRows(json, dc, dm, dt);
        setFileName(file.name);
        setVerified(null);
        toast({ title: `Excel cargado: ${json.length} filas` });
      } catch (err) {
        toast({ title: "Error al leer Excel", description: String(err), variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function buildExcelRows(json: Record<string, string>[], cc: string, mc: string, tc: string) {
    setExcelRows(json.map(r => ({
      codigo:   String(r[cc] ?? "").trim().toUpperCase(),
      modalidad: String(r[mc] ?? "").trim(),
      turno:    String(r[tc] ?? "").trim(),
    })));
  }

  function remapCols(cc: string, mc: string, tc: string) {
    setCodeCol(cc); setModalCol(mc); setTurnoCol(tc);
    setVerified(null);
    // Re-parse with new cols from last json — we need to re-read; just update cols and let user click verify
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) parseExcel(f);
  }, []);

  /* Run verification */
  function runVerification() {
    if (!mainLoaded || excelRows.length === 0) return;
    const map = new Map<string, ExcelRow>();
    for (const row of excelRows) {
      if (row.codigo) map.set(row.codigo, row);
    }

    const result: VerifiedRow[] = ingresantes.map(ing => {
      const code  = (ing.codigoEstudiante ?? "").toUpperCase();
      const match = map.get(code) ?? null;
      return {
        ...ing,
        enExcel:       match !== null,
        excelModalidad: match?.modalidad ?? null,
        excelTurno:     match?.turno     ?? null,
        modalidadMatch: match ? match.modalidad.toLowerCase() === (ing.modalidadEstudio ?? "").toLowerCase() : null,
        turnoMatch:     match ? match.turno.toLowerCase()     === (ing.turno ?? "").toLowerCase()            : null,
      };
    });

    setVerified(result);
    const found    = result.filter(r => r.enExcel).length;
    const notFound = result.length - found;
    toast({ title: "Verificación completa", description: `${found} coincidencias, ${notFound} sin datos en Excel` });
  }

  /* Filtered rows */
  const displayRows = useMemo(() => {
    const base = verified ?? ingresantes.map(ing => ({
      ...ing, enExcel: false, excelModalidad: null, excelTurno: null, modalidadMatch: null, turnoMatch: null,
    }));

    let out = base;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(r =>
        (r.apellidosNombres ?? "").toLowerCase().includes(q) ||
        (r.dni ?? "").includes(q) ||
        (r.codigoEstudiante ?? "").toLowerCase().includes(q) ||
        (r.carrera ?? "").toLowerCase().includes(q)
      );
    }
    if (verified) {
      if (filterStatus === "match")    out = out.filter(r => r.enExcel && r.modalidadMatch !== false && r.turnoMatch !== false);
      if (filterStatus === "mismatch") out = out.filter(r => r.enExcel && (r.modalidadMatch === false || r.turnoMatch === false));
      if (filterStatus === "noexcel")  out = out.filter(r => !r.enExcel);
    }
    return out;
  }, [verified, ingresantes, search, filterStatus]);

  /* Stats */
  const stats = useMemo(() => {
    if (!verified) return null;
    const inExcel  = verified.filter(r => r.enExcel).length;
    const fullMatch = verified.filter(r => r.enExcel && r.modalidadMatch !== false && r.turnoMatch !== false).length;
    const mismatch  = verified.filter(r => r.enExcel && (r.modalidadMatch === false || r.turnoMatch === false)).length;
    const noExcel   = verified.filter(r => !r.enExcel).length;
    return { inExcel, fullMatch, mismatch, noExcel };
  }, [verified]);

  /* Export */
  function exportResult() {
    const src = verified ?? ingresantes.map(ing => ({ ...ing, enExcel: false, excelModalidad: null, excelTurno: null, modalidadMatch: null, turnoMatch: null }));
    const header = [
      "Código Estudiante", "Apellidos y Nombres", "DNI", "Carrera", "Sede",
      "Modalidad Estudio (Sistema)", "Turno (Sistema)", "Sección",
      ...(verified ? ["Modalidad Estudio (Excel)", "Turno (Excel)", "Estado"] : []),
    ];
    const rows = src.map(r => [
      r.codigoEstudiante ?? "",
      r.apellidosNombres,
      r.dni,
      r.carrera ?? "",
      r.sede ?? "",
      r.modalidadEstudio ?? "",
      r.turno ?? "",
      r.seccion ?? "",
      ...(verified ? [
        r.excelModalidad ?? "",
        r.excelTurno ?? "",
        !r.enExcel ? "SIN DATOS EN EXCEL" :
          (r.modalidadMatch !== false && r.turnoMatch !== false) ? "COINCIDE" : "DIFIERE",
      ] : []),
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, "Verificación");
    XLSX.writeFile(wb, `verificacion-data-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const hasMain  = mainLoaded && ingresantes.length > 0;
  const hasExcel = excelRows.length > 0;

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Verificación de Data</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Data principal de ingresantes con verificación cruzada de modalidad y turno
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadMainData} disabled={loadingMain}>
            <Database className={`w-4 h-4 mr-1.5 ${loadingMain ? "animate-spin" : ""}`} />
            {hasMain ? "Recargar data principal" : "Cargar data principal"}
          </Button>
          {hasMain && (
            <Button size="sm" onClick={exportResult} variant="outline">
              <Download className="w-4 h-4 mr-1.5" />
              Descargar Excel
            </Button>
          )}
        </div>
      </div>

      {/* Step 1: Load main data — shown only if not loaded yet */}
      {!hasMain && (
        <Card className="rounded-xl shadow-sm border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <Database className="w-12 h-12 text-gray-200" />
            <div>
              <p className="font-semibold text-sm" style={{ color: NAVY }}>Carga la data principal para comenzar</p>
              <p className="text-xs text-muted-foreground mt-1">
                Muestra todos los {2289} ingresantes 2026-I con sus datos del sistema
              </p>
            </div>
            <Button onClick={loadMainData} disabled={loadingMain} style={{ background: NAVY, color: "#fff" }}>
              {loadingMain ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Database className="w-4 h-4 mr-1.5" />}
              {loadingMain ? "Cargando..." : "Cargar data principal"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload Excel (only when main data is loaded) */}
      {hasMain && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: NAVY }}>
              <Upload className="w-4 h-4" />
              Subir Excel para verificación
              <span className="text-xs font-normal text-muted-foreground ml-1">
                (Excel debe tener: Código de estudiante · Modalidad de estudio · Turno)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex gap-4 flex-wrap items-start">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex-1 min-w-[200px] border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  dragging ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/40 hover:bg-gray-50"
                }`}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) parseExcel(f); e.target.value = ""; }} />
                <FileSpreadsheet className="w-7 h-7 mx-auto mb-2 text-gray-300" />
                {fileName
                  ? <p className="text-sm font-semibold" style={{ color: NAVY }}>{fileName}<br /><span className="text-xs text-muted-foreground font-normal">{excelRows.length} filas — haz clic para cambiar</span></p>
                  : <p className="text-sm text-muted-foreground">Arrastra o haz clic para subir el Excel</p>}
              </div>

              {/* Column mapping */}
              {hasExcel && (
                <div className="flex gap-3 flex-wrap flex-1 min-w-[300px]">
                  {[
                    { label: "Código estudiante", val: codeCol, set: (v: string) => remapCols(v, modalCol, turnoCol) },
                    { label: "Modalidad de estudio", val: modalCol, set: (v: string) => remapCols(codeCol, v, turnoCol) },
                    { label: "Turno", val: turnoCol, set: (v: string) => remapCols(codeCol, modalCol, v) },
                  ].map(({ label, val, set }) => (
                    <div key={label} className="flex-1 min-w-[140px] space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
                      <select className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={val} onChange={e => set(e.target.value)}>
                        {allHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Verify button */}
            {hasExcel && (
              <div className="mt-3 flex items-center gap-2">
                <Button onClick={runVerification} style={{ background: NAVY, color: "#fff" }} size="sm">
                  <ArrowRight className="w-4 h-4 mr-1.5" />
                  Verificar {excelRows.length} filas contra data principal
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  setExcelRows([]); setFileName(""); setVerified(null);
                  setAllHeaders([]); setCodeCol(""); setModalCol(""); setTurnoCol("");
                }}>
                  <X className="w-3.5 h-3.5 mr-1" /> Quitar Excel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats (post-verification) */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "En Excel",         value: stats.inExcel,   color: "#2563eb", bg: "bg-blue-50" },
            { label: "Coinciden",         value: stats.fullMatch, color: "#16a34a", bg: "bg-green-50" },
            { label: "Difieren",          value: stats.mismatch,  color: "#dc2626", bg: "bg-red-50" },
            { label: "Sin datos en Excel",value: stats.noExcel,   color: "#92400e", bg: "bg-amber-50" },
          ].map(s => (
            <Card key={s.label} className="rounded-xl shadow-sm cursor-pointer" onClick={() => {
              setFilterStatus(
                s.label === "En Excel" ? "all" :
                s.label === "Coinciden" ? "match" :
                s.label === "Difieren" ? "mismatch" : "noexcel"
              );
            }}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-full p-2 ${s.bg}`}>
                  {s.label === "Coinciden" ? <CheckCircle2 className="w-5 h-5" style={{ color: s.color }} /> :
                   s.label === "Difieren"   ? <AlertCircle   className="w-5 h-5" style={{ color: s.color }} /> :
                   s.label === "Sin datos en Excel" ? <XCircle className="w-5 h-5" style={{ color: s.color }} /> :
                   <FileSpreadsheet className="w-5 h-5" style={{ color: s.color }} />}
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main table */}
      {hasMain && (
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b bg-gray-50/50 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar nombre, DNI, código, carrera..."
                value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            {verified && (
              <div className="flex gap-1 flex-wrap">
                {(["all","match","mismatch","noexcel"] as const).map(f => (
                  <Button key={f} size="sm" variant={filterStatus === f ? "default" : "outline"}
                    style={filterStatus === f ? { background: NAVY } : {}}
                    className="h-7 text-xs px-3"
                    onClick={() => setFilterStatus(f)}>
                    {f === "all" ? "Todos" : f === "match" ? "Coinciden" : f === "mismatch" ? "Difieren" : "Sin Excel"}
                  </Button>
                ))}
              </div>
            )}
            {search && <Button variant="ghost" size="sm" className="h-7" onClick={() => setSearch("")}><X className="w-3 h-3" /></Button>}
            <p className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
              {displayRows.length.toLocaleString()} de {ingresantes.length.toLocaleString()} registros
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: NAVY }} className="text-white">
                  <th className="px-3 py-3 text-left font-semibold w-6">#</th>
                  <th className="px-3 py-3 text-left font-semibold">Código</th>
                  <th className="px-3 py-3 text-left font-semibold">Apellidos y Nombres</th>
                  <th className="px-3 py-3 text-left font-semibold">DNI</th>
                  <th className="px-3 py-3 text-left font-semibold">Carrera</th>
                  <th className="px-3 py-3 text-left font-semibold">Sede</th>
                  <th className="px-3 py-3 text-left font-semibold">Modalidad (Sistema)</th>
                  <th className="px-3 py-3 text-left font-semibold">Turno (Sistema)</th>
                  <th className="px-3 py-3 text-left font-semibold">Sección</th>
                  {verified && <>
                    <th className="px-3 py-3 text-left font-semibold" style={{ background: "#1e3a8a" }}>Modalidad (Excel)</th>
                    <th className="px-3 py-3 text-left font-semibold" style={{ background: "#1e3a8a" }}>Turno (Excel)</th>
                    <th className="px-3 py-3 text-center font-semibold" style={{ background: "#1e3a8a" }}>Estado</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr><td colSpan={verified ? 12 : 9} className="text-center py-12 text-muted-foreground">Sin resultados</td></tr>
                ) : displayRows.slice(0, 200).map((r, i) => {
                  const rowBg = r.enExcel && (r.modalidadMatch === false || r.turnoMatch === false)
                    ? "bg-red-50/40"
                    : r.enExcel && r.modalidadMatch !== false && r.turnoMatch !== false
                    ? "bg-green-50/30"
                    : "";
                  return (
                    <tr key={r.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${rowBg}`}>
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-mono font-semibold" style={{ color: NAVY }}>{r.codigoEstudiante ?? "—"}</td>
                      <td className="px-3 py-2 font-medium max-w-[200px] truncate" title={r.apellidosNombres}>{r.apellidosNombres}</td>
                      <td className="px-3 py-2 font-mono">{r.dni}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate" title={r.carrera ?? ""}>{r.carrera ?? "—"}</td>
                      <td className="px-3 py-2">{r.sede ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={r.modalidadMatch === false ? "text-red-600 font-semibold" : ""}>{r.modalidadEstudio ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={r.turnoMatch === false ? "text-red-600 font-semibold" : ""}>{r.turno ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2">{r.seccion ?? "—"}</td>
                      {verified && <>
                        <td className="px-3 py-2">
                          {r.excelModalidad !== null ? (
                            <span className={`${r.modalidadMatch === false ? "text-red-600 font-semibold" : "text-green-700"}`}>
                              {r.excelModalidad || "—"}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {r.excelTurno !== null ? (
                            <span className={`${r.turnoMatch === false ? "text-red-600 font-semibold" : "text-green-700"}`}>
                              {r.excelTurno || "—"}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {!r.enExcel ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-gray-400">Sin datos</Badge>
                          ) : r.modalidadMatch !== false && r.turnoMatch !== false ? (
                            <Badge className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 border border-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" /> Coincide
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 border border-red-200">
                              <AlertCircle className="w-3 h-3 mr-0.5" /> Difiere
                            </Badge>
                          )}
                        </td>
                      </>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {displayRows.length > 200 && (
              <p className="text-center text-xs text-muted-foreground py-3 border-t bg-gray-50/50">
                Mostrando 200 de {displayRows.length} filas. Usa el buscador para filtrar o descarga el Excel para ver todos.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
