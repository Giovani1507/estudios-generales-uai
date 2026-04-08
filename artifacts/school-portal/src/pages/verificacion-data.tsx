import React, { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Download,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";
const GOLD = "#C9A84C";

type UploadedRow = {
  codigoEstudiante: string;
  turno: string;
  [key: string]: string;
};

type MergedRow = {
  codigoEstudiante: string;
  turnoSubido: string;
  apellidosNombres: string | null;
  dni: string | null;
  carrera: string | null;
  sede: string | null;
  modalidadIngreso: string | null;
  modalidadEstudio: string | null;
  turnoSistema: string | null;
  seccion: string | null;
  celular: string | null;
  correo: string | null;
  estado: "encontrado" | "no_encontrado";
};

// Detect which column is the student code and which is turno
function detectColumns(headers: string[]): { codeCol: string | null; turnoCol: string | null } {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const codeKeywords  = ["codigo", "code", "cod", "estudiante", "alumno", "matricula"];
  const turnoKeywords = ["turno", "turn", "horario", "jornada", "periodo"];

  let codeCol  = headers.find(h => codeKeywords.some(k => norm(h).includes(k))) ?? null;
  let turnoCol = headers.find(h => turnoKeywords.some(k => norm(h).includes(k))) ?? null;

  // Fallback: first column is code, second is turno
  if (!codeCol && headers.length >= 1) codeCol  = headers[0];
  if (!turnoCol && headers.length >= 2) turnoCol = headers[1];

  return { codeCol, turnoCol };
}

export default function VerificacionData() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]       = useState(false);
  const [uploaded, setUploaded]       = useState<UploadedRow[]>([]);
  const [fileName, setFileName]       = useState("");
  const [allHeaders, setAllHeaders]   = useState<string[]>([]);
  const [codeCol, setCodeCol]         = useState<string>("");
  const [turnoCol, setTurnoCol]       = useState<string>("");
  const [merging, setMerging]         = useState(false);
  const [merged, setMerged]           = useState<MergedRow[] | null>(null);

  function parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data   = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb     = XLSX.read(data, { type: "array" });
        const ws     = wb.Sheets[wb.SheetNames[0]];
        const json   = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        if (json.length === 0) {
          toast({ title: "El archivo está vacío", variant: "destructive" });
          return;
        }

        const headers = Object.keys(json[0]);
        const { codeCol: detCode, turnoCol: detTurno } = detectColumns(headers);

        setAllHeaders(headers);
        setCodeCol(detCode ?? headers[0] ?? "");
        setTurnoCol(detTurno ?? headers[1] ?? "");
        setUploaded(json.map(r => ({
          ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])),
          codigoEstudiante: String(r[detCode ?? headers[0]] ?? "").trim().toUpperCase(),
          turno: String(r[detTurno ?? headers[1]] ?? "").trim(),
        })));
        setFileName(file.name);
        setMerged(null);
        toast({ title: `Archivo cargado: ${json.length} filas` });
      } catch (err) {
        toast({ title: "Error al leer el archivo Excel", description: String(err), variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFile(file: File | null) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast({ title: "Solo se permiten archivos Excel (.xlsx, .xls) o CSV", variant: "destructive" });
      return;
    }
    parseExcel(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0] ?? null);
  }, []);

  // Re-map when user changes column selectors
  function remapCols(newCodeCol: string, newTurnoCol: string) {
    setCodeCol(newCodeCol);
    setTurnoCol(newTurnoCol);
    setUploaded(prev => prev.map(r => ({
      ...r,
      codigoEstudiante: String(r[newCodeCol] ?? "").trim().toUpperCase(),
      turno: String(r[newTurnoCol] ?? "").trim(),
    })));
    setMerged(null);
  }

  async function handleMerge() {
    if (uploaded.length === 0) return;
    setMerging(true);
    try {
      const codigos = [...new Set(uploaded.map(r => r.codigoEstudiante).filter(Boolean))];
      const r = await fetch(`${apiBase}/api/students/lookup-codes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigos }),
      });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const { found } = await r.json() as {
        found: {
          codigoEstudiante: string | null;
          apellidosNombres: string;
          dni: string;
          carrera: string | null;
          sede: string | null;
          modalidadIngreso: string | null;
          modalidadEstudio: string | null;
          turno: string | null;
          seccion: string | null;
          celular: string | null;
          correo: string | null;
        }[];
      };

      const foundMap = new Map(found.map(f => [(f.codigoEstudiante ?? "").toUpperCase(), f]));

      const result: MergedRow[] = uploaded.map(row => {
        const code  = row.codigoEstudiante;
        const sys   = foundMap.get(code);
        return {
          codigoEstudiante: code,
          turnoSubido:      row.turno,
          apellidosNombres: sys?.apellidosNombres ?? null,
          dni:              sys?.dni ?? null,
          carrera:          sys?.carrera ?? null,
          sede:             sys?.sede ?? null,
          modalidadIngreso: sys?.modalidadIngreso ?? null,
          modalidadEstudio: sys?.modalidadEstudio ?? null,
          turnoSistema:     sys?.turno ?? null,
          seccion:          sys?.seccion ?? null,
          celular:          sys?.celular ?? null,
          correo:           sys?.correo ?? null,
          estado:           sys ? "encontrado" : "no_encontrado",
        };
      });

      setMerged(result);
      const found2 = result.filter(r => r.estado === "encontrado").length;
      const notFound = result.length - found2;
      toast({
        title: `Verificación completa`,
        description: `${found2} encontrados, ${notFound} sin datos en sistema`,
      });
    } catch (err) {
      toast({ title: "Error al verificar", description: String(err), variant: "destructive" });
    } finally {
      setMerging(false);
    }
  }

  function exportMerged() {
    if (!merged) return;
    const header = [
      "Código Estudiante", "Turno (Excel subido)", "Apellidos y Nombres", "DNI",
      "Carrera", "Sede", "Modalidad Ingreso", "Modalidad Estudio",
      "Turno (Sistema)", "Sección", "Celular", "Correo", "Estado",
    ];
    const rows = merged.map(r => [
      r.codigoEstudiante,
      r.turnoSubido,
      r.apellidosNombres ?? "",
      r.dni ?? "",
      r.carrera ?? "",
      r.sede ?? "",
      r.modalidadIngreso ?? "",
      r.modalidadEstudio ?? "",
      r.turnoSistema ?? "",
      r.seccion ?? "",
      r.celular ?? "",
      r.correo ?? "",
      r.estado === "encontrado" ? "ENCONTRADO" : "NO ENCONTRADO",
    ]);

    const wb  = XLSX.utils.book_new();
    const ws  = XLSX.utils.aoa_to_sheet([header, ...rows]);

    // Column widths
    ws["!cols"] = [
      { wch: 18 }, { wch: 18 }, { wch: 36 }, { wch: 12 },
      { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
      { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 28 }, { wch: 16 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Verificación");
    XLSX.writeFile(wb, `verificacion-data-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const foundCount    = merged?.filter(r => r.estado === "encontrado").length ?? 0;
  const notFoundCount = merged ? merged.length - foundCount : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Verificación de Data</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sube tu Excel con códigos y turno — el sistema los une con la data de ingresantes
          </p>
        </div>
        {merged && (
          <Button size="sm" onClick={exportMerged} style={{ background: NAVY, color: "#fff" }}>
            <Download className="w-4 h-4 mr-1.5" />
            Descargar Excel unido
          </Button>
        )}
      </div>

      {/* Upload zone */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: NAVY }}>
            <Upload className="w-4 h-4" /> Subir Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-gray-200 hover:border-primary/40 hover:bg-gray-50"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => handleFile(e.target.files?.[0] ?? null)}
            />
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            {fileName ? (
              <div>
                <p className="font-semibold text-sm" style={{ color: NAVY }}>{fileName}</p>
                <p className="text-xs text-muted-foreground mt-1">{uploaded.length} filas cargadas — haz clic para cambiar</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-sm text-muted-foreground">Arrastra tu Excel aquí o haz clic para seleccionarlo</p>
                <p className="text-xs text-muted-foreground mt-1">Formatos: .xlsx · .xls · .csv</p>
              </div>
            )}
          </div>

          {/* Column mapping */}
          {uploaded.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Columna → Código estudiante
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={codeCol}
                  onChange={e => remapCols(e.target.value, turnoCol)}
                >
                  {allHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Columna → Turno
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={turnoCol}
                  onChange={e => remapCols(codeCol, e.target.value)}
                >
                  {allHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Preview of uploaded rows */}
          {uploaded.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Vista previa ({Math.min(5, uploaded.length)} de {uploaded.length} filas)
              </p>
              <div className="bg-gray-50 rounded-lg overflow-hidden border text-xs font-mono">
                <div className="grid grid-cols-2 bg-gray-200 px-3 py-1.5 font-semibold text-gray-600">
                  <span>Código</span>
                  <span>Turno</span>
                </div>
                {uploaded.slice(0, 5).map((r, i) => (
                  <div key={i} className="grid grid-cols-2 px-3 py-1.5 border-t border-gray-100">
                    <span>{r.codigoEstudiante || <span className="text-red-400">—vacío—</span>}</span>
                    <span>{r.turno || <span className="text-gray-400">—</span>}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action button */}
          {uploaded.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={handleMerge}
                disabled={merging || !codeCol}
                style={{ background: NAVY, color: "#fff" }}
              >
                {merging
                  ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  : <ArrowRight className="w-4 h-4 mr-1.5" />}
                {merging ? "Verificando..." : `Verificar y unir ${uploaded.length} filas`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                setUploaded([]); setFileName(""); setMerged(null);
                setAllHeaders([]); setCodeCol(""); setTurnoCol("");
              }}>
                <X className="w-4 h-4 mr-1" /> Limpiar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {merged && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-full p-3" style={{ background: NAVY + "15" }}>
                  <FileSpreadsheet className="w-5 h-5" style={{ color: NAVY }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: NAVY }}>{merged.length}</p>
                  <p className="text-sm text-muted-foreground">Total filas unidas</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-full p-3 bg-green-50">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{foundCount}</p>
                  <p className="text-sm text-muted-foreground">Encontrados en sistema</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-full p-3 bg-red-50">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{notFoundCount}</p>
                  <p className="text-sm text-muted-foreground">No encontrados</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card className="rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50/50">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>
                Resultado de Verificación
              </p>
              <Button size="sm" onClick={exportMerged} variant="outline">
                <Download className="w-4 h-4 mr-1.5" />
                Descargar Excel
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: NAVY }} className="text-white text-xs">
                    <th className="px-3 py-3 text-left font-semibold">#</th>
                    <th className="px-3 py-3 text-left font-semibold">Código</th>
                    <th className="px-3 py-3 text-left font-semibold">Turno (Excel)</th>
                    <th className="px-3 py-3 text-left font-semibold">Apellidos y Nombres</th>
                    <th className="px-3 py-3 text-left font-semibold">DNI</th>
                    <th className="px-3 py-3 text-left font-semibold">Carrera</th>
                    <th className="px-3 py-3 text-left font-semibold">Sede</th>
                    <th className="px-3 py-3 text-left font-semibold">Turno (Sistema)</th>
                    <th className="px-3 py-3 text-left font-semibold">Sección</th>
                    <th className="px-3 py-3 text-center font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {merged.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-100 transition-colors ${
                        r.estado === "encontrado" ? "hover:bg-green-50/30" : "bg-red-50/30 hover:bg-red-50/50"
                      }`}
                    >
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold" style={{ color: NAVY }}>
                        {r.codigoEstudiante}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {r.turnoSubido || "—"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-medium max-w-[200px] truncate" title={r.apellidosNombres ?? ""}>
                        {r.apellidosNombres ?? <span className="text-muted-foreground">No encontrado</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.dni ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[160px] truncate" title={r.carrera ?? ""}>{r.carrera ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs">{r.sede ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs">{r.turnoSistema ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs">{r.seccion ?? "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.estado === "encontrado" ? (
                          <Badge className="text-[11px] px-2 bg-green-100 text-green-700 border border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> OK
                          </Badge>
                        ) : (
                          <Badge className="text-[11px] px-2 bg-red-100 text-red-600 border border-red-200">
                            <AlertCircle className="w-3 h-3 mr-1" /> No encontrado
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
