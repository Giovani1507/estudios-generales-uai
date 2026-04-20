import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, GraduationCap, BookOpen, Users, ChevronRight, ClipboardCheck, User as UserIcon, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ExcelJS from "exceljs";

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
  const { toast } = useToast();
  const [planillas, setPlanillas] = useState<PlanillaSummary[]>([]);
  const [carreraFull, setCarreraFull] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [search, setSearch] = useState("");
  const [openCarrera, setOpenCarrera] = useState<string | null>(null);
  const [openCiclo, setOpenCiclo] = useState<string | null>(null);
  const [openSeccion, setOpenSeccion] = useState<string | null>(null);
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
    type SeccionGroup = {
      seccion: string;
      cursos: Map<string, CursoGroup>;
      totalAlumnos: number;
    };
    type CicloGroup = {
      ciclo: string;
      secciones: Map<string, SeccionGroup>;
      totalAlumnos: number;
      totalCursos: number;
    };
    type CarreraGroup = {
      carrera: string;
      carreraFull: string;
      ciclos: Map<string, CicloGroup>;
      totalAlumnos: number;
    };
    const carrMap = new Map<string, CarreraGroup>();
    for (const p of planillas) {
      const cKey = p.carrera || "—";
      if (!carrMap.has(cKey)) {
        carrMap.set(cKey, {
          carrera: cKey,
          carreraFull: carreraFull.get(cKey) || cKey,
          ciclos: new Map(),
          totalAlumnos: 0,
        });
      }
      const cg = carrMap.get(cKey)!;
      const cicloKey = p.ciclo || "—";
      if (!cg.ciclos.has(cicloKey)) {
        cg.ciclos.set(cicloKey, { ciclo: cicloKey, secciones: new Map(), totalAlumnos: 0, totalCursos: 0 });
      }
      const ig = cg.ciclos.get(cicloKey)!;
      const seccKey = p.seccion || "—";
      if (!ig.secciones.has(seccKey)) {
        ig.secciones.set(seccKey, { seccion: seccKey, cursos: new Map(), totalAlumnos: 0 });
      }
      const sg = ig.secciones.get(seccKey)!;
      const codigo = p.codigoCurso || "—";
      if (!sg.cursos.has(codigo)) {
        sg.cursos.set(codigo, { codigo, nombre: p.nombreCurso || codigo, planillas: [] });
        ig.totalCursos += 1;
      }
      sg.cursos.get(codigo)!.planillas.push(p);
      sg.totalAlumnos += p.totalAlumnos || 0;
      ig.totalAlumnos += p.totalAlumnos || 0;
      cg.totalAlumnos += p.totalAlumnos || 0;
    }

    const cicloOrder = (s: string) => {
      const n = parseInt(s, 10);
      return Number.isNaN(n) ? 999 : n;
    };

    return Array.from(carrMap.values())
      .map(g => ({
        ...g,
        ciclosArr: Array.from(g.ciclos.values())
          .map(ic => ({
            ...ic,
            seccionesArr: Array.from(ic.secciones.values())
              .map(sc => ({
                ...sc,
                cursosArr: Array.from(sc.cursos.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
              }))
              .sort((a, b) => a.seccion.localeCompare(b.seccion, "es")),
          }))
          .sort((a, b) => cicloOrder(a.ciclo) - cicloOrder(b.ciclo)),
      }))
      .sort((a, b) => a.carreraFull.localeCompare(b.carreraFull, "es"));
  }, [planillas, carreraFull]);

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
                  c.nombre.toLowerCase().includes(q) ||
                  c.codigo.toLowerCase().includes(q) ||
                  c.planillas.some(p => (p.docente || "").toLowerCase().includes(q)),
                ),
              }))
              .filter(sc => sc.cursosArr.length > 0 || sc.seccion.toLowerCase().includes(q)),
          }))
          .filter(ic => ic.seccionesArr.length > 0),
      }))
      .filter(g =>
        g.carrera.toLowerCase().includes(q) ||
        g.carreraFull.toLowerCase().includes(q) ||
        g.ciclosArr.length > 0,
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

  const downloadAll = async () => {
    if (planillas.length === 0) return;
    setDownloading(true);
    try {
      // Cargar el detalle (alumnos) de TODAS las planillas en paralelo
      const details = await Promise.all(
        planillas.map(async (p) => {
          const cached = detailById.get(p.id);
          if (cached) return cached;
          const r = await fetch(`${apiBase}/api/asistencia-planillas/${p.id}`, { credentials: "include" });
          if (!r.ok) return { ...p, alumnos: [] as Alumno[] };
          return (await r.json()) as PlanillaDetail;
        })
      );

      const wb = new ExcelJS.Workbook();
      wb.creator = "Portal Académico UAI";
      wb.created = new Date();

      // ── Hoja 1: Resumen ─────────────────────────────────────────────
      const wsRes = wb.addWorksheet("Resumen");
      wsRes.columns = [
        { header: "Carrera",        key: "carrera",        width: 14 },
        { header: "Carrera Full",   key: "carreraFull",    width: 38 },
        { header: "Ciclo",          key: "ciclo",          width: 8  },
        { header: "Sección",        key: "seccion",        width: 10 },
        { header: "Código Curso",   key: "codigoCurso",    width: 14 },
        { header: "Curso",          key: "nombreCurso",    width: 38 },
        { header: "Docente",        key: "docente",        width: 38 },
        { header: "Modalidad",      key: "modalidad",      width: 14 },
        { header: "Total Alumnos",  key: "totalAlumnos",   width: 14 },
        { header: "Promedio % Asist.", key: "promedio",    width: 18 },
        { header: "Actualizado",    key: "updatedAt",      width: 22 },
      ];
      wsRes.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsRes.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
      details.forEach((d) => {
        const prom = d.alumnos.length > 0
          ? d.alumnos.reduce((a, x) => a + (x.porcentaje || 0), 0) / d.alumnos.length
          : 0;
        wsRes.addRow({
          carrera: d.carrera ?? "",
          carreraFull: carreraFull.get(d.carrera || "") || d.carreraFull || "",
          ciclo: d.ciclo ?? "",
          seccion: d.seccion ?? "",
          codigoCurso: d.codigoCurso ?? "",
          nombreCurso: d.nombreCurso ?? "",
          docente: d.docente ?? "",
          modalidad: d.modalidad ?? "",
          totalAlumnos: d.alumnos.length,
          promedio: Math.round(prom * 100) / 100,
          updatedAt: new Date(d.updatedAt).toLocaleString("es-PE"),
        });
      });

      // ── Hoja 2: Detalle de alumnos (todos en una sola tabla) ────────
      const wsDet = wb.addWorksheet("Alumnos");
      wsDet.columns = [
        { header: "Carrera",      key: "carrera",     width: 14 },
        { header: "Carrera Full", key: "carreraFull", width: 38 },
        { header: "Ciclo",        key: "ciclo",       width: 8  },
        { header: "Sección",      key: "seccion",     width: 10 },
        { header: "Código",       key: "codigo",      width: 14 },
        { header: "Curso",        key: "curso",       width: 38 },
        { header: "Docente",      key: "docente",     width: 38 },
        { header: "N°",           key: "numero",      width: 6  },
        { header: "Apellidos y Nombres", key: "nombre", width: 42 },
        { header: "% Asist.",     key: "porcentaje",  width: 12 },
      ];
      wsDet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsDet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
      details.forEach((d) => {
        const cFull = carreraFull.get(d.carrera || "") || d.carreraFull || "";
        d.alumnos.forEach((a) => {
          wsDet.addRow({
            carrera: d.carrera ?? "",
            carreraFull: cFull,
            ciclo: d.ciclo ?? "",
            seccion: d.seccion ?? "",
            codigo: d.codigoCurso ?? "",
            curso: d.nombreCurso ?? "",
            docente: d.docente ?? "",
            numero: a.numero,
            nombre: a.nombre,
            porcentaje: Math.round((a.porcentaje || 0) * 100) / 100,
          });
        });
      });
      wsDet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: wsDet.columns.length } };

      // ── Hoja por carrera (resumen y alumnos juntos) ─────────────────
      const carreras = Array.from(new Set(details.map(d => d.carrera || "—"))).sort();
      for (const carr of carreras) {
        const carrDetails = details.filter(d => (d.carrera || "—") === carr);
        if (carrDetails.length === 0) continue;
        const safeName = (carreraFull.get(carr) || carr).slice(0, 28).replace(/[\\/*?:[\]]/g, "_");
        const ws = wb.addWorksheet(safeName || carr);
        ws.addRow([carreraFull.get(carr) || carr]).font = { bold: true, size: 13 };
        ws.addRow([]);
        for (const d of carrDetails) {
          ws.addRow([
            `${d.codigoCurso || ""} · ${d.nombreCurso || ""}`,
            `Docente: ${d.docente || "—"}`,
            `Sección: ${d.seccion || "—"}`,
            `Ciclo: ${d.ciclo || "—"}`,
            `Alumnos: ${d.alumnos.length}`,
          ]).font = { bold: true };
          const head = ws.addRow(["N°", "Apellidos y Nombres", "% Asist."]);
          head.font = { bold: true, color: { argb: "FFFFFFFF" } };
          head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
          d.alumnos.forEach(a => {
            ws.addRow([a.numero, a.nombre, `${(a.porcentaje || 0).toFixed(2)}%`]);
          });
          ws.addRow([]);
        }
        ws.columns = [
          { width: 8 }, { width: 42 }, { width: 14 }, { width: 14 }, { width: 14 },
        ];
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 10);
      a.download = `Resultados_Planillas_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Excel generado", description: `${planillas.length} planillas · ${details.reduce((a, d) => a + d.alumnos.length, 0)} alumnos.` });
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
            Resultados de Planillas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todas las planillas subidas, organizadas por carrera y curso. Despliega un curso para ver al docente y a sus estudiantes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">{totalPlanillas} planillas</Badge>
          <Badge variant="outline" className="text-xs">{totalAlumnosGlobal} alumnos</Badge>
          <Badge variant="outline" className="text-xs">{filtered.length} carreras</Badge>
          <Button
            size="sm"
            onClick={downloadAll}
            disabled={downloading || planillas.length === 0}
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
            const carreraOpen = openCarrera === g.carrera;
            const totalCursos = g.ciclosArr.reduce((a, ic) => a + ic.totalCursos, 0);
            return (
              <div key={g.carrera} className="bg-white rounded-lg border border-border/50 shadow-sm overflow-hidden">
                <button
                  onClick={() => { setOpenCarrera(carreraOpen ? null : g.carrera); setOpenCiclo(null); setOpenSeccion(null); setOpenCurso(null); }}
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
                      {g.ciclosArr.length} ciclos · {totalCursos} cursos · {g.totalAlumnos} alumnos
                    </div>
                  </div>
                </button>

                {carreraOpen && (
                  <div className="border-t bg-muted/10">
                    {g.ciclosArr.map((ic) => {
                      const cicloKey = `${g.carrera}|${ic.ciclo}`;
                      const cicloOpen = openCiclo === cicloKey;
                      return (
                        <div key={cicloKey} className="border-b last:border-b-0">
                          <button
                            onClick={() => { setOpenCiclo(cicloOpen ? null : cicloKey); setOpenSeccion(null); setOpenCurso(null); }}
                            className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-blue-50/50 transition-colors text-left bg-blue-50/20"
                            data-testid={`button-resultado-ciclo-${ic.ciclo}`}
                          >
                            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${cicloOpen ? "rotate-90" : ""}`} />
                            <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px]">CICLO {ic.ciclo}</Badge>
                            <div className="flex-1 min-w-0 text-xs text-muted-foreground">
                              {ic.seccionesArr.length} sección(es) · {ic.totalCursos} cursos · {ic.totalAlumnos} alumnos
                            </div>
                          </button>

                          {cicloOpen && (
                            <div className="bg-white">
                              {ic.seccionesArr.map((sc) => {
                                const seccKey = `${cicloKey}|${sc.seccion}`;
                                const seccOpen = openSeccion === seccKey;
                                return (
                                  <div key={seccKey} className="border-t">
                                    <button
                                      onClick={() => { setOpenSeccion(seccOpen ? null : seccKey); setOpenCurso(null); }}
                                      className="w-full flex items-center gap-3 px-8 py-2 hover:bg-amber-50/50 transition-colors text-left bg-amber-50/20"
                                      data-testid={`button-resultado-seccion-${sc.seccion}`}
                                    >
                                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${seccOpen ? "rotate-90" : ""}`} />
                                      <Badge variant="outline" className="bg-amber-100 border-amber-300 text-amber-900 text-[10px] font-mono">SECCIÓN {sc.seccion}</Badge>
                                      <div className="flex-1 min-w-0 text-xs text-muted-foreground">
                                        {sc.cursosArr.length} cursos · {sc.totalAlumnos} alumnos
                                      </div>
                                    </button>

                                    {seccOpen && (
                                      <div className="border-t bg-muted/5">
                                        {sc.cursosArr.map((c) => {
                                          const cursoKey = `${seccKey}|${c.codigo}`;
                                          const cursoOpen = openCurso === cursoKey;
                                          return (
                                            <div key={cursoKey} className="border-b last:border-b-0">
                                              <button
                                                onClick={() => setOpenCurso(cursoOpen ? null : cursoKey)}
                                                className="w-full flex items-center gap-3 px-11 py-2 hover:bg-muted/30 transition-colors text-left"
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
                                                        <Badge variant="outline" className="text-[9px] gap-1 ml-1">
                                                          <Users className="h-2.5 w-2.5" />{p.totalAlumnos}
                                                        </Badge>
                                                      </span>
                                                    ))}
                                                  </div>
                                                </div>
                                              </button>

                                              {cursoOpen && (
                                                <div className="px-11 pb-3 pt-0 space-y-3 bg-white">
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
                                                              {p.modalidad && <span>{p.modalidad}</span>}
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
