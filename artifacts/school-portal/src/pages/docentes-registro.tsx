import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Search, Download, Users, Building2, Stethoscope, FileText, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DocenteReg {
  n: number;
  dni: number;
  nombre: string;
  condicion25: string;
  ingresoPor25: string;
  local25: string;
  programa25: string;
  dedicacion25: string;
  horas25: number;
  local26: string;
  condicion26: string;
  ingresoPor26: string;
  programa26: string;
  dedicacion26: string;
  horas26: number;
  observaciones: string;
  facultad: string;
}

const FICA_PROGS = [
  "INGENIERÍA DE SISTEMAS","INGENIERÍA INDUSTRIAL","INGENIERÍA CIVIL",
  "ARQUITECTURA","DERECHO","ADMINISTRACIÓN DE EMPRESAS","CONTABILIDAD",
  "ADMINISTRACIÓN Y FINANZAS",
];

const FCS_PROGS = [
  "ENFERMERÍA","OBSTETRICIA","PSICOLOGÍA","MEDICINA HUMANA","TECNOLOGÍA MÉDICA",
];

const PAGE_SIZE = 60;

type FacFilter = "FICA" | "FCS" | "TODOS";

export default function DocentesRegistro() {
  const [allData, setAllData] = useState<DocenteReg[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fFac, setFFac]         = useState<FacFilter>("FICA");
  const [fProg, setFProg]       = useState("all");
  const [fBusq, setFBusq]       = useState("");
  const [fHoras, setFHoras]     = useState<"all" | "2025" | "2026">("all");
  const [page, setPage]         = useState(1);

  useEffect(() => {
    fetch("/docentes-registro-2026-1.json")
      .then((r) => r.json())
      .then((d) => { setAllData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  /* Derived sets */
  const ficaDocentes = useMemo(() => allData.filter((d) => d.facultad === "FICA"), [allData]);
  const fcsDocentes  = useMemo(() => allData.filter((d) => d.facultad === "FCS"),  [allData]);

  const baseSet = useMemo(() => {
    if (fFac === "FICA") return ficaDocentes;
    if (fFac === "FCS")  return fcsDocentes;
    return allData;
  }, [fFac, allData, ficaDocentes, fcsDocentes]);

  const progs = useMemo(() => {
    const set = new Set(baseSet.map((d) => d.programa25).filter(Boolean));
    return Array.from(set).sort();
  }, [baseSet]);

  const filtered = useMemo(() => {
    let r = baseSet;
    if (fProg !== "all") r = r.filter((d) => d.programa25 === fProg);
    if (fHoras === "2026") r = r.filter((d) => d.horas26 > 0);
    if (fHoras === "2025") r = r.filter((d) => d.horas25 > 0);
    if (fBusq) {
      const q = fBusq.toLowerCase();
      r = r.filter(
        (d) =>
          d.nombre.toLowerCase().includes(q) ||
          d.dni.toString().includes(q)
      );
    }
    return [...r].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [baseSet, fProg, fHoras, fBusq]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetPage = () => setPage(1);

  /* Export Excel */
  const exportExcel = () => {
    const data = filtered.map((d, i) => ({
      "#":           i + 1,
      "DNI":         d.dni,
      "Nombre":      d.nombre,
      "Programa 2025-2": d.programa25,
      "Condición":   d.condicion25,
      "Dedicación":  d.dedicacion25,
      "Horas 2025-2": d.horas25,
      "Programa 2026-1": d.programa26 || "—",
      "Dedicación 2026-1": d.dedicacion26 || "—",
      "Horas 2026-1": d.horas26 || 0,
      "Local":       d.local25,
      "Observaciones": d.observaciones,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      {wch:5},{wch:12},{wch:42},{wch:30},{wch:12},
      {wch:12},{wch:12},{wch:30},{wch:14},{wch:14},{wch:10},{wch:40},
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Docentes ${fFac}`);
    XLSX.writeFile(wb, `docentes_${fFac.toLowerCase()}_2026-1.xlsx`);
  };

  /* Export CSV */
  const exportCSV = () => {
    const header = "#,DNI,Nombre,Programa 2025-2,Condición,Dedicación,Horas 2025-2,Horas 2026-1";
    const rows = filtered.map((d, i) =>
      `${i+1},${d.dni},"${d.nombre}","${d.programa25}","${d.condicion25}","${d.dedicacion25}",${d.horas25},${d.horas26}`
    );
    const blob = new Blob([[header,...rows].join("\n")], {type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `docentes_${fFac.toLowerCase()}_2026-1.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-2">
          <Users className="w-10 h-10 mx-auto opacity-30 animate-pulse" />
          <p className="text-sm">Cargando registro de docentes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Users className="w-7 h-7 text-primary" />
          Registro de Docentes 2026-1
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Datos oficiales de docentes con carga académica · Semestre 2026-1
        </p>
      </div>

      {/* Faculty tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["FICA","FCS","TODOS"] as FacFilter[]).map((f) => {
          const count = f==="FICA" ? ficaDocentes.length : f==="FCS" ? fcsDocentes.length : allData.length;
          const isActive = fFac === f;
          const Icon = f==="FICA" ? Building2 : f==="FCS" ? Stethoscope : Users;
          return (
            <button
              key={f}
              onClick={() => { setFFac(f); setFProg("all"); setFBusq(""); resetPage(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                isActive
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-muted-foreground border-border/50 hover:border-primary/40 hover:text-primary"
              }`}
            >
              <Icon className="w-4 h-4" />
              {f === "TODOS" ? "Todos" : f}
              <span className={`text-xs px-1.5 py-0.5 rounded-md font-mono ${isActive ? "bg-white/20" : "bg-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={fProg}
          onChange={(e) => { setFProg(e.target.value); resetPage(); }}
          className="h-9 rounded-lg border border-border/60 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-52"
        >
          <option value="all">Todos los programas</option>
          {progs.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Horas filter */}
        <div className="flex rounded-lg border border-border/60 overflow-hidden bg-white">
          {(["all", "2025", "2026"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => { setFHoras(opt); resetPage(); }}
              className={`px-3 h-9 text-sm font-medium transition-colors border-r last:border-r-0 border-border/40 ${
                fHoras === opt
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {opt === "all" ? "Todas las horas" : `H. ${opt}`}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o DNI…"
            value={fBusq}
            onChange={(e) => { setFBusq(e.target.value); resetPage(); }}
            className="pl-9 h-9 text-sm"
          />
          {fBusq && (
            <button onClick={() => { setFBusq(""); resetPage(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2 ml-auto">
          <Button onClick={exportExcel} className="gap-2 h-9 text-sm bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button onClick={exportCSV} variant="outline" className="gap-2 h-9 text-sm">
            <Download className="w-4 h-4" /> CSV
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="w-4 h-4" />
        <span>
          Mostrando <strong className="text-foreground">{filtered.length}</strong> docentes
          {fBusq && ` · búsqueda: "${fBusq}"`}
          {fProg !== "all" && ` · programa: ${fProg}`}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden bg-white shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-[44px_110px_1fr_200px_90px_80px_80px] bg-muted/60 border-b border-border/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>#</span>
          <span>DNI</span>
          <span>Nombre del Docente</span>
          <span>Programa 2025-2</span>
          <span>Condición</span>
          <span className="text-center">H. 2025</span>
          <span className="text-center">H. 2026</span>
        </div>

        {/* Body */}
        <div className="divide-y divide-border/40 max-h-[520px] overflow-y-auto">
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Search className="w-8 h-8 opacity-30" />
              <p className="text-sm">Sin resultados para los filtros seleccionados</p>
            </div>
          ) : (
            paginated.map((d, idx) => {
              const rowN = (page - 1) * PAGE_SIZE + idx + 1;
              return (
                <div
                  key={d.dni}
                  className="grid grid-cols-[44px_110px_1fr_200px_90px_80px_80px] items-center px-4 py-2.5 hover:bg-primary/[0.03] transition-colors"
                >
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">{rowN}</span>
                  <span className="text-sm font-mono text-foreground tabular-nums">{d.dni}</span>
                  <span className="text-sm font-medium text-foreground pr-2 truncate" title={d.nombre}>
                    {d.nombre}
                  </span>
                  <span className="text-xs text-muted-foreground truncate pr-2" title={d.programa25}>
                    {d.programa25 || "—"}
                  </span>
                  <span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 font-medium ${
                        d.condicion25 === "DOCENTE"
                          ? "border-blue-200 text-blue-700 bg-blue-50"
                          : "border-amber-200 text-amber-700 bg-amber-50"
                      }`}
                    >
                      {d.condicion25 || "—"}
                    </Badge>
                  </span>
                  <span className="text-sm text-center text-muted-foreground tabular-nums">
                    {d.horas25 > 0 ? d.horas25 : "—"}
                  </span>
                  <span className={`text-sm text-center font-medium tabular-nums ${d.horas26 > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {d.horas26 > 0 ? d.horas26 : "—"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Pagination */}
        <div className="px-4 py-2.5 bg-muted/30 border-t border-border/40 flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            Pág. {page} de {totalPages} · {filtered.length} docentes en total
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}
              className="h-7 w-7 p-0 text-xs"
            >«</Button>
            <Button
              variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p-1))} disabled={page === 1}
              className="h-7 w-7 p-0 text-xs"
            >‹</Button>
            {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const pn = start + i;
              return (
                <Button
                  key={pn} variant={pn===page?"default":"outline"} size="sm"
                  onClick={() => setPage(pn)}
                  className={`h-7 w-7 p-0 text-xs ${pn===page ? "bg-primary text-white" : ""}`}
                >{pn}</Button>
              );
            })}
            <Button
              variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p+1))} disabled={page===totalPages}
              className="h-7 w-7 p-0 text-xs"
            >›</Button>
            <Button
              variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page===totalPages}
              className="h-7 w-7 p-0 text-xs"
            >»</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
