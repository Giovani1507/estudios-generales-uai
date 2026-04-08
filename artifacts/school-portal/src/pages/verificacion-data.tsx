import React, { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  X,
  ArrowRight,
  RefreshCw,
  Merge,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const NAVY = "#001F5F";

type AnyRow = Record<string, string>;

/* ── helpers ─────────────────────────────────────────────── */
function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function str(v: unknown) { return String(v ?? "").trim(); }

function detectKey(headers: string[]): string {
  const kw = ["codigo", "code", "cod", "matricula"];
  return headers.find(h => kw.some(k => norm(h).includes(k))) ?? headers[0] ?? "";
}

function detectCol(headers: string[], keywords: string[]): string {
  return headers.find(h => keywords.some(k => norm(h).includes(k))) ?? "";
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

/* ── Column selector ─────────────────────────────────────── */
type ColSelectorProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
};
function ColSelector({ label, value, options, onChange }: ColSelectorProps) {
  return (
    <div className="space-y-0.5">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <select
        className="w-full border rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
        value={value} onChange={e => onChange(e.target.value)}
      >
        <option value="">— ninguna —</option>
        {options.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );
}

/* ── Upload card ─────────────────────────────────────────── */
type FileState = {
  name: string;
  headers: string[];
  rows: AnyRow[];
  keyCol: string;
};
type UploadCardProps = {
  id: "a" | "b";
  badge: string;
  hint: string;
  fileState: FileState | null;
  onLoad: (s: FileState) => void;
  onClear: () => void;
  onChange: (partial: Partial<FileState>) => void;
};
function UploadCard({ id, badge, hint, fileState, onLoad, onClear, onChange }: UploadCardProps) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    try {
      const rows = await readExcel(file);
      if (!rows.length) return;
      const headers = Object.keys(rows[0]);
      onLoad({
        name: file.name,
        headers,
        rows,
        keyCol: detectKey(headers),
      });
    } catch {
      alert("Error leyendo el archivo Excel.");
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, []);

  const color = id === "a" ? "#1d4ed8" : "#7c3aed";

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="py-3 px-4 pb-2">
        <CardTitle className="text-xs font-bold flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-bold" style={{ background: color }}>
            {badge}
          </span>
          {hint}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => ref.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            drag ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
          }`}
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
            <div className="grid grid-cols-1 gap-2">
              <ColSelector
                label="Columna clave (CÓDIGO)"
                value={fileState.keyCol}
                options={fileState.headers}
                onChange={v => onChange({ keyCol: v })}
              />
            </div>
            <div className="bg-gray-50 rounded-lg text-[10px] overflow-hidden border">
              <div className="px-3 py-1.5 bg-gray-100 font-semibold text-gray-500 flex gap-3">
                <span className="w-28">Clave (código)</span>
                <span>Otras columnas…</span>
              </div>
              {fileState.rows.slice(0, 4).map((r, i) => (
                <div key={i} className="px-3 py-1.5 border-t border-gray-100 font-mono flex gap-3 items-start">
                  <span className="w-28 text-blue-700 font-bold">{r[fileState.keyCol] || "—"}</span>
                  <span className="text-gray-500 truncate max-w-[200px]">
                    {fileState.headers.filter(h => h !== fileState.keyCol).slice(0, 3).map(h => `${h}: ${r[h]}`).join(" · ")}
                  </span>
                </div>
              ))}
              {fileState.rows.length > 4 && (
                <div className="px-3 py-1 border-t text-gray-400">…{fileState.rows.length - 4} más</div>
              )}
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

/* ── Result row ──────────────────────────────────────────── */
type ResultRow = {
  codigo: string;
  inA: boolean;
  inB: boolean;
  dataA: AnyRow | null;
  dataB: AnyRow | null;
};

/* ── Column picker for display ───────────────────────────── */
function pickCols(headers: string[], exclude: string, keywords: string[][]): string[] {
  const out: string[] = [];
  for (const kwGroup of keywords) {
    const col = headers.find(h => h !== exclude && kwGroup.some(k => norm(h).includes(k)));
    if (col) out.push(col);
  }
  // add rest up to 6 total
  for (const h of headers) {
    if (h !== exclude && !out.includes(h) && out.length < 6) out.push(h);
  }
  return out.slice(0, 6);
}

/* ── Main page ───────────────────────────────────────────── */
export default function VerificacionData() {
  const { toast } = useToast();

  const [fileA, setFileA] = useState<FileState | null>(null);
  const [fileB, setFileB] = useState<FileState | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [filter, setFilter] = useState<"all" | "both" | "onlyA" | "onlyB">("all");
  const [search, setSearch] = useState("");

  /* ── Merge ────────────────────────────────────────────── */
  function merge() {
    if (!fileA || !fileB) return;
    const setA = new Map<string, AnyRow>();
    fileA.rows.forEach(r => {
      const k = (r[fileA.keyCol] || "").toUpperCase().trim();
      if (k) setA.set(k, r);
    });
    const setB = new Map<string, AnyRow>();
    fileB.rows.forEach(r => {
      const k = (r[fileB.keyCol] || "").toUpperCase().trim();
      if (k) setB.set(k, r);
    });

    const allKeys = new Set([...setA.keys(), ...setB.keys()]);
    const out: ResultRow[] = [];
    allKeys.forEach(codigo => {
      out.push({
        codigo,
        inA: setA.has(codigo),
        inB: setB.has(codigo),
        dataA: setA.get(codigo) ?? null,
        dataB: setB.get(codigo) ?? null,
      });
    });
    out.sort((a, b) => {
      // Both first, then only A, then only B
      const score = (r: ResultRow) => r.inA && r.inB ? 0 : r.inA ? 1 : 2;
      return score(a) - score(b) || a.codigo.localeCompare(b.codigo);
    });
    setResults(out); setFilter("both");
    const both = out.filter(r => r.inA && r.inB).length;
    const onlyA = out.filter(r => r.inA && !r.inB).length;
    const onlyB = out.filter(r => !r.inA && r.inB).length;
    toast({ title: `Cruce completado`, description: `${both} coinciden · ${onlyA} solo en Archivo A · ${onlyB} solo en Archivo B` });
  }

  /* ── Filtered results ─────────────────────────────────── */
  const base = results ?? [];
  const filtered = base.filter(r => {
    if (filter === "both"  && !(r.inA && r.inB))   return false;
    if (filter === "onlyA" && !(r.inA && !r.inB))  return false;
    if (filter === "onlyB" && !(!r.inA && r.inB))  return false;
    const q = search.trim().toUpperCase();
    if (!q) return true;
    if (r.codigo.includes(q)) return true;
    const nameA = Object.values(r.dataA ?? {}).join(" ").toUpperCase();
    const nameB = Object.values(r.dataB ?? {}).join(" ").toUpperCase();
    return nameA.includes(q) || nameB.includes(q);
  });

  const stats = results ? {
    total: base.length,
    both:  base.filter(r => r.inA && r.inB).length,
    onlyA: base.filter(r => r.inA && !r.inB).length,
    onlyB: base.filter(r => !r.inA && r.inB).length,
  } : null;

  /* ── Columns to show ─────────────────────────────────── */
  const colsA = fileA ? pickCols(fileA.headers, fileA.keyCol, [
    ["apellido", "nombre"], ["dni", "documento"], ["programa", "carrera"], ["sede", "filial"], ["modalidad", "estudio"], ["turno"]
  ]) : [];
  const colsB = fileB ? pickCols(fileB.headers, fileB.keyCol, [
    ["apellido", "nombre"], ["dni", "documento"], ["programa", "carrera"], ["pago", "matricula"], ["condicion", "resultado"], ["modalidad"]
  ]) : [];

  /* ── Export ─────────────────────────────────────────── */
  function exportXlsx() {
    if (!results) return;
    const src = filter === "all" ? base : filtered;
    const hdrA = colsA.map(c => `A: ${c}`);
    const hdrB = colsB.map(c => `B: ${c}`);
    const hdr = ["Código", "En Archivo A", "En Archivo B", ...hdrA, ...hdrB, "Estado"];
    const rows = src.map(r => [
      r.codigo,
      r.inA ? "SÍ" : "NO",
      r.inB ? "SÍ" : "NO",
      ...colsA.map(c => r.dataA?.[c] ?? ""),
      ...colsB.map(c => r.dataB?.[c] ?? ""),
      r.inA && r.inB ? "AMBOS" : r.inA ? "SOLO A" : "SOLO B",
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
    ws["!cols"] = hdr.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, "Cruce");
    XLSX.writeFile(wb, `cruce-data-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-5 p-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Verificación de Data</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sube dos Excels · el sistema cruza los códigos y muestra cuáles se repiten en ambos archivos
          </p>
        </div>
        {results && (
          <Button size="sm" onClick={exportXlsx} style={{ background: NAVY, color: "#fff" }}>
            <Download className="w-4 h-4 mr-1.5" /> Exportar Excel
          </Button>
        )}
      </div>

      {/* Upload area */}
      <div className="grid md:grid-cols-2 gap-4">
        <UploadCard
          id="a"
          badge="Archivo A"
          hint="DATA principal · columnas: código, modalidad, turno, sede…"
          fileState={fileA}
          onLoad={setFileA}
          onClear={() => { setFileA(null); setResults(null); }}
          onChange={p => setFileA(prev => prev ? { ...prev, ...p } : prev)}
        />
        <UploadCard
          id="b"
          badge="Archivo B"
          hint="Resultado / referencia · columnas: código, pago, carrera, condición…"
          fileState={fileB}
          onLoad={setFileB}
          onClear={() => { setFileB(null); setResults(null); }}
          onChange={p => setFileB(prev => prev ? { ...prev, ...p } : prev)}
        />
      </div>

      {/* Action */}
      {fileA && fileB && (
        <div className="flex items-center gap-3">
          <Button onClick={merge} style={{ background: NAVY, color: "#fff" }} className="gap-2">
            <Merge className="w-4 h-4" />
            Cruzar Archivos ({fileA.rows.length} + {fileB.rows.length} registros)
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: "all"   as const, label: "Total códigos únicos",  value: stats.total,  color: NAVY,      Icon: FileSpreadsheet, bg: "bg-blue-50/40" },
            { key: "both"  as const, label: "Se repiten (en ambos)", value: stats.both,   color: "#16a34a", Icon: CheckCircle2,    bg: "bg-green-50" },
            { key: "onlyA" as const, label: "Solo en Archivo A",     value: stats.onlyA,  color: "#2563eb", Icon: AlertCircle,    bg: "bg-blue-50" },
            { key: "onlyB" as const, label: "Solo en Archivo B",     value: stats.onlyB,  color: "#7c3aed", Icon: XCircle,        bg: "bg-purple-50" },
          ].map(({ key, label, value, color, Icon, bg }) => (
            <Card
              key={key}
              className={`rounded-xl shadow-sm cursor-pointer transition-all ${filter === key ? "ring-2 ring-offset-1" : "hover:shadow-md"}`}
              style={filter === key ? { outline: `2px solid ${color}` } : {}}
              onClick={() => setFilter(key)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-full p-2.5 ${bg}`}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color }}>{value}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results table */}
      {results && (
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-gray-50/60 flex-wrap">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por código o nombre…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs" />
            </div>
            {search && <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSearch("")}><X className="w-3 h-3" /></Button>}
            <p className="text-xs text-muted-foreground ml-auto">{filtered.length} de {base.length} registros</p>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportXlsx}>
              <Download className="w-3.5 h-3.5" /> Exportar
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr style={{ background: NAVY }} className="text-white text-left">
                  <th className="px-3 py-3 font-semibold w-6">#</th>
                  <th className="px-3 py-3 font-semibold">Código</th>
                  <th className="px-3 py-3 font-semibold text-center">En A</th>
                  <th className="px-3 py-3 font-semibold text-center">En B</th>
                  {colsA.map(c => (
                    <th key={`a-${c}`} className="px-3 py-3 font-semibold whitespace-nowrap" style={{ background: "#1e3a8a" }}>
                      <span className="text-blue-200 text-[9px] mr-0.5 font-normal">A·</span>{c}
                    </th>
                  ))}
                  {colsB.map(c => (
                    <th key={`b-${c}`} className="px-3 py-3 font-semibold whitespace-nowrap" style={{ background: "#4c1d95" }}>
                      <span className="text-purple-200 text-[9px] mr-0.5 font-normal">B·</span>{c}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-semibold text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4 + colsA.length + colsB.length + 1} className="text-center py-12 text-muted-foreground">
                      Sin resultados para este filtro
                    </td>
                  </tr>
                ) : filtered.map((r, i) => {
                  const rowBg = r.inA && r.inB  ? "bg-green-50/30"
                    : r.inA                     ? "bg-blue-50/20"
                                                : "bg-purple-50/20";
                  return (
                    <tr key={r.codigo} className={`border-b border-gray-100 ${rowBg} hover:brightness-95 transition-all`}>
                      <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2.5 font-mono font-bold" style={{ color: NAVY }}>{r.codigo}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.inA ? <CheckCircle2 className="w-4 h-4 text-green-600 inline" /> : <XCircle className="w-4 h-4 text-gray-300 inline" />}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.inB ? <CheckCircle2 className="w-4 h-4 text-green-600 inline" /> : <XCircle className="w-4 h-4 text-gray-300 inline" />}
                      </td>
                      {colsA.map(c => (
                        <td key={`a-${c}`} className="px-3 py-2.5 max-w-[160px] truncate" title={r.dataA?.[c] ?? ""}>
                          {r.dataA?.[c] || <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      {colsB.map(c => {
                        const val = r.dataB?.[c] ?? "";
                        const isPago = norm(c).includes("pago");
                        const isPagado = isPago && val && val !== "0" && val !== "NO" && val.trim() !== "";
                        return (
                          <td key={`b-${c}`} className="px-3 py-2.5 max-w-[160px] truncate" title={val}>
                            {isPago ? (
                              isPagado
                                ? <span className="text-green-700 font-semibold">{val || "—"}</span>
                                : <span className="text-red-500 font-semibold">{val || "NO"}</span>
                            ) : val || <span className="text-gray-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center">
                        {r.inA && r.inB ? (
                          <Badge className="text-[10px] px-1.5 bg-green-100 text-green-700 border border-green-300">
                            <CheckCircle2 className="w-3 h-3 mr-0.5" /> Ambos
                          </Badge>
                        ) : r.inA ? (
                          <Badge className="text-[10px] px-1.5 bg-blue-100 text-blue-700 border border-blue-200">
                            Solo A
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] px-1.5 bg-purple-100 text-purple-700 border border-purple-200">
                            Solo B
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

      {/* Empty state */}
      {!fileA && !fileB && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Merge className="w-14 h-14 text-gray-200 mb-3" />
          <p className="text-base font-semibold text-muted-foreground">Sube dos Excels para cruzarlos</p>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>Archivo A</strong>: tu data principal (ej. DATA.1 con turno + modalidad)<br />
            <strong>Archivo B</strong>: resultado o referencia (ej. examen con pago + carrera)<br />
            El sistema identifica qué códigos <strong>se repiten</strong> en ambos
          </p>
        </div>
      )}
    </div>
  );
}
