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

type PlanRow = {
  semestre: string;
  local: string;
  facultad: string;
  programa: string;
  ciclo: number;
  seccion: string;
  codigo: string;
  curso: string;
  tipoEstudios: string;
  tipoCurso: string;
  modalidad: string;
  hTeoria: number;
  hPractica: number;
  totalHoras: number;
  creditos: number;
  vacantes: number;
  dniDocente: number;
  docente: string;
  turno: string;
  aula: string;
};

const PROG_NAMES: Record<string, string> = {
  EN: "Enfermería",
  OB: "Obstetricia",
  PS: "Psicología",
  MH: "Medicina Humana",
  T1: "Tec. Médica (I)",
  T2: "Tec. Médica (II)",
  T3: "Tec. Médica (III)",
  T4: "Tec. Médica (IV)",
};

const PAGE_SIZE = 50;

export default function PlanificacionFCS() {
  const [data, setData] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [fLocal, setFLocal] = useState("all");
  const [fPrograma, setFPrograma] = useState("all");
  const [fCiclo, setFCiclo] = useState("all");
  const [fModalidad, setFModalidad] = useState("all");
  const [fBusqueda, setFBusqueda] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}planificacion-fcs-2026-1.json`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const locals = useMemo(() => [...new Set(data.map((r) => r.local))].sort(), [data]);
  const programs = useMemo(() => [...new Set(data.map((r) => r.programa))].sort(), [data]);
  const ciclos = useMemo(() => [...new Set(data.map((r) => r.ciclo))].filter(Boolean).sort((a, b) => a - b), [data]);
  const modalities = useMemo(
    () => [...new Set(data.map((r) => (r.modalidad || "").toLowerCase()))].filter(Boolean).sort(),
    [data]
  );

  const filtered = useMemo(() => {
    let rows = data;
    if (fLocal !== "all") rows = rows.filter((r) => r.local === fLocal);
    if (fPrograma !== "all") rows = rows.filter((r) => r.programa === fPrograma);
    if (fCiclo !== "all") rows = rows.filter((r) => String(r.ciclo) === fCiclo);
    if (fModalidad !== "all") rows = rows.filter((r) => (r.modalidad || "").toLowerCase() === fModalidad);
    if (fBusqueda.trim()) {
      const q = fBusqueda.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.docente || "").toLowerCase().includes(q) ||
          (r.curso || "").toLowerCase().includes(q) ||
          (r.codigo || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, fLocal, fPrograma, fCiclo, fModalidad, fBusqueda]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetFilters = () => {
    setFLocal("all");
    setFPrograma("all");
    setFCiclo("all");
    setFModalidad("all");
    setFBusqueda("");
    setPage(1);
  };

  const hasFilters =
    fLocal !== "all" || fPrograma !== "all" || fCiclo !== "all" || fModalidad !== "all" || fBusqueda.trim() !== "";

  const handleFilterChange = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const exportCSV = () => {
    const headers = [
      "Local","Programa","Ciclo","Sección","Código","Curso","Tipo Estudios",
      "Modalidad","H.Teoría","H.Práctica","Total Horas","Créditos","Vacantes",
      "DNI Docente","Docente","Turno","Aula",
    ];
    const rows = filtered.map((r) => [
      r.local, PROG_NAMES[r.programa] || r.programa, r.ciclo, r.seccion,
      r.codigo, r.curso, r.tipoEstudios, r.modalidad, r.hTeoria, r.hPractica,
      r.totalHoras, r.creditos, r.vacantes, r.dniDocente, r.docente, r.turno, r.aula,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "planificacion-fcs-2026-1.csv";
    a.click();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Planificación Académica — FCS
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Facultad de Ciencias de la Salud · Semestre 2026-1
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Local */}
          <Select value={fLocal} onValueChange={(v) => handleFilterChange(() => setFLocal(v))}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Local" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los locales</SelectItem>
              {locals.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Programa */}
          <Select value={fPrograma} onValueChange={(v) => handleFilterChange(() => setFPrograma(v))}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Programa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los programas</SelectItem>
              {programs.map((p) => (
                <SelectItem key={p} value={p}>{PROG_NAMES[p] || p} ({p})</SelectItem>
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

          {/* Modalidad */}
          <Select value={fModalidad} onValueChange={(v) => handleFilterChange(() => setFModalidad(v))}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Modalidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las modalidades</SelectItem>
              {modalities.map((m) => (
                <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar docente o curso..."
              value={fBusqueda}
              onChange={(e) => handleFilterChange(() => setFBusqueda(e.target.value))}
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
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Local</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Programa</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Ciclo</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Sección</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Código</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap min-w-[200px]">Curso</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Tipo</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Modalidad</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">H.T.</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">H.P.</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">T.H.</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Créd.</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Vac.</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap min-w-[200px]">Docente</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Turno</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Aula</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="text-center py-12 text-muted-foreground">
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
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0">
                            {row.local}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="font-semibold text-primary">{row.programa}</span>
                          <span className="text-muted-foreground ml-1">
                            {PROG_NAMES[row.programa] ? `· ${PROG_NAMES[row.programa]}` : ""}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">{row.ciclo}</td>
                        <td className="px-3 py-2 font-mono text-center">{row.seccion}</td>
                        <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{row.codigo}</td>
                        <td className="px-3 py-2 font-medium max-w-[240px]">
                          <span className="line-clamp-2">{row.curso}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium px-1.5 py-0"
                          >
                            {row.tipoEstudios}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            className={`text-[10px] font-medium px-1.5 py-0 ${
                              (row.modalidad || "").toLowerCase() === "presencial"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-blue-100 text-blue-700 border-blue-200"
                            }`}
                            variant="outline"
                          >
                            {row.modalidad}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center">{row.hTeoria ?? "-"}</td>
                        <td className="px-3 py-2 text-center">{row.hPractica ?? "-"}</td>
                        <td className="px-3 py-2 text-center font-semibold">{row.totalHoras ?? "-"}</td>
                        <td className="px-3 py-2 text-center font-semibold text-primary">{row.creditos ?? "-"}</td>
                        <td className="px-3 py-2 text-center">{row.vacantes ?? "-"}</td>
                        <td className="px-3 py-2 max-w-[220px]">
                          <span className="line-clamp-1 font-medium">{row.docente || "—"}</span>
                          {row.dniDocente && (
                            <span className="text-[10px] text-muted-foreground font-mono">{row.dniDocente}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.turno || "—"}</td>
                        <td className="px-3 py-2 text-[10px] text-muted-foreground max-w-[120px]">
                          <span className="line-clamp-2">{row.aula || "—"}</span>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="h-7 px-2 text-xs"
                  >
                    «
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-7 px-2 text-xs"
                  >
                    ‹
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="h-7 w-7 p-0 text-xs"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-7 px-2 text-xs"
                  >
                    ›
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="h-7 px-2 text-xs"
                  >
                    »
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
