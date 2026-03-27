import React, { useState, useMemo, useEffect } from "react";
import { Download, Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FICARow = {
  carrera: string;
  carreraFull: string;
  cod: string;
  ciclo: string;
  seccion: string;
  turno: string;
  local: string;
  modalidad: string;
  tipo: string;
  dia: string;
  hora: string;
  horaFin: string;
  curso: string;
  docente: string;
  horas: number;
};

const CARRERA_NAMES: Record<string, string> = {
  "ADM. EMPRESAS":  "Administración de Empresas",
  "ADM. Y FINANZAS":"Administración y Finanzas",
  "ARQUITECTURA":   "Arquitectura",
  "CONTABILIDAD":   "Contabilidad",
  "DERECHO":        "Derecho",
  "ING. CIVIL":     "Ingeniería Civil",
  "ING. INDUSTRIAL":"Ingeniería Industrial",
  "ING. SISTEMAS":  "Ingeniería de Sistemas",
};

const CARRERA_COLORS: Record<string, string> = {
  "ADM. EMPRESAS":  "#1a5a6b",
  "ADM. Y FINANZAS":"#15607a",
  "ARQUITECTURA":   "#4a1a7a",
  "CONTABILIDAD":   "#6b4a00",
  "DERECHO":        "#6b1a1a",
  "ING. CIVIL":     "#7a3a00",
  "ING. INDUSTRIAL":"#1a6b3a",
  "ING. SISTEMAS":  "#2f5aa6",
};

const TURNO_COLORS: Record<string, string> = {
  DIURNO: "bg-green-100 text-green-700 border-green-200",
  NOCHE: "bg-indigo-100 text-indigo-700 border-indigo-200",
  HÍBRIDO: "bg-amber-100 text-amber-700 border-amber-200",
  VIRTUAL: "bg-blue-100 text-blue-700 border-blue-200",
  MAÑANA: "bg-sky-100 text-sky-700 border-sky-200",
};

const DIA_ORDER = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

const PAGE_SIZE = 60;

export default function PlanificacionFICA() {
  const [data, setData] = useState<FICARow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [fCarrera, setFCarrera] = useState("all");
  const [fCiclo, setFCiclo] = useState("all");
  const [fSeccion, setFSeccion] = useState("all");
  const [fTurno, setFTurno] = useState("all");
  const [fDocente, setFDocente] = useState("");
  const [fCurso, setFCurso] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}planificacion-fica-2026-1.json`)
      .then((r) => r.json())
      .then((d: FICARow[]) => {
        d.sort((a, b) => {
          const c = a.carrera.localeCompare(b.carrera, "es");
          if (c !== 0) return c;
          const ci = Number(a.ciclo) - Number(b.ciclo);
          if (ci !== 0) return ci;
          const s = a.seccion.localeCompare(b.seccion, "es");
          if (s !== 0) return s;
          const dA = DIA_ORDER.indexOf(a.dia);
          const dB = DIA_ORDER.indexOf(b.dia);
          if (dA !== dB) return dA - dB;
          return a.hora.localeCompare(b.hora);
        });
        setData(d);
        setLoading(false);
      });
  }, []);

  const carreras = useMemo(() => [...new Set(data.map((r) => r.carrera))].sort(), [data]);
  const ciclos = useMemo(() => [...new Set(data.map((r) => r.ciclo).filter(Boolean))].sort((a, b) => Number(a) - Number(b)), [data]);
  const secciones = useMemo(() => [...new Set(data.map((r) => r.seccion))].sort(), [data]);
  const turnos = useMemo(() => [...new Set(data.map((r) => r.turno))].sort(), [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (fCarrera !== "all") rows = rows.filter((r) => r.carrera === fCarrera);
    if (fCiclo !== "all") rows = rows.filter((r) => String(r.ciclo) === fCiclo);
    if (fSeccion !== "all") rows = rows.filter((r) => r.seccion === fSeccion);
    if (fTurno !== "all") rows = rows.filter((r) => r.turno === fTurno);
    if (fDocente.trim()) {
      const q = fDocente.toLowerCase();
      rows = rows.filter((r) => (r.docente || "").toLowerCase().includes(q));
    }
    if (fCurso.trim()) {
      const q = fCurso.toLowerCase();
      rows = rows.filter((r) => (r.curso || "").toLowerCase().includes(q));
    }
    return rows;
  }, [data, fCarrera, fCiclo, fSeccion, fTurno, fDocente, fCurso]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetFilters = () => {
    setFCarrera("all");
    setFCiclo("all");
    setFSeccion("all");
    setFTurno("all");
    setFDocente("");
    setFCurso("");
    setPage(1);
  };

  const hasFilters =
    fCarrera !== "all" || fCiclo !== "all" || fSeccion !== "all" ||
    fTurno !== "all" || fDocente.trim() !== "" || fCurso.trim() !== "";

  const handleFilterChange = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const exportCSV = () => {
    const headers = ["Carrera", "Carrera Completa", "Ciclo", "Sección", "Turno", "Local", "Día", "Hora Inicio", "Hora Fin", "Tipo", "Horas", "Curso", "Docente"];
    const rows = filtered.map((r) => [
      r.carrera, r.carreraFull, r.ciclo, r.seccion, r.turno, r.local,
      r.dia, r.hora, r.horaFin, r.tipo, r.horas, r.curso, r.docente,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "planificacion-fica-2026-1.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Planificación Académica — FICA
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Facultad de Ingeniería, Ciencias y Administración · Semestre 2026-1
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2 shrink-0">
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="w-4 h-4 text-primary" />
          Filtros
        </div>

        {/* Row 1: dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Carrera */}
          <Select value={fCarrera} onValueChange={(v) => handleFilterChange(() => setFCarrera(v))}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Carrera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las carreras</SelectItem>
              {carreras.map((c) => (
                <SelectItem key={c} value={c}>{CARRERA_NAMES[c] || c} ({c})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Ciclo */}
          <Select value={fCiclo} onValueChange={(v) => handleFilterChange(() => setFCiclo(v))}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Ciclo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los ciclos</SelectItem>
              {ciclos.map((c) => (
                <SelectItem key={c} value={String(c)}>Ciclo {c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sección */}
          <Select value={fSeccion} onValueChange={(v) => handleFilterChange(() => setFSeccion(v))}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Sección" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las secciones</SelectItem>
              {secciones.map((s) => (
                <SelectItem key={s} value={s}>Sección {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Turno */}
          <Select value={fTurno} onValueChange={(v) => handleFilterChange(() => setFTurno(v))}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los turnos</SelectItem>
              {turnos.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: text searches */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por docente..."
              value={fDocente}
              onChange={(e) => handleFilterChange(() => setFDocente(e.target.value))}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por curso..."
              value={fCurso}
              onChange={(e) => handleFilterChange(() => setFCurso(e.target.value))}
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </span>
            <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <X className="w-3 h-3" />
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">#</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Carrera</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Ciclo</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Sec.</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Turno</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Día</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Hora</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Tipo</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">H.</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap min-w-[200px]">Curso</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap min-w-[180px]">Docente</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-muted-foreground">
                        No se encontraron registros con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`border-t border-border/50 hover:bg-primary/5 transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-muted/20"
                        }`}
                      >
                        <td className="px-3 py-2 text-muted-foreground font-mono">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge
                            className="text-[10px] font-semibold px-1.5 py-0"
                            style={{ background: CARRERA_COLORS[row.carrera] ?? "#555", color: "#fff" }}
                          >
                            {row.carrera}
                          </Badge>
                          <span className="text-muted-foreground ml-1.5">
                            {CARRERA_NAMES[row.carrera] ?? row.carreraFull}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">{row.ciclo ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-center">{row.seccion}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium px-1.5 py-0 ${TURNO_COLORS[row.turno] ?? ""}`}
                          >
                            {row.turno}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{row.dia}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                          {row.hora}{row.horaFin ? ` – ${row.horaFin}` : ""}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.tipo && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              row.tipo === "T" ? "bg-blue-100 text-blue-700" :
                              row.tipo === "TP" ? "bg-purple-100 text-purple-700" :
                              "bg-green-100 text-green-700"
                            }`}>{row.tipo}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-primary">
                          {row.horas > 0 ? row.horas : "—"}
                        </td>
                        <td className="px-3 py-2 font-medium max-w-[240px]">
                          <span className="line-clamp-2">{row.curso}</span>
                        </td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <span className="line-clamp-1">{row.docente || "—"}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} · {filtered.length} registros
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="h-7 px-2 text-xs">«</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-7 px-2 text-xs">‹</Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <Button key={pageNum} variant={page === pageNum ? "default" : "outline"} size="sm" onClick={() => setPage(pageNum)} className="h-7 w-7 p-0 text-xs">
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 px-2 text-xs">›</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="h-7 px-2 text-xs">»</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
