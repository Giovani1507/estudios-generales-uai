import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, GraduationCap, BookOpen, Users, ChevronRight, ClipboardCheck, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type PlanillaSummary = {
  id: number;
  docente: string | null;
  carrera: string | null;
  carreraFull?: string | null;
  ciclo: string | null;
  seccion: string | null;
  codigoCurso: string | null;
  nombreCurso: string | null;
  encabezadoCrudo: string | null;
  modalidad: string | null;
  totalAlumnos: number;
  updatedAt: string;
};

type Alumno = { numero: string; nombre: string; marcas: string[]; porcentaje: number };

type PlanillaDetail = PlanillaSummary & {
  alumnos: Alumno[];
};

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

/* Mapeo carrera → nombre completo desde la planificación, para no depender del campo opcional */
async function loadCarreraFullMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  for (const file of ["planificacion-fica-2026-1.json", "planificacion-fcs-2026-1.json"]) {
    try {
      const r = await fetch(`${base}/${file}`);
      if (!r.ok) continue;
      const arr = (await r.json()) as Array<{ carrera: string; carreraFull?: string }>;
      for (const row of arr) {
        if (row.carrera && row.carreraFull && !map.has(row.carrera)) {
          map.set(row.carrera, row.carreraFull);
        }
      }
    } catch { /* ignore */ }
  }
  return map;
}

