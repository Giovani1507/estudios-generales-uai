import { useEffect, useMemo, useState } from "react";
import {
  Search, Loader2, GraduationCap, BookOpen, ChevronRight,
  ClipboardCheck, User as UserIcon, Download, Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ExcelJS from "exceljs";

type PlanRow = {
  carrera: string;
  carreraFull?: string;
  facultad?: string;
  ciclo: string;
  seccion: string;
  codigo: string;
  curso: string;
  docente?: string | null;
  modalidad?: string | null;
  horas?: number | null;
};

const PLAN_FILES = ["planificacion-fica-2026-1.json", "planificacion-fcs-2026-1.json"];

// Carreras a excluir (no existen en la planificación oficial)
const EXCLUDED_CARRERAS = new Set(["T3"]); // T3 = FARMACIA Y BIOQUÍMICA
// Ciclos permitidos
const ALLOWED_CICLOS = new Set(["1", "2"]);

async function loadPlanificacion(): Promise<PlanRow[]> {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const out: PlanRow[] = [];
  for (const f of PLAN_FILES) {
    try {
      const r = await fetch(`${base}/${f}`);
      if (!r.ok) continue;
      const arr = (await r.json()) as PlanRow[];
      for (const row of arr) {
        if (EXCLUDED_CARRERAS.has(row.carrera)) continue;
        if (!ALLOWED_CICLOS.has(String(row.ciclo))) continue;
        out.push(row);
      }
    } catch { /* ignore */ }
  }
  return out;
}

const cicloOrder = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 999 : n;
};

