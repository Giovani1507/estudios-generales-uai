import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Search, Users } from "lucide-react";

interface FICARow {
  carrera: string;
  carreraFull: string;
  ciclo: number | null;
  seccion: string;
  turno: string;
  dia: string;
  hora: string;
  curso: string;
  docente: string | null;
}

interface DocenteRow {
  docente: string;
  carreras: string[];
  ciclos: number[];
  secciones: string[];
  cursos: string[];
  sesiones: number;
}

const CARRERA_LABELS: Record<string, string> = {
  IS: "Ing. de Sistemas",
  IN: "Ing. Industrial",
  IC: "Ing. Civil",
  DE: "Derecho",
  AR: "Arquitectura",
  AE: "Adm. de Empresa",
};

const CARRERA_COLORS: Record<string, string> = {
  IS: "#2f5aa6",
  IN: "#1a6b3a",
  IC: "#7a3a00",
  DE: "#6b1a1a",
  AR: "#4a1a7a",
  AE: "#1a5a6b",
};

const PAGE_SIZE = 50;

export default function ListaDocentesFICA() {
  const [allData, setAllData] = useState<FICARow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fCarrera, setFCarrera] = useState("all");
  const [fTurno, setFTurno] = useState("all");
  const [fBusqueda, setFBusqueda] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}planificacion-fica-2026-1.json`)
      .then((r) => r.json())
      .then((data: FICARow[]) => {
        setAllData(data.filter((r) => r.docente));
        setLoading(false);
      })
      .catch(() => {
        setError("No se pudo cargar los datos FICA.");
        setLoading(false);
      });
  }, []);

  const carreras = useMemo(() => {
    return [...new Set(allData.map((r) => r.carrera))].sort();
  }, [allData]);

  const turnos = useMemo(() => {
    return [...new Set(allData.map((r) => r.turno))].sort();
  }, [allData]);

  const sourceData = useMemo(() => {
    return allData.filter((r) => {
      if (fCarrera !== "all" && r.carrera !== fCarrera) return false;
      if (fTurno !== "all" && r.turno !== fTurno) return false;
      return true;
    });
  }, [allData, fCarrera, fTurno]);

  const docentes = useMemo((): DocenteRow[] => {
    const map = new Map<string, DocenteRow>();
    sourceData.forEach((r) => {
      if (!r.docente) return;
      if (!map.has(r.docente)) {
        map.set(r.docente, {
          docente: r.docente,
          carreras: [],
          ciclos: [],
          secciones: [],
          cursos: [],
          sesiones: 0,
        });
      }
      const entry = map.get(r.docente)!;
      if (!entry.carreras.includes(r.carrera)) entry.carreras.push(r.carrera);
      if (r.ciclo !== null && !entry.ciclos.includes(r.ciclo)) entry.ciclos.push(r.ciclo);
      const sec = `${r.carrera}-${r.ciclo}${r.seccion}`;
      if (!entry.secciones.includes(sec)) entry.secciones.push(sec);
      if (!entry.cursos.includes(r.curso)) entry.cursos.push(r.curso);
      entry.sesiones += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.docente.localeCompare(b.docente));
  }, [sourceData]);

  const handleFilterChange = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!fBusqueda) return docentes;
    const q = fBusqueda.toLowerCase();
    return docentes.filter((d) => d.docente.toLowerCase().includes(q));
  }, [docentes, fBusqueda]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCSV = () => {
    const headers = ["N°", "Docente", "Carrera(s)", "Ciclo(s)", "Secciones", "Cursos", "Sesiones semanales"];
    const rows = filtered.map((d, i) => [
      i + 1,
      d.docente,
      d.carreras.sort().map((c) => CARRERA_LABELS[c] ?? c).join("; "),
      d.ciclos.sort().join(", "),
      d.secciones.sort().join(", "),
      d.cursos.join("; "),
      d.sesiones,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lista-docentes-fica-ciclos-1-2-2026-1.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-primary">Lista de Docentes</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            FICA · Ciclos 1 y 2 · Semestre 2026-1 ·{" "}
            <span className="font-semibold text-foreground">{filtered.length}</span> docentes
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2 rounded-xl text-sm">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-muted/40 rounded-xl border border-border/50">
        {/* Carrera */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Carrera</label>
          <select
            value={fCarrera}
            onChange={(e) => handleFilterChange(() => setFCarrera(e.target.value))}
            className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm"
          >
            <option value="all">Todas las carreras</option>
            {carreras.map((c) => (
              <option key={c} value={c}>{CARRERA_LABELS[c] ?? c} ({c})</option>
            ))}
          </select>
        </div>

        {/* Turno */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Turno</label>
          <select
            value={fTurno}
            onChange={(e) => handleFilterChange(() => setFTurno(e.target.value))}
            className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm"
          >
            <option value="all">Todos los turnos</option>
            {turnos.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Búsqueda */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Búsqueda</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Nombre del docente…"
              value={fBusqueda}
              onChange={(e) => handleFilterChange(() => setFBusqueda(e.target.value))}
              className="pl-8 h-9 text-sm rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-white text-xs uppercase tracking-wide">
                <th className="px-3 py-3 text-center w-10">N°</th>
                <th className="px-3 py-3 text-left">Docente</th>
                <th className="px-3 py-3 text-center">Carrera(s)</th>
                <th className="px-3 py-3 text-center">Ciclo(s)</th>
                <th className="px-3 py-3 text-left">Secciones</th>
                <th className="px-3 py-3 text-left">Cursos asignados</th>
                <th className="px-3 py-3 text-center">Sesiones</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No se encontraron docentes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginated.map((d, i) => {
                  const globalIdx = (page - 1) * PAGE_SIZE + i + 1;
                  return (
                    <tr
                      key={d.docente}
                      className={`border-t border-border/40 hover:bg-blue-50/50 transition-colors ${
                        i % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center text-muted-foreground font-mono text-xs">{globalIdx}</td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{d.docente}</td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {d.carreras.sort().map((c) => (
                            <Badge
                              key={c}
                              className="text-xs px-1.5 py-0 font-mono"
                              style={{ background: CARRERA_COLORS[c] ?? "#555", color: "#fff" }}
                            >
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {d.ciclos.sort().map((c) => (
                            <Badge
                              key={c}
                              className="text-xs px-1.5 py-0"
                              style={{ background: c === 1 ? "#2f5aa6" : "#1a3a6b", color: "#fff" }}
                            >
                              {c}°
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        <div className="flex gap-1 flex-wrap">
                          {d.secciones.sort().map((s) => (
                            <Badge key={s} variant="outline" className="text-xs px-1.5 py-0 font-mono">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs">
                        <span className="line-clamp-2" title={d.cursos.join(", ")}>
                          {d.cursos.join(", ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-xs">{d.sesiones}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="h-8 w-8 p-0 rounded-lg">‹</Button>
            <span className="flex items-center px-3 text-sm font-medium">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="h-8 w-8 p-0 rounded-lg">›</Button>
          </div>
        </div>
      )}
    </div>
  );
}
