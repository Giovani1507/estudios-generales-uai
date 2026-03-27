import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Search, Download, Users, AlertTriangle, CheckCircle2, X, Building2, FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DocenteFICA {
  n: number;
  dni: number | null;
  nombre: string;
  programa: string;
  condicion: string;
  dedicacion: string;
  horas25: number;
  horas26: number;
  local: string;
}

const PAGE_SIZE = 60;

export default function DocentesFICA2026() {
  const [allData, setAllData] = useState<DocenteFICA[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [fProg, setFProg]     = useState("all");
  const [fEstado, setFEstado] = useState<"all" | "ok" | "sinReg">("all");
  const [page, setPage]       = useState(1);

  useEffect(() => {
    fetch("/docentes-fica-2026.json")
      .then((r) => r.json())
      .then((d) => { setAllData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const progs = useMemo(() => {
    const s = new Set(allData.map((d) => d.programa).filter(Boolean));
    return Array.from(s).sort();
  }, [allData]);

  const filtered = useMemo(() => {
    let r = allData;
    if (fProg !== "all") r = r.filter((d) => d.programa === fProg);
    if (fEstado === "ok")     r = r.filter((d) => d.dni !== null);
    if (fEstado === "sinReg") r = r.filter((d) => d.dni === null);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(
        (d) =>
          d.nombre.toLowerCase().includes(q) ||
          (d.dni ? d.dni.toString().includes(q) : false) ||
          d.programa.toLowerCase().includes(q)
      );
    }
    return r;
  }, [allData, fProg, fEstado, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage  = () => setPage(1);

  const sinRegistro = allData.filter((d) => d.dni === null);
  const conRegistro = allData.filter((d) => d.dni !== null);

  /* Export Excel */
  const exportExcel = () => {
    const data = filtered.map((d, i) => ({
      "#":          i + 1,
      "DNI":        d.dni ?? "SIN REGISTRO",
      "Nombre":     d.nombre,
      "Programa":   d.programa || "—",
      "Condición":  d.condicion || "—",
      "Dedicación": d.dedicacion || "—",
      "Horas 2025-2": d.horas25 || 0,
      "Horas 2026-1": d.horas26 || 0,
      "Local":      d.local || "—",
      "Estado":     d.dni ? "En Registro" : "Sin Registro",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 5 }, { wch: 12 }, { wch: 44 }, { wch: 32 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Docentes FICA 2026");
    XLSX.writeFile(wb, "docentes_fica_2026.xlsx");
  };

  /* Export CSV */
  const exportCSV = () => {
    const header = "#,DNI,Nombre,Programa,Condición,Dedicación,Horas 2025-2,Horas 2026-1,Estado";
    const rows = filtered.map((d, i) =>
      `${i + 1},${d.dni ?? "SIN REGISTRO"},"${d.nombre}","${d.programa || "—"}","${d.condicion || "—"}","${d.dedicacion || "—"}",${d.horas25 || 0},${d.horas26 || 0},"${d.dni ? "En Registro" : "Sin Registro"}"`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "docentes_fica_2026.csv";
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-2">
          <Building2 className="w-10 h-10 mx-auto opacity-30 animate-pulse" />
          <p className="text-sm">Cargando docentes FICA 2026…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Building2 className="w-7 h-7 text-primary" />
          Docentes FICA 2026
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lista oficial de docentes con carga académica en la Facultad FICA · 2026
        </p>
      </div>

      {/* Alert if there are unregistered teachers */}
      {sinRegistro.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {sinRegistro.length} docente{sinRegistro.length > 1 ? "s" : ""} sin registro oficial
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {sinRegistro.map((d) => d.nombre).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total FICA 2026",   value: allData.length,       icon: <Users className="w-4 h-4" />,           color: "text-primary bg-primary/10" },
          { label: "Con registro",      value: conRegistro.length,   icon: <CheckCircle2 className="w-4 h-4" />,    color: "text-green-600 bg-green-50" },
          { label: "Sin registro",      value: sinRegistro.length,   icon: <AlertTriangle className="w-4 h-4" />,   color: sinRegistro.length > 0 ? "text-amber-600 bg-amber-50" : "text-green-600 bg-green-50" },
          { label: "Programas",         value: progs.length,         icon: <FileText className="w-4 h-4" />,        color: "text-indigo-600 bg-indigo-50" },
        ].map((c) => (
          <div key={c.label} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-white">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
              {c.icon}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
              <p className="text-xl font-bold text-foreground">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Program filter */}
        <select
          value={fProg}
          onChange={(e) => { setFProg(e.target.value); resetPage(); }}
          className="h-9 rounded-lg border border-border/60 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-52"
        >
          <option value="all">Todos los programas</option>
          {progs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Status filter */}
        <div className="flex rounded-lg border border-border/60 overflow-hidden bg-white">
          {([
            { v: "all",    l: "Todos" },
            { v: "ok",     l: "Con registro" },
            { v: "sinReg", l: "Sin registro" },
          ] as { v: typeof fEstado; l: string }[]).map(({ v, l }) => (
            <button
              key={v}
              onClick={() => { setFEstado(v); resetPage(); }}
              className={`px-3 h-9 text-sm font-medium transition-colors border-r last:border-r-0 border-border/40 ${
                fEstado === v
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, DNI o programa…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button onClick={() => { setSearch(""); resetPage(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Export buttons */}
        <Button onClick={exportExcel} className="gap-2 h-9 text-sm bg-green-600 hover:bg-green-700">
          <Download className="w-4 h-4" /> Excel
        </Button>
        <Button onClick={exportCSV} variant="outline" className="gap-2 h-9 text-sm">
          <Download className="w-4 h-4" /> CSV
        </Button>
      </div>

      {/* Result count */}
      <p className="text-sm text-muted-foreground">
        Mostrando <strong className="text-foreground">{filtered.length}</strong> de {allData.length} docentes
        {search && ` · "${search}"`}
      </p>

      {/* Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden bg-white shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-[44px_116px_1fr_180px_90px_80px_80px_80px] bg-muted/60 border-b border-border/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>#</span>
          <span>DNI</span>
          <span>Nombre</span>
          <span>Programa</span>
          <span>Cond.</span>
          <span className="text-center">H. 2025</span>
          <span className="text-center">H. 2026</span>
          <span className="text-center">Estado</span>
        </div>

        {/* Body */}
        <div className="divide-y divide-border/40 max-h-[520px] overflow-y-auto">
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Search className="w-8 h-8 opacity-30" />
              <p className="text-sm">Sin resultados</p>
            </div>
          ) : (
            paginated.map((d, idx) => {
              const rowN = (page - 1) * PAGE_SIZE + idx + 1;
              const sinReg = d.dni === null;
              return (
                <div
                  key={d.nombre}
                  className={`grid grid-cols-[44px_116px_1fr_180px_90px_80px_80px_80px] items-center px-4 py-2.5 transition-colors ${
                    sinReg ? "bg-amber-50/60 hover:bg-amber-50" : "hover:bg-primary/[0.03]"
                  }`}
                >
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">{rowN}</span>
                  <span className={`text-sm font-mono tabular-nums ${sinReg ? "text-amber-600 italic" : "text-foreground"}`}>
                    {d.dni ?? "—"}
                  </span>
                  <span className="text-sm font-medium text-foreground pr-2 truncate" title={d.nombre}>
                    {d.nombre}
                  </span>
                  <span className="text-xs text-muted-foreground truncate pr-2" title={d.programa}>
                    {d.programa || "—"}
                  </span>
                  <span>
                    {d.condicion ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-700 bg-blue-50"
                      >
                        {d.condicion}
                      </Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </span>
                  <span className="text-sm text-center text-muted-foreground tabular-nums">
                    {d.horas25 > 0 ? d.horas25 : "—"}
                  </span>
                  <span className={`text-sm text-center font-medium tabular-nums ${d.horas26 > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {d.horas26 > 0 ? d.horas26 : "—"}
                  </span>
                  <span className="flex justify-center">
                    {sinReg ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50">
                        Sin reg.
                      </Badge>
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination footer */}
        <div className="px-4 py-2.5 bg-muted/30 border-t border-border/40 flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            Pág. {page} de {totalPages} · {filtered.length} docentes
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="h-7 w-7 p-0 text-xs">«</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-7 w-7 p-0 text-xs">‹</Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const pn = start + i;
              return (
                <Button key={pn} variant={pn === page ? "default" : "outline"} size="sm" onClick={() => setPage(pn)}
                  className={`h-7 w-7 p-0 text-xs ${pn === page ? "bg-primary text-white" : ""}`}>
                  {pn}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 w-7 p-0 text-xs">›</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="h-7 w-7 p-0 text-xs">»</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
