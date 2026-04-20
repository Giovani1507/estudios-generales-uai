import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Trash2, Eye, Loader2, ArrowLeft, Save } from "lucide-react";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

export type CursoCtx = {
  docente: string;
  codigoCurso: string;
  nombreCurso: string;
  carrera?: string;
  ciclo?: string;
  seccion?: string;
  turno?: string;
  sede?: string;
  modalidad?: string;
  dia?: string;
};

type PlanillaRow = {
  id: number;
  docente: string;
  carrera: string | null;
  ciclo: string | null;
  seccion: string | null;
  codigoCurso: string | null;
  nombreCurso: string | null;
  encabezadoCrudo: string | null;
  modalidad: string | null;
  sede: string | null;
  turno: string | null;
  dia: string | null;
  totalAlumnos: number;
  createdAt: string;
  updatedAt: string;
};

type PlanillaWeek = { label: string; fecha: string; dia: string };
type PlanillaAlumno = { numero: string; nombre: string; marcas: string[]; porcentaje: number };
type PlanillaTotales = { asistencias: number[]; inasistencias: number[] };

type PlanillaDetail = PlanillaRow & {
  weeks: PlanillaWeek[];
  alumnos: PlanillaAlumno[];
  totales: PlanillaTotales;
};

type ParsedXlsx = {
  encabezadoCrudo: string;
  weeks: PlanillaWeek[];
  alumnos: PlanillaAlumno[];
  totales: PlanillaTotales;
};

/* ── Parser del Excel "Reporte_de_Asistencia_de_Estudiantes.xlsx" ── */
function parseAttendanceXlsx(buf: ArrayBuffer): ParsedXlsx {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as string[][];

  const cell = (r: number, c: number) => String(aoa[r]?.[c] ?? "").trim();

  // Encabezado del curso (fila 5 → idx 4)
  const encabezadoCrudo = cell(4, 0);

  // Encontrar fila de encabezados ("Nº" / "N°" / "Apellidos y Nombres")
  let headerRow = -1;
  for (let r = 5; r < Math.min(aoa.length, 12); r++) {
    const v0 = cell(r, 0).toLowerCase();
    const v1 = cell(r, 1).toLowerCase();
    if ((v0 === "n°" || v0 === "nº" || v0 === "no") && v1.includes("apellidos")) {
      headerRow = r; break;
    }
  }
  if (headerRow === -1) headerRow = 6; // fallback (fila 7 → idx 6)

  // Cada semana ocupa 2 columnas (cols 2..N), última col = % Asist.
  const headers = aoa[headerRow] ?? [];
  const lastCol = headers.length - 1;
  const weeks: PlanillaWeek[] = [];
  for (let c = 2; c < lastCol; c += 2) {
    const label = cell(headerRow, c) || `Semana ${weeks.length + 1}`;
    const fecha = cell(headerRow + 1, c);
    const dia = cell(headerRow + 2, c);
    weeks.push({ label, fecha, dia });
  }

  // Alumnos: empiezan después de las 3 filas de encabezado (header + fecha + día)
  const startRow = headerRow + 3;
  const alumnos: PlanillaAlumno[] = [];
  let asistencias: number[] = new Array(weeks.length * 2).fill(0);
  let inasistencias: number[] = new Array(weeks.length * 2).fill(0);

  for (let r = startRow; r < aoa.length; r++) {
    const numero = cell(r, 0);
    const nombre = cell(r, 1);
    const c0 = cell(r, 0).toLowerCase();
    const c1 = cell(r, 1).toLowerCase();

    // Filas de totales al final
    if (c1.includes("asistencia") && !nombre.includes(",") && !c0) {
      // "Asistencias"
      asistencias = [];
      for (let c = 2; c < lastCol; c++) {
        const n = Number(cell(r, c));
        asistencias.push(Number.isFinite(n) ? n : 0);
      }
      continue;
    }
    if (c1.includes("inasistencia") && !c0) {
      inasistencias = [];
      for (let c = 2; c < lastCol; c++) {
        const n = Number(cell(r, c));
        inasistencias.push(Number.isFinite(n) ? n : 0);
      }
      continue;
    }
    if (!nombre || !numero) continue;

    const marcas: string[] = [];
    for (let c = 2; c < lastCol; c++) {
      marcas.push(cell(r, c));
    }
    const porcStr = cell(r, lastCol);
    const porcentaje = Number(porcStr.replace(",", ".")) || 0;
    alumnos.push({ numero, nombre, marcas, porcentaje });
  }

  return { encabezadoCrudo, weeks, alumnos, totales: { asistencias, inasistencias } };
}

