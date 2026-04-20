import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Save, Users, ClipboardList } from "lucide-react";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

export type SeccionCtx = {
  facultad: "FICA" | "FCS";
  carrera: string;
  carreraFull: string;
  ciclo: string;
  seccion: string;
  cursosCount: number;
};

type Alumno = { numero: string; nombre: string; marcas: string[]; porcentaje: number };
type Week = { label: string; fecha: string; dia: string };

type PlanillaRow = {
  id: number;
  carrera: string | null;
  ciclo: string | null;
  seccion: string | null;
  weeks: Week[];
  alumnos: Alumno[];
};

const NUM_SEMANAS = 18;
const SESIONES_POR_SEMANA = 2;
const TOTAL_COLS = NUM_SEMANAS * SESIONES_POR_SEMANA;

const MARCA_COLOR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-300",
  F: "bg-rose-100 text-rose-700 border-rose-300",
  T: "bg-amber-100 text-amber-700 border-amber-300",
  J: "bg-blue-100 text-blue-700 border-blue-300",
};

function buildEmptyWeeks(): Week[] {
  return Array.from({ length: NUM_SEMANAS }, (_, i) => ({
    label: `S${i + 1}`,
    fecha: "",
    dia: "",
  }));
}

function recompute(alumnos: Alumno[]) {
  return alumnos.map((a) => {
    let asis = 0, inasis = 0;
    for (let i = 0; i < TOTAL_COLS; i++) {
      const m = (a.marcas[i] || "").toUpperCase();
      if (m === "A" || m === "T" || m === "J") asis++;
      else if (m === "F") inasis++;
    }
    const total = asis + inasis;
    const porcentaje = total > 0 ? Math.round((asis / total) * 10000) / 100 : 0;
    return { ...a, porcentaje };
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
  ctx: SeccionCtx;
  onSaved?: () => void;
}

export function SeccionPlanillaDialog({ open, onClose, ctx, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planillaId, setPlanillaId] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<Week[]>(buildEmptyWeeks());
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = `${apiBase}/api/asistencia-planillas?carrera=${encodeURIComponent(ctx.carrera)}&ciclo=${encodeURIComponent(ctx.ciclo)}&seccion=${encodeURIComponent(ctx.seccion)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      const list = (await res.json()) as PlanillaRow[];
      const found = list[0];
      if (found) {
        const detail = await fetch(`${apiBase}/api/asistencia-planillas/${found.id}`, { credentials: "include" });
        const d = (await detail.json()) as PlanillaRow;
        setPlanillaId(d.id);
        setWeeks(d.weeks?.length ? d.weeks : buildEmptyWeeks());
        const fixed = (d.alumnos || []).map((a) => ({
          numero: a.numero || "",
          nombre: a.nombre || "",
          marcas: Array.from({ length: TOTAL_COLS }, (_, i) => a.marcas?.[i] || ""),
          porcentaje: a.porcentaje || 0,
        }));
        setAlumnos(recompute(fixed));
      } else {
        setPlanillaId(null);
        setWeeks(buildEmptyWeeks());
        setAlumnos([]);
      }
      setDirty(false);
    } catch {
      toast({ title: "Error", description: "No se pudo cargar la planilla", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ctx.carrera, ctx.ciclo, ctx.seccion]);

  const addAlumno = () => {
    const n = nuevoNombre.trim();
    if (!n) return;
    setAlumnos((prev) => [
      ...prev,
      {
        numero: String(prev.length + 1),
        nombre: n.toUpperCase(),
        marcas: new Array(TOTAL_COLS).fill(""),
        porcentaje: 0,
      },
    ]);
    setNuevoNombre("");
    setDirty(true);
  };

  const removeAlumno = (idx: number) => {
    setAlumnos((prev) => prev.filter((_, i) => i !== idx).map((a, i) => ({ ...a, numero: String(i + 1) })));
    setDirty(true);
  };

  const updateNombre = (idx: number, value: string) => {
    setAlumnos((prev) => prev.map((a, i) => (i === idx ? { ...a, nombre: value } : a)));
    setDirty(true);
  };

  const setMarca = (idx: number, col: number, value: string) => {
    const v = (value || "").toUpperCase().trim().slice(0, 1);
    setAlumnos((prev) => {
      const next = prev.map((a, i) => {
        if (i !== idx) return a;
        const marcas = a.marcas.slice();
        marcas[col] = v;
        return { ...a, marcas };
      });
      return recompute(next);
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const recomputed = recompute(alumnos);
      const asistencias = new Array(TOTAL_COLS).fill(0);
      const inasistencias = new Array(TOTAL_COLS).fill(0);
      recomputed.forEach((a) => {
        for (let i = 0; i < TOTAL_COLS; i++) {
          const m = (a.marcas[i] || "").toUpperCase();
          if (m === "A" || m === "T" || m === "J") asistencias[i]++;
          else if (m === "F") inasistencias[i]++;
        }
      });
      const body = {
        carrera: ctx.carrera,
        ciclo: ctx.ciclo,
        seccion: ctx.seccion,
        codigoCurso: `SECCION-${ctx.carrera}-${ctx.ciclo}${ctx.seccion}`,
        nombreCurso: `${ctx.carreraFull} · Ciclo ${ctx.ciclo} · Sección ${ctx.seccion}`,
        encabezadoCrudo: `${ctx.carreraFull} — Ciclo ${ctx.ciclo} — Sección ${ctx.seccion}`,
        weeks,
        alumnos: recomputed,
        totales: { asistencias, inasistencias },
      };
      let res: Response;
      if (planillaId) {
        res = await fetch(`${apiBase}/api/asistencia-planillas/${planillaId}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alumnos: recomputed, totales: { asistencias, inasistencias }, weeks, seccion: ctx.seccion }),
        });
      } else {
        res = await fetch(`${apiBase}/api/asistencia-planillas`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) throw new Error(String(res.status));
      const saved = await res.json();
      setPlanillaId(saved.id);
      setDirty(false);
      toast({ title: "Guardado", description: `${recomputed.length} alumnos en la planilla.` });
      onSaved?.();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const totalAlumnos = alumnos.length;
  const promedioAsist = useMemo(() => {
    if (alumnos.length === 0) return 0;
    const s = alumnos.reduce((acc, a) => acc + (a.porcentaje || 0), 0);
    return Math.round((s / alumnos.length) * 100) / 100;
  }, [alumnos]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            {ctx.carreraFull} · Ciclo {ctx.ciclo} · Sección {ctx.seccion}
          </DialogTitle>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
            <Badge variant="outline">{ctx.facultad}</Badge>
            <Badge variant="outline">{ctx.cursosCount} cursos</Badge>
            <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{totalAlumnos} alumnos</Badge>
            {totalAlumnos > 0 && (
              <Badge variant="outline" className="bg-primary/5">Asist. promedio: {promedioAsist.toFixed(2)}%</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b pb-3">
          <Input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAlumno(); } }}
            placeholder="Apellidos y nombres del alumno…"
            className="h-9 max-w-md"
            data-testid="input-nuevo-alumno"
          />
          <Button size="sm" onClick={addAlumno} className="gap-1.5" data-testid="button-agregar-alumno">
            <Plus className="h-4 w-4" /> Agregar
          </Button>
          <div className="ml-auto">
            <Button size="sm" onClick={save} disabled={saving || !dirty} className="gap-1.5" data-testid="button-guardar-planilla">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {planillaId ? "Guardar cambios" : "Crear planilla"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : alumnos.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground border-2 border-dashed rounded m-4">
              Aún no hay alumnos. Escribe un nombre arriba y pulsa "Agregar".
            </div>
          ) : (
            <table className="text-[11px] border-collapse">
              <thead className="bg-muted/60 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left sticky left-0 bg-muted/60 z-20 border-r">#</th>
                  <th className="px-2 py-1.5 text-left sticky left-8 bg-muted/60 z-20 border-r min-w-[260px]">Apellidos y Nombres</th>
                  {weeks.map((w, i) => (
                    <th key={i} colSpan={2} className="px-1 py-1.5 text-center border-l whitespace-nowrap">
                      <div className="font-semibold">{w.label}</div>
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-center font-semibold border-l bg-primary/10 sticky right-8">% Asist.</th>
                  <th className="px-1 py-1.5 sticky right-0 bg-muted/60 border-l"></th>
                </tr>
              </thead>
              <tbody>
                {alumnos.map((a, ai) => (
                  <tr key={ai} className={ai % 2 ? "bg-muted/20" : ""}>
                    <td className="px-2 py-1 sticky left-0 bg-inherit border-r font-mono text-muted-foreground">{a.numero}</td>
                    <td className="px-2 py-1 sticky left-8 bg-inherit border-r">
                      <Input
                        value={a.nombre}
                        onChange={(e) => updateNombre(ai, e.target.value)}
                        className="h-7 text-[11px]"
                        data-testid={`input-alumno-${ai}`}
                      />
                    </td>
                    {a.marcas.map((m, ci) => (
                      <td key={ci} className="border-l p-0">
                        <input
                          value={m}
                          maxLength={1}
                          onChange={(e) => setMarca(ai, ci, e.target.value)}
                          className={`w-7 h-7 text-center font-bold text-[11px] outline-none border-0 ${MARCA_COLOR[(m || "").toUpperCase()] || "bg-transparent"}`}
                          data-testid={`input-marca-${ai}-${ci}`}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right font-bold border-l bg-primary/5 sticky right-8">{a.porcentaje.toFixed(2)}%</td>
                    <td className="px-1 py-1 sticky right-0 bg-inherit border-l">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => removeAlumno(ai)}
                        data-testid={`button-remove-${ai}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground border-t pt-2">
          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">A = Asistió</Badge>
          <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-300">F = Faltó</Badge>
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">T = Tardanza</Badge>
          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">J = Justificado</Badge>
          <span>· {NUM_SEMANAS} semanas × {SESIONES_POR_SEMANA} sesiones · Edita y guarda los cambios.</span>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
