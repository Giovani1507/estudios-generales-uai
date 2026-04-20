import { useEffect, useMemo, useState } from "react";
import { Search, ClipboardList, Loader2, Users, BookOpen, ChevronRight, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeccionPlanillaDialog, type SeccionCtx } from "@/components/seccion-planilla-dialog";

type Row = {
  carrera: string; carreraFull: string; ciclo: string; seccion: string;
  codigo: string; curso: string; docente: string;
};

const FACULTADES = [
  { key: "FICA" as const, file: "planificacion-fica-2026-1.json", label: "FICA · Estudios Generales" },
  { key: "FCS"  as const, file: "planificacion-fcs-2026-1.json",  label: "FCS · Ciencias de la Salud" },
];

type PlanillaSummary = {
  carrera: string | null;
  ciclo: string | null;
  seccion: string | null;
  totalAlumnos: number;
};

type SeccionAgg = {
  carrera: string;
  carreraFull: string;
  ciclo: string;
  seccion: string;
  cursosCount: number;
  alumnosCount: number;
};

type CarreraAgg = {
  facultad: "FICA" | "FCS";
  carrera: string;
  carreraFull: string;
  totalCursos: number;
  totalAlumnos: number;
  secciones: SeccionAgg[];
};

export default function PlanillasAsistencia() {
  const [data, setData] = useState<{ row: Row; facultad: "FICA" | "FCS" }[]>([]);
  const [planillaCounts, setPlanillaCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [facultadFilter, setFacultadFilter] = useState<"TODAS" | "FICA" | "FCS">("TODAS");
  const [openCarrera, setOpenCarrera] = useState<string | null>(null);
  const [activeSeccion, setActiveSeccion] = useState<SeccionCtx | null>(null);

  const loadCounts = async () => {
    try {
      const r = await fetch(`${(import.meta.env.BASE_URL || "").replace(/\/$/, "")}/api/asistencia-planillas`, { credentials: "include" });
      if (!r.ok) return;
      const list = (await r.json()) as PlanillaSummary[];
      const m = new Map<string, number>();
      for (const p of list) {
        if (!p.carrera || !p.ciclo || !p.seccion) continue;
        const k = `${p.carrera}|${p.ciclo}|${p.seccion}`;
        m.set(k, Math.max(m.get(k) || 0, p.totalAlumnos || 0));
      }
      setPlanillaCounts(m);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
        const all: { row: Row; facultad: "FICA" | "FCS" }[] = [];
        for (const f of FACULTADES) {
          try {
            const r = await fetch(`${base}/${f.file}`);
            if (!r.ok) continue;
            const arr = (await r.json()) as Row[];
            arr.forEach((row) => all.push({ row, facultad: f.key }));
          } catch { /* ignore */ }
        }
        setData(all);
        await loadCounts();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const carreras = useMemo<CarreraAgg[]>(() => {
    const map = new Map<string, CarreraAgg>();
    const seenCursos = new Map<string, Set<string>>(); // key carrera → set of "ciclo|seccion|codigo"

    for (const { row, facultad } of data) {
      if (facultadFilter !== "TODAS" && facultad !== facultadFilter) continue;
      const key = `${facultad}|${row.carrera}`;
      if (!map.has(key)) {
        map.set(key, {
          facultad,
          carrera: row.carrera,
          carreraFull: row.carreraFull || row.carrera,
          totalCursos: 0,
          totalAlumnos: 0,
          secciones: [],
        });
        seenCursos.set(key, new Set());
      }
      const dedup = seenCursos.get(key)!;
      const cursoKey = `${row.ciclo}|${row.seccion}|${row.codigo}`;
      if (!dedup.has(cursoKey)) dedup.add(cursoKey);
    }

    // Build secciones
    const secMap = new Map<string, SeccionAgg & { _carreraKey: string; _cursoSet: Set<string> }>();
    for (const { row, facultad } of data) {
      if (facultadFilter !== "TODAS" && facultad !== facultadFilter) continue;
      const carreraKey = `${facultad}|${row.carrera}`;
      const secKey = `${facultad}|${row.carrera}|${row.ciclo}|${row.seccion}`;
      if (!secMap.has(secKey)) {
        secMap.set(secKey, {
          _carreraKey: carreraKey,
          _cursoSet: new Set(),
          carrera: row.carrera,
          carreraFull: row.carreraFull || row.carrera,
          ciclo: row.ciclo,
          seccion: row.seccion,
          cursosCount: 0,
          alumnosCount: planillaCounts.get(`${row.carrera}|${row.ciclo}|${row.seccion}`) || 0,
        });
      }
      secMap.get(secKey)!._cursoSet.add(row.codigo);
    }
    secMap.forEach((s) => {
      s.cursosCount = s._cursoSet.size;
      const c = map.get(s._carreraKey);
      if (c) c.secciones.push({
        carrera: s.carrera, carreraFull: s.carreraFull, ciclo: s.ciclo, seccion: s.seccion,
        cursosCount: s.cursosCount, alumnosCount: s.alumnosCount,
      });
    });

    map.forEach((c) => {
      c.secciones.sort((a, b) => {
        const ci = Number(a.ciclo) - Number(b.ciclo);
        if (ci !== 0) return ci;
        return a.seccion.localeCompare(b.seccion);
      });
      c.totalCursos = c.secciones.reduce((acc, s) => acc + s.cursosCount, 0);
      c.totalAlumnos = c.secciones.reduce((acc, s) => acc + s.alumnosCount, 0);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.facultad !== b.facultad) return a.facultad.localeCompare(b.facultad);
      return a.carreraFull.localeCompare(b.carreraFull, "es");
    });
  }, [data, facultadFilter, planillaCounts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return carreras;
    return carreras.filter((c) =>
      c.carrera.toLowerCase().includes(q) ||
      c.carreraFull.toLowerCase().includes(q),
    );
  }, [carreras, search]);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          Planillas de Asistencia
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Navega por carrera y sección. Para cada sección puedes registrar manualmente la lista de alumnos y marcar la asistencia.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar carrera…"
            className="pl-8 h-9"
            data-testid="input-search-carrera"
          />
        </div>
        <div className="flex items-center gap-1 border rounded-md p-0.5 bg-white">
          {(["TODAS", "FICA", "FCS"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFacultadFilter(f)}
              className={`px-3 h-8 text-xs font-medium rounded transition-colors ${
                facultadFilter === f
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
              data-testid={`button-filter-${f.toLowerCase()}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando carreras…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground border-2 border-dashed rounded">
          No hay carreras que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const key = `${c.facultad}|${c.carrera}`;
            const isOpen = openCarrera === key;
            return (
              <div key={key} className="bg-white rounded-lg border border-border/50 shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenCarrera(isOpen ? null : key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  data-testid={`button-carrera-${c.carrera}`}
                >
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <span className="uppercase">{c.carreraFull}</span>
                      <Badge variant="outline" className="text-[10px]">{c.facultad}</Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">{c.carrera}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.secciones.length} secciones · {c.totalCursos} cursos · {c.totalAlumnos} alumnos registrados
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t bg-muted/20 px-4 py-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {c.secciones.map((s) => {
                        const sk = `${c.facultad}|${s.carrera}|${s.ciclo}|${s.seccion}`;
                        return (
                          <button
                            key={sk}
                            onClick={() => setActiveSeccion({
                              facultad: c.facultad,
                              carrera: s.carrera,
                              carreraFull: s.carreraFull,
                              ciclo: s.ciclo,
                              seccion: s.seccion,
                              cursosCount: s.cursosCount,
                            })}
                            className="bg-white rounded border border-border hover:border-primary hover:shadow-md transition-all p-3 text-left flex flex-col gap-1.5"
                            data-testid={`button-seccion-${s.carrera}-${s.ciclo}${s.seccion}`}
                          >
                            <div className="flex items-center justify-between">
                              <Badge className="bg-primary/10 text-primary border-primary/20 font-mono text-[11px]">
                                Ciclo {s.ciclo} · {s.seccion}
                              </Badge>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <BookOpen className="h-3 w-3" />
                                <span className="font-semibold text-foreground">{s.cursosCount}</span> cursos
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Users className="h-3 w-3" />
                                <span className="font-semibold text-foreground">{s.alumnosCount}</span> alumnos
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeSeccion && (
        <SeccionPlanillaDialog
          open={!!activeSeccion}
          ctx={activeSeccion}
          onClose={() => setActiveSeccion(null)}
          onSaved={loadCounts}
        />
      )}
    </div>
  );
}