/* ── Recalcula totales/porcentajes cuando se editan marcas ── */
function recompute(weeks: PlanillaWeek[], alumnos: PlanillaAlumno[]): { alumnos: PlanillaAlumno[]; totales: PlanillaTotales } {
  const cols = weeks.length * 2;
  const asistencias = new Array(cols).fill(0);
  const inasistencias = new Array(cols).fill(0);
  const newAlumnos = alumnos.map((a) => {
    let asis = 0, inasis = 0;
    for (let i = 0; i < cols; i++) {
      const m = (a.marcas[i] || "").toUpperCase();
      if (m === "A") { asistencias[i]++; asis++; }
      else if (m === "F") { inasistencias[i]++; inasis++; }
    }
    const total = asis + inasis;
    const porcentaje = total > 0 ? Math.round((asis / total) * 10000) / 100 : 0;
    return { ...a, porcentaje };
  });
  return { alumnos: newAlumnos, totales: { asistencias, inasistencias } };
}

const MARCA_COLOR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-300",
  F: "bg-rose-100 text-rose-700 border-rose-300",
  T: "bg-amber-100 text-amber-700 border-amber-300",
  J: "bg-blue-100 text-blue-700 border-blue-300",
};

type HorarioRow = {
  carrera: string; ciclo: string; seccion: string;
  codigo: string; curso: string;
  docente: string; modalidad: string;
  dia: string; hora: string; horaFin: string;
  local?: string; aula?: string; pabellon?: string; tipo?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  curso: CursoCtx;
  allRows?: HorarioRow[];
}

const DIA_ORDER: Record<string, number> = {
  LUNES: 1, MARTES: 2, MIERCOLES: 3, "MIÉRCOLES": 3,
  JUEVES: 4, VIERNES: 5, SABADO: 6, "SÁBADO": 6, DOMINGO: 7,
};

