import React, { useState, useRef, useCallback } from "react";
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
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";

type ExcelRow  = { codigo: string; modalidad: string; turno: string };
type SysRow    = {
  codigoEstudiante: string | null;
  apellidosNombres: string;
  dni: string;
  carrera: string | null;
  sede: string | null;
  modalidadEstudio: string | null;
  turno: string | null;
  seccion: string | null;
  celular: string | null;
  correo: string | null;
};

type ResultRow = ExcelRow & {
  found: boolean;
  sys: SysRow | null;
  modalidadMatch: boolean | null;
  turnoMatch: boolean | null;
};

function normStr(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function detectCols(headers: string[]) {
  const n = normStr;
  const codeKw  = ["codigo", "code", "cod", "estudiante", "alumno", "usuario", "matricula"];
  const turnoKw = ["turno", "turn", "horario", "jornada"];

  const codeCol  = headers.find(h => codeKw.some(k  => n(h).includes(k)))  ?? headers[0] ?? "";
  const turnoCol = headers.find(h => turnoKw.some(k => n(h).includes(k)))  ?? "";

  // Prefer "modalidad de estudio" / "modalidad estudio" over "modalidad de ingreso"
  const modalCol =
    headers.find(h => n(h).includes("modalidad") && n(h).includes("estudio")) ??
    headers.find(h => n(h).includes("modalidad") && !n(h).includes("ingreso")) ??
    headers.find(h => n(h).includes("modalidad")) ??
    "";

  return { codeCol, modalCol, turnoCol };
}

export default function VerificacionData() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging]     = useState(false);
  const [fileName, setFileName]     = useState("");
  const [allHeaders, setAllHeaders] = useState<string[]>([]);
  const [codeCol, setCodeCol]       = useState("");
  const [modalCol, setModalCol]     = useState("");
  const [turnoCol, setTurnoCol]     = useState("");
  const [rawJson, setRawJson]       = useState<Record<string, string>[]>([]);
  const [excelRows, setExcelRows]   = useState<ExcelRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [results, setResults]       = useState<ResultRow[] | null>(null);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState<"all"|"match"|"diff"|"notfound">("all");

  /* ── Parse uploaded Excel ─────────────────────────────────── */
  function buildRows(json: Record<string,string>[], cc: string, mc: string, tc: string): ExcelRow[] {
    return json.map(r => ({
      codigo:   String(r[cc] ?? "").trim().toUpperCase(),
      modalidad: String(r[mc] ?? "").trim(),
      turno:    String(r[tc] ?? "").trim(),
    })).filter(r => r.codigo);
  }

  function parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        if (!json.length) { toast({ title: "Archivo vacío", variant: "destructive" }); return; }

        const headers = Object.keys(json[0]);
        const { codeCol: cc, modalCol: mc, turnoCol: tc } = detectCols(headers);
        const rows = buildRows(json, cc, mc, tc);

        setAllHeaders(headers); setCodeCol(cc); setModalCol(mc); setTurnoCol(tc);
        setRawJson(json); setExcelRows(rows);
        setFileName(file.name); setResults(null);
        toast({ title: `Excel cargado — ${rows.length} códigos listos para verificar` });
      } catch (err) {
        toast({ title: "Error al leer Excel", description: String(err), variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) parseExcel(f);
  }, []);

  function remapCols(cc: string, mc: string, tc: string) {
    setCodeCol(cc); setModalCol(mc); setTurnoCol(tc);
    setExcelRows(buildRows(rawJson, cc, mc, tc));
    setResults(null);
  }

  /* ── Verify against system ────────────────────────────────── */
  async function verify() {
    if (!excelRows.length) return;
    setLoading(true);
    try {
      const codigos = [...new Set(excelRows.map(r => r.codigo))];
      const r = await fetch(`${apiBase}/api/students/lookup-codes`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigos }),
      });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const { found }: { found: SysRow[] } = await r.json();
      const sysMap = new Map(found.map(s => [(s.codigoEstudiante ?? "").toUpperCase(), s]));

      const out: ResultRow[] = excelRows.map(row => {
        const sys = sysMap.get(row.codigo) ?? null;
        return {
          ...row,
          found: sys !== null,
          sys,
          modalidadMatch: sys ? normStr(row.modalidad) === normStr(sys.modalidadEstudio) : null,
          turnoMatch:     sys ? normStr(row.turno)     === normStr(sys.turno)            : null,
        };
      });

      setResults(out); setFilter("all");
      const ok  = out.filter(r => r.found && r.modalidadMatch !== false && r.turnoMatch !== false).length;
      const diff = out.filter(r => r.found && (r.modalidadMatch === false || r.turnoMatch === false)).length;
      const nf  = out.filter(r => !r.found).length;
      toast({ title: `Verificación completa`, description: `${ok} coinciden · ${diff} difieren · ${nf} no encontrados` });
    } catch (err) {
      toast({ title: "Error al verificar", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  /* ── Filtered display ─────────────────────────────────────── */
  const base = results ?? [];
  const filtered = base.filter(r => {
    const q = search.trim().toLowerCase();
    if (q && !r.codigo.toLowerCase().includes(q)
          && !(r.sys?.apellidosNombres ?? "").toLowerCase().includes(q)
          && !(r.sys?.dni ?? "").includes(q)) return false;
    if (filter === "match"    && !(r.found && r.modalidadMatch !== false && r.turnoMatch !== false)) return false;
    if (filter === "diff"     && !(r.found && (r.modalidadMatch === false || r.turnoMatch === false))) return false;
    if (filter === "notfound" && r.found) return false;
    return true;
  });

  const stats = results ? {
    total:    results.length,
    match:    results.filter(r => r.found && r.modalidadMatch !== false && r.turnoMatch !== false).length,
    diff:     results.filter(r => r.found && (r.modalidadMatch === false || r.turnoMatch === false)).length,
    notFound: results.filter(r => !r.found).length,
  } : null;

  /* ── Export ───────────────────────────────────────────────── */
  function exportXlsx() {
    const src = results ?? excelRows.map(r => ({ ...r, found: false, sys: null, modalidadMatch: null, turnoMatch: null }));
    const hdr = ["Código", "Modalidad (Excel)", "Turno (Excel)",
                 "Apellidos y Nombres", "DNI", "Carrera", "Sede",
                 "Modalidad (Sistema)", "Turno (Sistema)", "Sección", "Estado"];
    const rows = src.map(r => [
      r.codigo, r.modalidad, r.turno,
      r.sys?.apellidosNombres ?? "",
      r.sys?.dni ?? "",
      r.sys?.carrera ?? "",
      r.sys?.sede ?? "",
      r.sys?.modalidadEstudio ?? "",
      r.sys?.turno ?? "",
      r.sys?.seccion ?? "",
      !r.found ? "NO ENCONTRADO"
        : (r.modalidadMatch !== false && r.turnoMatch !== false) ? "COINCIDE" : "DIFIERE",
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
    ws["!cols"] = hdr.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, "Verificación");
    XLSX.writeFile(wb, `verificacion-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-5 p-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Verificación de Data</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sube tu Excel con códigos de estudiante · modalidad · turno y verifica contra el sistema
          </p>
        </div>
        {results && (
          <Button size="sm" onClick={exportXlsx} style={{ background: NAVY, color: "#fff" }}>
            <Download className="w-4 h-4 mr-1.5" /> Descargar Excel
          </Button>
        )}
      </div>

      {/* Upload Card */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: NAVY }}>
            <Upload className="w-4 h-4" /> Subir Excel
            <span className="text-xs font-normal text-muted-foreground">
              — columnas requeridas: Código de estudiante · Modalidad de estudio · Turno
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragging ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/40 hover:bg-gray-50"
            }`}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) parseExcel(f); e.target.value = ""; }} />
            <FileSpreadsheet className="w-9 h-9 mx-auto mb-2 text-gray-300" />
            {fileName ? (
              <div>
                <p className="font-semibold text-sm" style={{ color: NAVY }}>{fileName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {excelRows.length} filas cargadas · haz clic para cambiar archivo
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Arrastra tu Excel aquí o haz clic para seleccionar</p>
            )}
          </div>

          {/* Column mapping */}
          {excelRows.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Columna → Código estudiante", val: codeCol,  set: (v: string) => remapCols(v, modalCol, turnoCol) },
                { label: "Columna → Modalidad estudio", val: modalCol, set: (v: string) => remapCols(codeCol, v, turnoCol) },
                { label: "Columna → Turno",             val: turnoCol, set: (v: string) => remapCols(codeCol, modalCol, v) },
              ].map(({ label, val, set }) => (
                <div key={label} className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
                  <select
                    className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={val} onChange={e => set(e.target.value)}
                  >
                    {allHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {excelRows.length > 0 && (
            <div className="bg-gray-50 rounded-lg overflow-hidden border text-xs">
              <div className="grid grid-cols-3 bg-gray-200 px-3 py-1.5 font-semibold text-gray-600">
                <span>Código</span><span>Modalidad</span><span>Turno</span>
              </div>
              {excelRows.slice(0, 5).map((r, i) => (
                <div key={i} className="grid grid-cols-3 px-3 py-1.5 border-t border-gray-100 font-mono">
                  <span>{r.codigo || <span className="text-red-400">—vacío—</span>}</span>
                  <span>{r.modalidad || "—"}</span>
                  <span>{r.turno || "—"}</span>
                </div>
              ))}
              {excelRows.length > 5 && (
                <p className="px-3 py-1.5 text-muted-foreground border-t">
                  … y {excelRows.length - 5} filas más
                </p>
              )}
            </div>
          )}

          {/* Action */}
          {excelRows.length > 0 && (
            <div className="flex items-center gap-2">
              <Button onClick={verify} disabled={loading} style={{ background: NAVY, color: "#fff" }}>
                {loading
                  ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  : <ArrowRight className="w-4 h-4 mr-1.5" />}
                {loading ? "Verificando..." : `Verificar ${excelRows.length} estudiantes`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                setExcelRows([]); setRawJson([]); setFileName(""); setResults(null);
                setAllHeaders([]); setCodeCol(""); setModalCol(""); setTurnoCol("");
              }}>
                <X className="w-3.5 h-3.5 mr-1" /> Limpiar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: "all"      as const, label: "Total verificados",  value: stats.total,    color: NAVY,      bg: "bg-blue-50/40",  Icon: FileSpreadsheet },
            { key: "match"    as const, label: "Coinciden",          value: stats.match,    color: "#16a34a", bg: "bg-green-50",    Icon: CheckCircle2 },
            { key: "diff"     as const, label: "Difieren",           value: stats.diff,     color: "#dc2626", bg: "bg-red-50",      Icon: AlertCircle },
            { key: "notfound" as const, label: "No encontrados",     value: stats.notFound, color: "#92400e", bg: "bg-amber-50",    Icon: XCircle },
          ].map(({ key, label, value, color, bg, Icon }) => (
            <Card key={key}
              className={`rounded-xl shadow-sm cursor-pointer transition-all ${filter === key ? "ring-2" : "hover:shadow-md"}`}
              style={filter === key ? { ringColor: color } : {}}
              onClick={() => setFilter(key)}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-full p-2.5 ${bg}`}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color }}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results table */}
      {results && (
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b bg-gray-50/50 flex-wrap">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por código, nombre o DNI..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm" />
            </div>
            {search && <Button variant="ghost" size="sm" className="h-7" onClick={() => setSearch("")}><X className="w-3 h-3" /></Button>}
            <p className="text-xs text-muted-foreground ml-auto">
              {filtered.length} de {results.length} registros
            </p>
            <Button size="sm" variant="outline" onClick={exportXlsx}>
              <Download className="w-3.5 h-3.5 mr-1" /> Exportar
            </Button>
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
                  <th className="px-3 py-3 text-left font-semibold" style={{ background: "#1e3a8a" }}>Modalidad Excel</th>
                  <th className="px-3 py-3 text-left font-semibold" style={{ background: "#1e3a8a" }}>Modalidad Sistema</th>
                  <th className="px-3 py-3 text-left font-semibold" style={{ background: "#1e3a8a" }}>Turno Excel</th>
                  <th className="px-3 py-3 text-left font-semibold" style={{ background: "#1e3a8a" }}>Turno Sistema</th>
                  <th className="px-3 py-3 text-center font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-10 text-muted-foreground">Sin resultados</td></tr>
                ) : filtered.map((r, i) => {
                  const rowBg = !r.found ? "bg-amber-50/40"
                    : (r.modalidadMatch === false || r.turnoMatch === false) ? "bg-red-50/40"
                    : "bg-green-50/20";
                  return (
                    <tr key={i} className={`border-b border-gray-100 ${rowBg} hover:opacity-80 transition-opacity`}>
                      <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: NAVY }}>{r.codigo}</td>
                      <td className="px-3 py-2.5 font-medium max-w-[180px] truncate" title={r.sys?.apellidosNombres ?? ""}>
                        {r.sys?.apellidosNombres ?? <span className="text-muted-foreground italic">No encontrado</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono">{r.sys?.dni ?? "—"}</td>
                      <td className="px-3 py-2.5 max-w-[160px] truncate" title={r.sys?.carrera ?? ""}>{r.sys?.carrera ?? "—"}</td>
                      <td className="px-3 py-2.5">{r.sys?.sede ?? "—"}</td>
                      {/* Modalidad comparison */}
                      <td className="px-3 py-2.5">
                        <span className={r.modalidadMatch === false ? "text-red-600 font-semibold" : ""}>{r.modalidad || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.sys
                          ? <span className={r.modalidadMatch === false ? "text-red-600 font-semibold" : "text-green-700"}>{r.sys.modalidadEstudio ?? "—"}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Turno comparison */}
                      <td className="px-3 py-2.5">
                        <span className={r.turnoMatch === false ? "text-red-600 font-semibold" : ""}>{r.turno || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.sys
                          ? <span className={r.turnoMatch === false ? "text-red-600 font-semibold" : "text-green-700"}>{r.sys.turno ?? "—"}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {!r.found ? (
                          <Badge className="text-[10px] px-1.5 bg-amber-100 text-amber-700 border border-amber-200">
                            <XCircle className="w-3 h-3 mr-0.5" /> No hallado
                          </Badge>
                        ) : r.modalidadMatch !== false && r.turnoMatch !== false ? (
                          <Badge className="text-[10px] px-1.5 bg-green-100 text-green-700 border border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-0.5" /> Coincide
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] px-1.5 bg-red-100 text-red-600 border border-red-200">
                            <AlertCircle className="w-3 h-3 mr-0.5" /> Difiere
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
