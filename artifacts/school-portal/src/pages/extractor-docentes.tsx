import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { exportExcelWithLogo } from "@/lib/excel-export";
import { Upload, Download, Search, FileSpreadsheet, Users, X, ChevronDown, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ParsedResult {
  fileName: string;
  sheetName: string;
  totalRows: number;
  detectedColumn: string;
  allColumns: string[];
  docentes: string[];
}

const TEACHER_COL_HINTS = [
  "docente", "nombre", "profesor", "apellido", "teacher", "name",
  "DOCENTE", "NOMBRE", "PROFESOR", "nombre docente", "nombre_docente",
  "apellido y nombre", "apellidos y nombres", "nombres y apellidos",
];

function detectTeacherColumn(headers: string[]): string | null {
  for (const hint of TEACHER_COL_HINTS) {
    const found = headers.find((h) =>
      h.trim().toLowerCase().includes(hint.toLowerCase())
    );
    if (found) return found;
  }
  return null;
}

function extractUnique(rows: Record<string, unknown>[], col: string): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const val = row[col];
    if (val != null) {
      const s = String(val).trim();
      if (s.length > 2 && s !== col) set.add(s);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

export default function ExtractorDocentes() {
  const [isDragging, setIsDragging]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [result, setResult]           = useState<ParsedResult | null>(null);
  const [selectedCol, setSelectedCol] = useState<string>("");
  const [search, setSearch]           = useState("");
  const [showColPicker, setShowColPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rawRowsRef = useRef<Record<string, unknown>[]>([]);

  /* ── Parse file ── */
  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls|ods|csv)$/i)) {
      setError("Formato no soportado. Usa archivos .xlsx, .xls, .ods o .csv");
      return;
    }
    setIsProcessing(true);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        if (rows.length === 0) {
          setError("El archivo no contiene datos.");
          setIsProcessing(false);
          return;
        }

        rawRowsRef.current = rows;
        const headers = Object.keys(rows[0]);
        const autoCol = detectTeacherColumn(headers) ?? headers[0];
        const docentes = extractUnique(rows, autoCol);

        setSelectedCol(autoCol);
        setResult({
          fileName: file.name,
          sheetName,
          totalRows: rows.length,
          detectedColumn: autoCol,
          allColumns: headers,
          docentes,
        });
      } catch {
        setError("No se pudo leer el archivo. Asegúrate de que no esté dañado.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  /* ── Column change ── */
  const changeColumn = (col: string) => {
    setSelectedCol(col);
    setShowColPicker(false);
    if (result) {
      const docentes = extractUnique(rawRowsRef.current, col);
      setResult({ ...result, detectedColumn: col, docentes });
    }
  };

  /* ── Drag & drop ── */
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  /* ── Export Excel ── */
  const exportExcel = () => {
    if (!result) return;
    exportExcelWithLogo({
      sheetTitle: `Docentes — ${result.sheetName}`,
      institution: "Universidad Autónoma de Ica",
      subtitle: `Extraído de: ${result.sheetName}`,
      fileName: `docentes_${result.sheetName}`,
      columns: [
        { header: "#",      key: "n",       width: 5,  align: "center" },
        { header: "Docente",key: "nombre",  width: 52 },
      ],
      rows: filtered.map((name, i) => ({ n: i + 1, nombre: name })),
    });
  };

  /* ── Export CSV ── */
  const exportCSV = () => {
    if (!result) return;
    const rows = ["#,Docente", ...filtered.map((n, i) => `${i + 1},"${n}"`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `docentes_${result.sheetName}_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const filtered = result
    ? result.docentes.filter((d) => d.toLowerCase().includes(search.toLowerCase()))
    : [];

  const reset = () => {
    setResult(null); setError(null); setSearch(""); setSelectedCol("");
    rawRowsRef.current = [];
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <FileSpreadsheet className="w-7 h-7 text-primary" />
            Extractor de Docentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importa cualquier planificación en Excel y obtén la lista de docentes únicos al instante.
          </p>
        </div>
        {result && (
          <Button variant="outline" size="sm" onClick={reset} className="gap-2">
            <X className="w-4 h-4" /> Limpiar
          </Button>
        )}
      </div>

      {/* Upload zone — show if no result */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 py-16 px-8
            ${isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border/60 hover:border-primary/50 hover:bg-muted/40 bg-muted/20"
            }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.ods,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />

          {isProcessing ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="w-7 h-7 text-primary animate-pulse" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Procesando archivo…</p>
            </>
          ) : (
            <>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>
                <Upload className="w-8 h-8" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground">
                  {isDragging ? "Suelta el archivo aquí" : "Arrastra tu planificación o haz clic para seleccionar"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Soporta archivos <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.ods</strong> y <strong>.csv</strong>
                </p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {[".xlsx", ".xls", ".ods", ".csv"].map((ext) => (
                  <Badge key={ext} variant="secondary" className="text-xs font-mono">{ext}</Badge>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Info bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { icon: <FileText className="w-4 h-4" />, label: "Archivo", value: result.fileName, truncate: true },
              { icon: <FileSpreadsheet className="w-4 h-4" />, label: "Hoja", value: result.sheetName },
              { icon: <FileText className="w-4 h-4" />, label: "Filas totales", value: result.totalRows.toLocaleString("es") },
              { icon: <Users className="w-4 h-4" />, label: "Docentes únicos", value: result.docentes.length.toLocaleString("es") },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{item.label}</p>
                  <p className={`text-sm font-semibold text-foreground ${item.truncate ? "truncate" : ""}`} title={String(item.value)}>
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Column selector + detected badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Columna detectada:</span>
              <Badge variant="default" className="bg-primary/90 text-white text-xs px-2.5 py-0.5">
                {selectedCol}
              </Badge>
            </div>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs h-8"
                onClick={() => setShowColPicker((v) => !v)}
              >
                Cambiar columna
                <ChevronDown className={`w-3 h-3 transition-transform ${showColPicker ? "rotate-180" : ""}`} />
              </Button>
              {showColPicker && (
                <div className="absolute left-0 top-10 z-20 w-72 max-h-64 overflow-y-auto bg-white border border-border/60 rounded-xl shadow-xl p-1">
                  {result.allColumns.map((col) => (
                    <button
                      key={col}
                      onClick={() => changeColumn(col)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        col === selectedCol
                          ? "bg-primary text-white font-medium"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search + export actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar docente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={exportExcel} className="gap-2 h-9 text-sm bg-green-600 hover:bg-green-700">
                <Download className="w-4 h-4" />
                Excel
              </Button>
              <Button onClick={exportCSV} variant="outline" className="gap-2 h-9 text-sm">
                <Download className="w-4 h-4" />
                CSV
              </Button>
            </div>
          </div>

          {/* Docentes table */}
          <div className="rounded-xl border border-border/50 overflow-hidden bg-white shadow-sm">
            {/* Table header */}
            <div className="grid grid-cols-[52px_1fr] bg-muted/60 border-b border-border/50 px-4 py-2.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">#</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Nombre del Docente
                {search && (
                  <span className="ml-2 text-primary normal-case font-normal">
                    — {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                  </span>
                )}
              </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/40 max-h-[460px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Search className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No se encontraron docentes con "{search}"</p>
                </div>
              ) : (
                filtered.map((nombre, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[52px_1fr] items-center px-4 py-2.5 hover:bg-primary/[0.03] transition-colors"
                  >
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">{i + 1}</span>
                    <span className="text-sm font-medium text-foreground">{nombre}</span>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-muted/30 border-t border-border/40 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {filtered.length} de {result.docentes.length} docentes
                {search ? ` que coinciden con "${search}"` : " únicos"}
              </span>
              <span className="text-xs text-muted-foreground">
                Fuente: {result.fileName}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