export default function ResultadosPlanillas() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [search, setSearch] = useState("");
  const [openCarrera, setOpenCarrera] = useState<string | null>(null);
  const [openCiclo, setOpenCiclo] = useState<string | null>(null);
  const [openSeccion, setOpenSeccion] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setRows(await loadPlanificacion());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Carrera → Ciclo → Sección → Cursos (únicos por código). */
  const grouped = useMemo(() => {
    type CursoItem = { codigo: string; curso: string; docentes: Set<string>; modalidad?: string | null; horas: number };
    type SeccionGroup = { seccion: string; cursos: Map<string, CursoItem> };
    type CicloGroup = { ciclo: string; secciones: Map<string, SeccionGroup> };
    type CarreraGroup = { carrera: string; carreraFull: string; ciclos: Map<string, CicloGroup> };

    const carrMap = new Map<string, CarreraGroup>();
    for (const p of rows) {
      const cKey = p.carrera || "—";
      if (!carrMap.has(cKey)) {
        carrMap.set(cKey, { carrera: cKey, carreraFull: p.carreraFull || cKey, ciclos: new Map() });
      }
      const cg = carrMap.get(cKey)!;
      if (p.carreraFull && !cg.carreraFull) cg.carreraFull = p.carreraFull;

      const iKey = p.ciclo || "—";
      if (!cg.ciclos.has(iKey)) cg.ciclos.set(iKey, { ciclo: iKey, secciones: new Map() });
      const ig = cg.ciclos.get(iKey)!;

      const sKey = p.seccion || "—";
      if (!ig.secciones.has(sKey)) ig.secciones.set(sKey, { seccion: sKey, cursos: new Map() });
      const sg = ig.secciones.get(sKey)!;

      const code = p.codigo || "—";
      if (!sg.cursos.has(code)) {
        sg.cursos.set(code, {
          codigo: code,
          curso: p.curso || code,
          docentes: new Set<string>(),
          modalidad: p.modalidad || null,
          horas: 0,
        });
      }
      const ci = sg.cursos.get(code)!;
      if (p.docente) ci.docentes.add(p.docente);
      if (p.horas && p.horas > ci.horas) ci.horas = p.horas;
    }

    return Array.from(carrMap.values())
      .map(g => ({
        ...g,
        ciclosArr: Array.from(g.ciclos.values())
          .map(ic => ({
            ...ic,
            seccionesArr: Array.from(ic.secciones.values())
              .map(sc => ({
                ...sc,
                cursosArr: Array.from(sc.cursos.values()).sort((a, b) => a.curso.localeCompare(b.curso, "es")),
              }))
              .sort((a, b) => a.seccion.localeCompare(b.seccion, "es")),
          }))
          .sort((a, b) => cicloOrder(a.ciclo) - cicloOrder(b.ciclo)),
      }))
      .sort((a, b) => a.carreraFull.localeCompare(b.carreraFull, "es"));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return grouped;
    return grouped
      .map(g => ({
        ...g,
        ciclosArr: g.ciclosArr
          .map(ic => ({
            ...ic,
            seccionesArr: ic.seccionesArr
              .map(sc => ({
                ...sc,
                cursosArr: sc.cursosArr.filter(c =>
                  c.curso.toLowerCase().includes(q) ||
                  c.codigo.toLowerCase().includes(q) ||
                  Array.from(c.docentes).some(d => d.toLowerCase().includes(q)),
                ),
              }))
              .filter(sc =>
                sc.cursosArr.length > 0 ||
                sc.seccion.toLowerCase().includes(q) ||
                `${ic.ciclo}.${sc.seccion}`.toLowerCase().includes(q),
              ),
          }))
          .filter(ic => ic.seccionesArr.length > 0 || ic.ciclo.toLowerCase().includes(q)),
      }))
      .filter(g =>
        g.carrera.toLowerCase().includes(q) ||
        g.carreraFull.toLowerCase().includes(q) ||
        g.ciclosArr.length > 0,
      );
  }, [grouped, search]);

  const totals = useMemo(() => {
    let secciones = 0, cursos = 0;
    for (const g of grouped) {
      for (const ic of g.ciclosArr) {
        secciones += ic.seccionesArr.length;
        for (const sc of ic.seccionesArr) cursos += sc.cursosArr.length;
      }
    }
    return { carreras: grouped.length, secciones, cursos };
  }, [grouped]);

  const downloadAll = async () => {
    if (grouped.length === 0) return;
    setDownloading(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Portal Académico UAI";
      wb.created = new Date();

      // Hoja 1: Plantilla completa (carrera/ciclo/sección/curso)
      const ws = wb.addWorksheet("Plantilla");
      ws.columns = [
        { header: "Carrera",       key: "carrera",     width: 12 },
        { header: "Carrera Full",  key: "carreraFull", width: 36 },
        { header: "Ciclo",         key: "ciclo",       width: 8  },
        { header: "Sección",       key: "seccion",     width: 10 },
        { header: "Sección Label", key: "label",       width: 30 },
        { header: "Código",        key: "codigo",      width: 14 },
        { header: "Curso",         key: "curso",       width: 40 },
        { header: "Docente(s)",    key: "docentes",    width: 42 },
        { header: "Modalidad",     key: "modalidad",   width: 14 },
        { header: "Horas",         key: "horas",       width: 8  },
      ];
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
      for (const g of grouped) {
        for (const ic of g.ciclosArr) {
          for (const sc of ic.seccionesArr) {
            for (const c of sc.cursosArr) {
              ws.addRow({
                carrera: g.carrera,
                carreraFull: g.carreraFull,
                ciclo: ic.ciclo,
                seccion: sc.seccion,
                label: `${g.carreraFull} ${ic.ciclo}.${sc.seccion}`,
                codigo: c.codigo,
                curso: c.curso,
                docentes: Array.from(c.docentes).join(" / "),
                modalidad: c.modalidad || "",
                horas: c.horas || "",
              });
            }
          }
        }
      }
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

      // Hoja por carrera con bloques por ciclo.sección
      for (const g of grouped) {
        const safeName = g.carreraFull.slice(0, 28).replace(/[\\/*?:[\]]/g, "_");
        const wsC = wb.addWorksheet(safeName || g.carrera);
        wsC.addRow([g.carreraFull]).font = { bold: true, size: 14 };
        wsC.addRow([]);
        for (const ic of g.ciclosArr) {
          for (const sc of ic.seccionesArr) {
            const title = wsC.addRow([`${g.carreraFull} ${ic.ciclo}.${sc.seccion}`]);
            title.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
            title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
            const head = wsC.addRow(["Código", "Curso", "Docente(s)", "Modalidad", "Horas"]);
            head.font = { bold: true };
            head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
            for (const c of sc.cursosArr) {
              wsC.addRow([
                c.codigo,
                c.curso,
                Array.from(c.docentes).join(" / "),
                c.modalidad || "",
                c.horas || "",
              ]);
            }
            wsC.addRow([]);
          }
        }
        wsC.columns = [
          { width: 14 }, { width: 42 }, { width: 42 }, { width: 14 }, { width: 8 },
        ];
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Plantilla_Cursos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Excel generado", description: `${totals.secciones} secciones · ${totals.cursos} cursos.` });
    } catch (err) {
      console.error(err);
      toast({ title: "Error al generar Excel", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Plantilla de Cursos por Sección
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estructura completa según la planificación: cada carrera dividida por ciclo y sección
            (ej. <span className="font-mono">ADMINISTRACION DE EMPRESAS 1.C</span>) con todos sus cursos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">{totals.carreras} carreras</Badge>
          <Badge variant="outline" className="text-xs">{totals.secciones} secciones</Badge>
          <Badge variant="outline" className="text-xs">{totals.cursos} cursos</Badge>
          <Button
            size="sm"
            onClick={downloadAll}
            disabled={downloading || grouped.length === 0}
            className="gap-1.5"
            data-testid="button-descargar-excel"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar Excel
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por carrera, ciclo, sección, curso o docente…"
          className="pl-8 h-9"
          data-testid="input-search-resultados"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando planificación…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground border-2 border-dashed rounded">
          No hay resultados.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => {
            const carreraOpen = openCarrera === g.carrera;
            const totalSecciones = g.ciclosArr.reduce((a, ic) => a + ic.seccionesArr.length, 0);
            const totalCursos = g.ciclosArr.reduce(
              (a, ic) => a + ic.seccionesArr.reduce((b, sc) => b + sc.cursosArr.length, 0), 0);
            return (
              <div key={g.carrera} className="bg-white rounded-lg border border-border/50 shadow-sm overflow-hidden">
                <button
                  onClick={() => { setOpenCarrera(carreraOpen ? null : g.carrera); setOpenCiclo(null); setOpenSeccion(null); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  data-testid={`button-resultado-carrera-${g.carrera}`}
                >
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${carreraOpen ? "rotate-90" : ""}`} />
                  <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                      <span className="uppercase">{g.carreraFull}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{g.carrera}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {g.ciclosArr.length} ciclos · {totalSecciones} secciones · {totalCursos} cursos
                    </div>
                  </div>
                </button>

                {carreraOpen && (
                  <div className="border-t bg-muted/10">
                    {g.ciclosArr.map((ic) => {
                      const cicloKey = `${g.carrera}|${ic.ciclo}`;
                      const cicloOpen = openCiclo === cicloKey;
                      const cicloCursos = ic.seccionesArr.reduce((a, sc) => a + sc.cursosArr.length, 0);
                      return (
                        <div key={cicloKey} className="border-b last:border-b-0">
                          <button
                            onClick={() => { setOpenCiclo(cicloOpen ? null : cicloKey); setOpenSeccion(null); }}
                            className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-blue-50/50 transition-colors text-left bg-blue-50/20"
                            data-testid={`button-resultado-ciclo-${ic.ciclo}`}
                          >
                            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${cicloOpen ? "rotate-90" : ""}`} />
                            <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px]">CICLO {ic.ciclo}</Badge>
                            <div className="flex-1 min-w-0 text-xs text-muted-foreground">
                              {ic.seccionesArr.length} sección(es) · {cicloCursos} cursos
                            </div>
                          </button>

                          {cicloOpen && (
                            <div className="bg-white">
                              {ic.seccionesArr.map((sc) => {
                                const seccKey = `${cicloKey}|${sc.seccion}`;
                                const seccOpen = openSeccion === seccKey;
                                const label = `${g.carreraFull} ${ic.ciclo}.${sc.seccion}`;
                                return (
                                  <div key={seccKey} className="border-t">
                                    <button
                                      onClick={() => setOpenSeccion(seccOpen ? null : seccKey)}
                                      className="w-full flex items-center gap-3 px-8 py-2 hover:bg-amber-50/60 transition-colors text-left bg-amber-50/30"
                                      data-testid={`button-resultado-seccion-${sc.seccion}`}
                                    >
                                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${seccOpen ? "rotate-90" : ""}`} />
                                      <Layers className="h-4 w-4 text-amber-700" />
                                      <Badge variant="outline" className="bg-amber-100 border-amber-300 text-amber-900 text-[10px] font-mono">
                                        {ic.ciclo}.{sc.seccion}
                                      </Badge>
                                      <span className="text-sm font-semibold text-amber-900 uppercase truncate">{label}</span>
                                      <div className="flex-1" />
                                      <span className="text-xs text-muted-foreground">{sc.cursosArr.length} cursos</span>
                                    </button>

                                    {seccOpen && (
                                      <div className="px-8 pb-4 pt-2 bg-white">
                                        <table className="w-full text-xs border rounded overflow-hidden">
                                          <thead className="bg-slate-100 text-slate-700">
                                            <tr>
                                              <th className="px-2 py-1.5 text-left w-28">Código</th>
                                              <th className="px-2 py-1.5 text-left">Curso</th>
                                              <th className="px-2 py-1.5 text-left">Docente</th>
                                              <th className="px-2 py-1.5 text-left w-24">Modalidad</th>
                                              <th className="px-2 py-1.5 text-right w-14">Horas</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {sc.cursosArr.map((c, i) => (
                                              <tr key={c.codigo} className={i % 2 ? "bg-slate-50/60" : ""}>
                                                <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{c.codigo}</td>
                                                <td className="px-2 py-1.5 flex items-center gap-1.5">
                                                  <BookOpen className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                                                  <span className="font-medium">{c.curso}</span>
                                                </td>
                                                <td className="px-2 py-1.5">
                                                  {Array.from(c.docentes).map((d, k) => (
                                                    <span key={k} className="inline-flex items-center gap-1 mr-2">
                                                      <UserIcon className="h-3 w-3 text-muted-foreground" />{d}
                                                    </span>
                                                  ))}
                                                </td>
                                                <td className="px-2 py-1.5 text-muted-foreground">{c.modalidad || "—"}</td>
                                                <td className="px-2 py-1.5 text-right font-mono">{c.horas || "—"}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
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