export function AsistenciaPlanillaDialog({ open, onClose, curso, allRows = [] }: Props) {
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "import" | "detail">("list");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planillas, setPlanillas] = useState<PlanillaRow[]>([]);
  const [parsed, setParsed] = useState<ParsedXlsx | null>(null);
  const [fileName, setFileName] = useState("");
  const [detail, setDetail] = useState<PlanillaDetail | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Cargar planillas existentes para este docente + curso (+ sección si está) */
  const loadList = async () => {
    if (!curso.docente || !curso.codigoCurso) { setPlanillas([]); return; }
    setLoading(true);
    try {
      const url = `${apiBase}/api/asistencia-planillas?docente=${encodeURIComponent(curso.docente)}&codigoCurso=${encodeURIComponent(curso.codigoCurso)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      const all = (await res.json()) as PlanillaRow[];
      const filtered = curso.seccion ? all.filter(p => (p.seccion || "") === curso.seccion) : all;
      setPlanillas(filtered);
    } catch (e) {
      toast({ title: "Error", description: "No se pudo cargar las planillas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) { setView("list"); setParsed(null); setDetail(null); setDirty(false); loadList(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, curso.docente, curso.codigoCurso, curso.seccion]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    try {
      const buf = await f.arrayBuffer();
      const p = parseAttendanceXlsx(buf);
      if (p.alumnos.length === 0) {
        toast({ title: "Excel vacío", description: "No se encontraron alumnos en el archivo.", variant: "destructive" });
        return;
      }
      setParsed(p);
    } catch (err) {
      console.error(err);
      toast({ title: "Error al leer Excel", description: "Verifica que el formato sea el reporte de asistencia.", variant: "destructive" });
    }
  };

  const saveImport = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      const body = {
        docente: curso.docente,
        carrera: curso.carrera ?? null,
        ciclo: curso.ciclo ?? null,
        seccion: curso.seccion ?? null,
        turno: curso.turno ?? null,
        sede: curso.sede ?? null,
        modalidad: curso.modalidad ?? null,
        dia: curso.dia ?? null,
        codigoCurso: curso.codigoCurso,
        nombreCurso: curso.nombreCurso,
        encabezadoCrudo: parsed.encabezadoCrudo,
        weeks: parsed.weeks,
        alumnos: parsed.alumnos,
        totales: parsed.totales,
      };
      const res = await fetch(`${apiBase}/api/asistencia-planillas`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast({ title: "Planilla guardada", description: `${parsed.alumnos.length} alumnos importados.` });
      setParsed(null);
      setFileName("");
      setView("list");
      await loadList();
    } catch (e) {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/asistencia-planillas/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as PlanillaDetail;
      setDetail(d);
      setDirty(false);
      setView("detail");
    } catch {
      toast({ title: "Error", description: "No se pudo cargar la planilla", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const deletePlanilla = async (id: number) => {
    if (!confirm("¿Eliminar esta planilla de asistencia?")) return;
    try {
      const res = await fetch(`${apiBase}/api/asistencia-planillas/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      toast({ title: "Eliminada" });
      await loadList();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const setMarca = (alumnoIdx: number, colIdx: number, value: string) => {
    if (!detail) return;
    const v = (value || "").toUpperCase().trim();
    const alumnos = detail.alumnos.map((a, i) => {
      if (i !== alumnoIdx) return a;
      const marcas = a.marcas.slice();
      marcas[colIdx] = v;
      return { ...a, marcas };
    });
    const r = recompute(detail.weeks, alumnos);
    setDetail({ ...detail, alumnos: r.alumnos, totales: r.totales });
    setDirty(true);
  };

  const saveDetail = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/asistencia-planillas/${detail.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumnos: detail.alumnos, totales: detail.totales }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast({ title: "Cambios guardados" });
      setDirty(false);
      await loadList();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* Horario del aula que se forma para los estudiantes de esta sección */
  const horarioAula = useMemo<HorarioRow[]>(() => {
    if (!curso.carrera || !curso.ciclo || !curso.seccion) return [];
    return allRows
      .filter(r =>
        r.carrera === curso.carrera &&
        r.ciclo === curso.ciclo &&
        r.seccion === curso.seccion
      )
      .sort((a, b) => {
        const da = DIA_ORDER[(a.dia || "").toUpperCase()] || 99;
        const db = DIA_ORDER[(b.dia || "").toUpperCase()] || 99;
        if (da !== db) return da - db;
        return (a.hora || "").localeCompare(b.hora || "");
      });
  }, [allRows, curso.carrera, curso.ciclo, curso.seccion]);

  const cursosUnicos = useMemo(() => {
    const m = new Map<string, { codigo: string; curso: string; docente: string }>();
    horarioAula.forEach(r => {
      if (!m.has(r.codigo)) m.set(r.codigo, { codigo: r.codigo, curso: r.curso, docente: r.docente });
    });
    return Array.from(m.values());
  }, [horarioAula]);

  const previewParsed = parsed && (
    <div className="space-y-3">
      <div className="rounded border border-border/50 bg-muted/30 p-3 text-xs space-y-1">
        <div><span className="text-muted-foreground">Encabezado del Excel:</span> <span className="font-medium">{parsed.encabezadoCrudo}</span></div>
        <div><span className="text-muted-foreground">Semanas detectadas:</span> <span className="font-bold">{parsed.weeks.length}</span> · <span className="text-muted-foreground">Alumnos:</span> <span className="font-bold">{parsed.alumnos.length}</span></div>
      </div>
      <div className="border rounded max-h-[300px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-2 py-1.5 text-left">#</th>
              <th className="px-2 py-1.5 text-left">Apellidos y Nombres</th>
              <th className="px-2 py-1.5 text-center">Marcas</th>
              <th className="px-2 py-1.5 text-right">% Asist.</th>
            </tr>
          </thead>
          <tbody>
            {parsed.alumnos.map((a, i) => (
              <tr key={i} className={i % 2 ? "bg-muted/20" : ""}>
                <td className="px-2 py-1 font-mono">{a.numero}</td>
                <td className="px-2 py-1">{a.nombre}</td>
                <td className="px-2 py-1 text-center font-mono text-[10px]">{a.marcas.filter(Boolean).join(" ") || "—"}</td>
                <td className="px-2 py-1 text-right font-bold">{a.porcentaje.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Asistencia · {curso.codigoCurso} {curso.nombreCurso}
          </DialogTitle>
          <div className="text-xs text-muted-foreground">
            Docente: <span className="font-medium text-foreground">{curso.docente}</span>
            {curso.seccion && <> · Sección: <span className="font-mono font-medium text-foreground">{curso.seccion}</span></>}
            {curso.ciclo && <> · Ciclo {curso.ciclo}</>}
            {curso.carrera && <> · {curso.carrera}</>}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto pr-1">
          {view === "list" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Planillas guardadas ({planillas.length})</h3>
                <Button size="sm" onClick={() => setView("import")} className="gap-1.5">
                  <Upload className="h-4 w-4" /> Importar Excel
                </Button>
              </div>
              {loading ? (
                <div className="py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                </div>
              ) : planillas.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground border-2 border-dashed rounded">
                  No hay planillas para este curso. Importa un Excel para comenzar.
                </div>
              ) : (
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Sección</th>
                        <th className="px-3 py-2 text-left font-semibold">Encabezado</th>
                        <th className="px-3 py-2 text-center font-semibold">Alumnos</th>
                        <th className="px-3 py-2 text-left font-semibold">Actualizado</th>
                        <th className="px-3 py-2 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planillas.map((p) => (
                        <tr key={p.id} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono">{p.seccion || "—"}</td>
                          <td className="px-3 py-2 max-w-[400px] truncate" title={p.encabezadoCrudo || ""}>{p.encabezadoCrudo || "—"}</td>
                          <td className="px-3 py-2 text-center font-bold">{p.totalAlumnos}</td>
                          <td className="px-3 py-2 text-muted-foreground">{new Date(p.updatedAt).toLocaleString("es-PE")}</td>
                          <td className="px-3 py-2 text-right space-x-1">
                            <Button size="sm" variant="outline" onClick={() => openDetail(p.id)} className="h-7 gap-1">
                              <Eye className="h-3.5 w-3.5" /> Ver
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deletePlanilla(p.id)} className="h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {view === "import" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setParsed(null); setFileName(""); setView("list"); }}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Volver
                </Button>
              </div>
              <div className="border-2 border-dashed rounded p-6 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium mb-1">Selecciona el Excel de asistencia</p>
                <p className="text-xs text-muted-foreground mb-3">Formato: "Reporte de Asistencia de Estudiantes" (.xlsx)</p>
                <Input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="max-w-sm mx-auto" />
                {fileName && <p className="text-xs text-muted-foreground mt-2">Archivo: {fileName}</p>}
              </div>
              {previewParsed}
              {parsed && (
                <div className="flex justify-end">
                  <Button onClick={saveImport} disabled={saving} className="gap-1.5">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar planilla
                  </Button>
                </div>
              )}
            </div>
          )}

          {view === "detail" && detail && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setDetail(null); setView("list"); }}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Volver
                </Button>
                {dirty && (
                  <Button size="sm" onClick={saveDetail} disabled={saving} className="gap-1.5 ml-auto">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar cambios
                  </Button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{detail.encabezadoCrudo}</div>

              <div className="border rounded overflow-auto max-h-[55vh]">
                <table className="text-[11px] border-collapse">
                  <thead className="bg-muted/60 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-1.5 text-left sticky left-0 bg-muted/60 z-20 border-r">#</th>
                      <th className="px-2 py-1.5 text-left sticky left-8 bg-muted/60 z-20 border-r min-w-[220px]">Apellidos y Nombres</th>
                      {detail.weeks.map((w, i) => (
                        <th key={i} colSpan={2} className="px-1 py-1.5 text-center border-l">
                          <div className="font-semibold">{w.label}</div>
                          <div className="text-[9px] text-muted-foreground font-normal">{w.fecha}</div>
                          <div className="text-[9px] text-muted-foreground font-normal">{w.dia}</div>
                        </th>
                      ))}
                      <th className="px-2 py-1.5 text-center font-semibold border-l bg-primary/10">% Asist.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.alumnos.map((a, ai) => (
                      <tr key={ai} className={ai % 2 ? "bg-muted/20" : ""}>
                        <td className="px-2 py-1 sticky left-0 bg-inherit border-r font-mono text-muted-foreground">{a.numero}</td>
                        <td className="px-2 py-1 sticky left-8 bg-inherit border-r whitespace-nowrap">{a.nombre}</td>
                        {a.marcas.map((m, ci) => (
                          <td key={ci} className="border-l p-0">
                            <input
                              value={m}
                              maxLength={2}
                              onChange={(e) => setMarca(ai, ci, e.target.value)}
                              className={`w-7 h-7 text-center font-bold text-[11px] outline-none border-0 ${MARCA_COLOR[(m || "").toUpperCase()] || "bg-transparent"}`}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1 text-right font-bold border-l bg-primary/5">{a.porcentaje.toFixed(2)}%</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-emerald-50/60 font-semibold">
                      <td className="sticky left-0 bg-emerald-50/60 border-r" />
                      <td className="px-2 py-1 sticky left-8 bg-emerald-50/60 border-r">Asistencias</td>
                      {detail.totales.asistencias.map((n, i) => (
                        <td key={i} className="px-1 py-1 text-center border-l">{n}</td>
                      ))}
                      <td className="border-l" />
                    </tr>
                    <tr className="bg-rose-50/60 font-semibold">
                      <td className="sticky left-0 bg-rose-50/60 border-r" />
                      <td className="px-2 py-1 sticky left-8 bg-rose-50/60 border-r">Inasistencias</td>
                      {detail.totales.inasistencias.map((n, i) => (
                        <td key={i} className="px-1 py-1 text-center border-l">{n}</td>
                      ))}
                      <td className="border-l" />
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">A = Asistió</Badge>
                <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-300">F = Faltó</Badge>
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">T = Tardanza</Badge>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">J = Justificado</Badge>
                <span>Edita una celda y pulsa "Guardar cambios".</span>
              </div>

              {/* Horario por aula formado para estos estudiantes */}
              {horarioAula.length > 0 && (
                <div className="mt-4 border rounded-md overflow-hidden">
                  <div className="bg-primary/5 px-3 py-2 border-b">
                    <div className="text-xs font-semibold text-primary">
                      Horario del aula que se está formando para estos estudiantes
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {curso.carrera} · Ciclo {curso.ciclo} · Sección {curso.seccion} · {cursosUnicos.length} cursos · {horarioAula.length} sesiones
                    </div>
                  </div>
                  <div className="max-h-[40vh] overflow-auto">
                    <table className="w-full text-[11px]">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold">Día</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Hora</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Código</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Curso</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Docente</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Modalidad</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Aula</th>
                        </tr>
                      </thead>
                      <tbody>
                        {horarioAula.map((r, i) => (
                          <tr key={i} className={i % 2 ? "bg-muted/20" : ""}>
                            <td className="px-2 py-1 font-semibold">{r.dia}</td>
                            <td className="px-2 py-1 font-mono whitespace-nowrap">{r.hora} – {r.horaFin}</td>
                            <td className="px-2 py-1 font-mono text-muted-foreground">{r.codigo}</td>
                            <td className="px-2 py-1">{r.curso}</td>
                            <td className="px-2 py-1 text-muted-foreground">{r.docente}</td>
                            <td className="px-2 py-1">
                              <Badge variant="outline" className="text-[9px]">{r.modalidad}</Badge>
                            </td>
                            <td className="px-2 py-1 text-muted-foreground">
                              {[r.local, r.pabellon, r.aula].filter(Boolean).join(" · ") || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