export default function ResultadosPlanillas() {
  const [planillas, setPlanillas] = useState<PlanillaSummary[]>([]);
  const [carreraFull, setCarreraFull] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openCarrera, setOpenCarrera] = useState<string | null>(null);
  const [openCurso, setOpenCurso] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Map<number, PlanillaDetail>>(new Map());
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [resp, fullMap] = await Promise.all([
          fetch(`${apiBase}/api/asistencia-planillas`, { credentials: "include" }),
          loadCarreraFullMap(),
        ]);
        if (resp.ok) setPlanillas((await resp.json()) as PlanillaSummary[]);
        setCarreraFull(fullMap);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    type CursoGroup = {
      codigo: string;
      nombre: string;
      planillas: PlanillaSummary[];
    };
    type CarreraGroup = {
      carrera: string;
      carreraFull: string;
      cursos: Map<string, CursoGroup>;
      totalAlumnos: number;
    };
    const carrMap = new Map<string, CarreraGroup>();
    for (const p of planillas) {
      const cKey = p.carrera || "—";
      if (!carrMap.has(cKey)) {
        carrMap.set(cKey, {
          carrera: cKey,
          carreraFull: carreraFull.get(cKey) || cKey,
          cursos: new Map(),
          totalAlumnos: 0,
        });
      }
      const cg = carrMap.get(cKey)!;
      const codigo = p.codigoCurso || "—";
      if (!cg.cursos.has(codigo)) {
        cg.cursos.set(codigo, { codigo, nombre: p.nombreCurso || codigo, planillas: [] });
      }
      cg.cursos.get(codigo)!.planillas.push(p);
      cg.totalAlumnos += p.totalAlumnos || 0;
    }
    return Array.from(carrMap.values())
      .map(g => ({
        ...g,
        cursosArr: Array.from(g.cursos.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      }))
      .sort((a, b) => a.carreraFull.localeCompare(b.carreraFull, "es"));
  }, [planillas, carreraFull]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return grouped;
    return grouped
      .map(g => ({
        ...g,
        cursosArr: g.cursosArr.filter(c =>
          c.nombre.toLowerCase().includes(q) ||
          c.codigo.toLowerCase().includes(q) ||
          c.planillas.some(p => (p.docente || "").toLowerCase().includes(q)),
        ),
      }))
      .filter(g =>
        g.carrera.toLowerCase().includes(q) ||
        g.carreraFull.toLowerCase().includes(q) ||
        g.cursosArr.length > 0,
      );
  }, [grouped, search]);

  const loadDetail = async (id: number) => {
    if (detailById.has(id)) return;
    setLoadingDetail(id);
    try {
      const r = await fetch(`${apiBase}/api/asistencia-planillas/${id}`, { credentials: "include" });
      if (!r.ok) return;
      const d = (await r.json()) as PlanillaDetail;
      setDetailById(prev => new Map(prev).set(id, d));
    } finally {
      setLoadingDetail(null);
    }
  };

  const totalPlanillas = planillas.length;
  const totalAlumnosGlobal = planillas.reduce((acc, p) => acc + (p.totalAlumnos || 0), 0);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Resultados de Planillas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todas las planillas subidas, organizadas por carrera y curso. Despliega un curso para ver al docente y a sus estudiantes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">{totalPlanillas} planillas</Badge>
          <Badge variant="outline" className="text-xs">{totalAlumnosGlobal} alumnos</Badge>
          <Badge variant="outline" className="text-xs">{filtered.length} carreras</Badge>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por carrera, curso o docente…"
          className="pl-8 h-9"
          data-testid="input-search-resultados"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando resultados…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground border-2 border-dashed rounded">
          {totalPlanillas === 0
            ? "Aún no hay planillas subidas. Importa un Excel desde la sección 'Planillas de Asistencia'."
            : "No hay coincidencias para tu búsqueda."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => {
            const isOpen = openCarrera === g.carrera;
            return (
              <div key={g.carrera} className="bg-white rounded-lg border border-border/50 shadow-sm overflow-hidden">
                <button
                  onClick={() => { setOpenCarrera(isOpen ? null : g.carrera); setOpenCurso(null); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  data-testid={`button-resultado-carrera-${g.carrera}`}
                >
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                      <span className="uppercase">{g.carreraFull}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{g.carrera}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {g.cursosArr.length} cursos · {g.totalAlumnos} alumnos
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t bg-muted/10">
                    {g.cursosArr.map((c) => {
                      const cursoKey = `${g.carrera}|${c.codigo}`;
                      const cursoOpen = openCurso === cursoKey;
                      return (
                        <div key={cursoKey} className="border-b last:border-b-0">
                          <button
                            onClick={() => setOpenCurso(cursoOpen ? null : cursoKey)}
                            className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors text-left"
                            data-testid={`button-resultado-curso-${c.codigo}`}
                          >
                            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${cursoOpen ? "rotate-90" : ""}`} />
                            <BookOpen className="h-4 w-4 text-primary/70 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px] font-mono">{c.codigo}</Badge>
                                <span>{c.nombre}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                                {c.planillas.map((p) => (
                                  <span key={p.id} className="inline-flex items-center gap-1">
                                    <UserIcon className="h-3 w-3" />
                                    {p.docente || "—"}
                                    {p.seccion && <span className="font-mono text-muted-foreground">· {p.seccion}</span>}
                                    <Badge variant="outline" className="text-[9px] gap-1 ml-1">
                                      <Users className="h-2.5 w-2.5" />{p.totalAlumnos}
                                    </Badge>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </button>

                          {cursoOpen && (
                            <div className="px-5 pb-3 pt-0 space-y-3 bg-white">
                              {c.planillas.map((p) => {
                                const detail = detailById.get(p.id);
                                return (
                                  <div key={p.id} className="border rounded-md overflow-hidden">
                                    <div
                                      className="bg-primary/5 px-3 py-2 text-xs flex items-center justify-between cursor-pointer hover:bg-primary/10"
                                      onClick={() => loadDetail(p.id)}
                                      data-testid={`button-load-detail-${p.id}`}
                                    >
                                      <div>
                                        <div className="font-semibold text-primary">
                                          {p.docente || "—"}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                                          {p.seccion && <span>Sección {p.seccion}</span>}
                                          {p.ciclo && <span>· Ciclo {p.ciclo}</span>}
                                          {p.modalidad && <span>· {p.modalidad}</span>}
                                          <span>· {p.totalAlumnos} alumnos</span>
                                          <span>· Actualizado {new Date(p.updatedAt).toLocaleString("es-PE")}</span>
                                        </div>
                                      </div>
                                      {loadingDetail === p.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                    </div>
                                    {detail ? (
                                      <div className="max-h-[40vh] overflow-auto">
                                        <table className="w-full text-[11px]">
                                          <thead className="bg-muted/40 sticky top-0">
                                            <tr>
                                              <th className="px-2 py-1.5 text-left w-10">#</th>
                                              <th className="px-2 py-1.5 text-left">Apellidos y Nombres</th>
                                              <th className="px-2 py-1.5 text-right w-24">% Asist.</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {detail.alumnos.length === 0 ? (
                                              <tr>
                                                <td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">
                                                  Sin alumnos en esta planilla.
                                                </td>
                                              </tr>
                                            ) : (
                                              detail.alumnos.map((a, i) => (
                                                <tr key={i} className={i % 2 ? "bg-muted/20" : ""}>
                                                  <td className="px-2 py-1 font-mono text-muted-foreground">{a.numero}</td>
                                                  <td className="px-2 py-1">{a.nombre}</td>
                                                  <td className="px-2 py-1 text-right font-bold">{(a.porcentaje || 0).toFixed(2)}%</td>
                                                </tr>
                                              ))
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <div className="px-3 py-2 text-[11px] text-muted-foreground">
                                        Click para ver la lista de estudiantes.
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
