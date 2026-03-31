import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus, Trash2, Edit2, Check, X, AlertTriangle, User,
  Calendar, Clock, BookOpen, ClipboardList, LayoutGrid, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Types ───────────────────────────────────────────────────────────────────
type Disponibilidad = {
  id: string;
  docente: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
};

type Asignacion = {
  id: string;
  docente: string;
  curso: string;
  carrera: string;
  ciclo: string;
  seccion: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  modalidad: string;
  tipo: string;
};

// ── Constants ───────────────────────────────────────────────────────────────
const DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
const DIAS_LABEL: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles",
  JUEVES: "Jueves", VIERNES: "Viernes", SABADO: "Sábado",
};
const SLOTS = [
  "07:40", "08:30", "09:20", "10:10", "11:00", "11:50",
  "12:40", "13:30", "14:20", "15:10", "16:00", "16:50",
  "17:40", "18:30", "19:20", "20:10", "21:00", "21:50", "22:40",
];
const SLOT_END: Record<string, string> = {
  "07:40": "08:30", "08:30": "09:20", "09:20": "10:10", "10:10": "11:00",
  "11:00": "11:50", "11:50": "12:40", "12:40": "13:30", "13:30": "14:20",
  "14:20": "15:10", "15:10": "16:00", "16:00": "16:50", "16:50": "17:40",
  "17:40": "18:30", "18:30": "19:20", "19:20": "20:10", "20:10": "21:00",
  "21:00": "21:50", "21:50": "22:40", "22:40": "23:30",
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function overlaps(aS: string, aE: string, bS: string, bE: string) {
  return timeToMin(aS) < timeToMin(bE) && timeToMin(bS) < timeToMin(aE);
}

// ── Select helper ────────────────────────────────────────────────────────────
function Sel({
  value, onChange, options, placeholder = "Seleccionar...", className = "",
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const label = options.find(o => o.value === value)?.label ?? placeholder;
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-10 left-0 right-0 bg-popover border border-border rounded-md shadow-lg py-1 max-h-52 overflow-y-auto">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                o.value === value ? "bg-primary/10 text-primary font-medium" : ""
              }`}
            >
              {o.value === value && <Check className="w-3 h-3 shrink-0" />}
              {o.value !== value && <span className="w-3 h-3 shrink-0" />}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = "disponibilidades" | "asignaciones" | "horario";

// ── Main component ────────────────────────────────────────────────────────────
export default function CrearPlanificacion() {
  const [tab, setTab] = useState<Tab>("disponibilidades");

  // ── Persistence ──────────────────────────────────────────────────────────
  const [disponibilidades, setDisponibilidades] = useState<Disponibilidad[]>(() => {
    try { return JSON.parse(localStorage.getItem("plan_disps") || "[]"); } catch { return []; }
  });
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>(() => {
    try { return JSON.parse(localStorage.getItem("plan_assigns") || "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem("plan_disps", JSON.stringify(disponibilidades)); }, [disponibilidades]);
  useEffect(() => { localStorage.setItem("plan_assigns", JSON.stringify(asignaciones)); }, [asignaciones]);

  // ── Disponibilidad form ────────────────────────────────────────────────────
  const emptyDisp = { docente: "", dia: "", horaInicio: "", horaFin: "" };
  const [dispForm, setDispForm] = useState(emptyDisp);
  const [dispEdit, setDispEdit] = useState<string | null>(null);
  const [dispErr, setDispErr] = useState("");

  const docentes = useMemo(() =>
    Array.from(new Set(disponibilidades.map(d => d.docente))).sort(),
  [disponibilidades]);

  function saveDisp() {
    const { docente, dia, horaInicio, horaFin } = dispForm;
    if (!docente.trim() || !dia || !horaInicio || !horaFin) {
      setDispErr("Completa todos los campos."); return;
    }
    if (timeToMin(horaInicio) >= timeToMin(horaFin)) {
      setDispErr("La hora de fin debe ser posterior a la hora de inicio."); return;
    }
    const overlap = disponibilidades.find(d =>
      d.id !== dispEdit &&
      d.docente.toUpperCase() === docente.toUpperCase().trim() &&
      d.dia === dia &&
      overlaps(d.horaInicio, d.horaFin, horaInicio, horaFin)
    );
    if (overlap) {
      setDispErr(`Ya existe disponibilidad para ${docente} en ese horario.`); return;
    }
    setDispErr("");
    if (dispEdit) {
      setDisponibilidades(prev => prev.map(d =>
        d.id === dispEdit ? { ...d, docente: docente.trim(), dia, horaInicio, horaFin } : d
      ));
      setDispEdit(null);
    } else {
      setDisponibilidades(prev => [...prev, { id: uid(), docente: docente.trim().toUpperCase(), dia, horaInicio, horaFin }]);
    }
    setDispForm(emptyDisp);
  }

  function startEditDisp(d: Disponibilidad) {
    setDispEdit(d.id);
    setDispForm({ docente: d.docente, dia: d.dia, horaInicio: d.horaInicio, horaFin: d.horaFin });
    setDispErr("");
    setTab("disponibilidades");
  }

  function deleteDisp(id: string) {
    setDisponibilidades(prev => prev.filter(d => d.id !== id));
  }

  // ── Asignacion form ────────────────────────────────────────────────────────
  const emptyAsgn: Omit<Asignacion, "id"> = {
    docente: "", curso: "", carrera: "", ciclo: "", seccion: "",
    dia: "", horaInicio: "", horaFin: "", modalidad: "Presencial", tipo: "T",
  };
  const [asgnForm, setAsgnForm] = useState(emptyAsgn);
  const [asgnEdit, setAsgnEdit] = useState<string | null>(null);
  const [asgnErr, setAsgnErr] = useState("");
  const [asgnWarn, setAsgnWarn] = useState("");

  function checkAsgnConflicts(form: typeof emptyAsgn, excludeId?: string) {
    const warnings: string[] = [];
    const errors: string[] = [];
    if (!form.docente || !form.dia || !form.horaInicio || !form.horaFin) return { errors: [], warnings: [] };

    // Check availability
    const hasAvail = disponibilidades.some(d =>
      d.docente === form.docente &&
      d.dia === form.dia &&
      timeToMin(d.horaInicio) <= timeToMin(form.horaInicio) &&
      timeToMin(d.horaFin) >= timeToMin(form.horaFin)
    );
    if (!hasAvail) warnings.push(`${form.docente} no tiene disponibilidad registrada para ${DIAS_LABEL[form.dia]} ${form.horaInicio}–${form.horaFin}.`);

    // Check teacher conflicts
    const conflict = asignaciones.find(a =>
      a.id !== excludeId &&
      a.docente === form.docente &&
      a.dia === form.dia &&
      overlaps(a.horaInicio, a.horaFin, form.horaInicio, form.horaFin)
    );
    if (conflict) errors.push(`CRUCE: ${form.docente} ya está asignado a "${conflict.curso}" (${conflict.seccion}) el ${DIAS_LABEL[form.dia]} ${conflict.horaInicio}–${conflict.horaFin}.`);

    return { errors, warnings };
  }

  function updateAsgnForm(patch: Partial<typeof emptyAsgn>) {
    const next = { ...asgnForm, ...patch };
    setAsgnForm(next);
    if (next.docente && next.dia && next.horaInicio && next.horaFin) {
      const { errors, warnings } = checkAsgnConflicts(next, asgnEdit ?? undefined);
      setAsgnErr(errors[0] ?? "");
      setAsgnWarn(warnings[0] ?? "");
    } else {
      setAsgnErr(""); setAsgnWarn("");
    }
  }

  function saveAsgn() {
    const { docente, curso, carrera, ciclo, seccion, dia, horaInicio, horaFin } = asgnForm;
    if (!docente || !curso.trim() || !carrera.trim() || !ciclo.trim() || !seccion.trim() || !dia || !horaInicio || !horaFin) {
      setAsgnErr("Completa todos los campos obligatorios."); return;
    }
    if (timeToMin(horaInicio) >= timeToMin(horaFin)) {
      setAsgnErr("La hora de fin debe ser posterior a la hora de inicio."); return;
    }
    const { errors } = checkAsgnConflicts(asgnForm, asgnEdit ?? undefined);
    if (errors.length > 0) { setAsgnErr(errors[0]); return; }

    if (asgnEdit) {
      setAsignaciones(prev => prev.map(a => a.id === asgnEdit ? { ...a, ...asgnForm } : a));
      setAsgnEdit(null);
    } else {
      setAsignaciones(prev => [...prev, { id: uid(), ...asgnForm }]);
    }
    setAsgnForm(emptyAsgn);
    setAsgnErr(""); setAsgnWarn("");
  }

  function startEditAsgn(a: Asignacion) {
    setAsgnEdit(a.id);
    const { id: _id, ...rest } = a;
    setAsgnForm(rest);
    setAsgnErr(""); setAsgnWarn("");
    setTab("asignaciones");
  }

  function deleteAsgn(id: string) {
    setAsignaciones(prev => prev.filter(a => a.id !== id));
  }

  // ── Conflict detection for grid ────────────────────────────────────────────
  function teacherCrucesAt(docente: string, dia: string, horaInicio: string, horaFin: string, excludeId?: string) {
    return asignaciones.filter(a =>
      a.id !== excludeId &&
      a.docente === docente &&
      a.dia === dia &&
      overlaps(a.horaInicio, a.horaFin, horaInicio, horaFin)
    ).length;
  }

  const totalCruces = useMemo(() => {
    let count = 0;
    asignaciones.forEach(a => {
      if (teacherCrucesAt(a.docente, a.dia, a.horaInicio, a.horaFin, a.id) > 0) count++;
    });
    return count;
  }, [asignaciones]);

  // ── Grid build ───────────────────────────────────────────────────────────
  type Cell = { asgn: Asignacion; hasCruce: boolean; spanSlots: number };
  const gridData = useMemo(() => {
    const map = new Map<string, Cell[]>();
    asignaciones.forEach(a => {
      const si = SLOTS.indexOf(a.horaInicio);
      if (si < 0) return;
      const ei = SLOTS.indexOf(a.horaFin);
      const span = ei >= 0 ? ei - si : 1;
      const hasCruce = teacherCrucesAt(a.docente, a.dia, a.horaInicio, a.horaFin, a.id) > 0;
      const k = `${a.dia}_${a.horaInicio}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push({ asgn: a, hasCruce, spanSlots: Math.max(1, span) });
    });
    return map;
  }, [asignaciones]);

  const activeSlots = useMemo(() => {
    const used = new Set<number>();
    asignaciones.forEach(a => {
      const si = SLOTS.indexOf(a.horaInicio);
      const ei = SLOTS.indexOf(a.horaFin);
      if (si >= 0) for (let i = si; i <= Math.max(si, ei - 1); i++) used.add(i);
    });
    if (used.size === 0) return SLOTS;
    const arr = Array.from(used).sort((a, b) => a - b);
    return SLOTS.slice(Math.max(0, arr[0] - 1), Math.min(SLOTS.length, arr[arr.length - 1] + 2));
  }, [asignaciones]);

  const activeDias = useMemo(() => {
    const used = new Set(asignaciones.map(a => a.dia));
    return DIAS.filter(d => used.has(d));
  }, [asignaciones]);

  // ── Docente options ───────────────────────────────────────────────────────
  const docenteOptions = useMemo(() =>
    docentes.map(d => ({ value: d, label: d })),
  [docentes]);

  const diaOptions = DIAS.map(d => ({ value: d, label: DIAS_LABEL[d] }));
  const slotOptions = SLOTS.map(s => ({ value: s, label: s }));

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Crear Planificación</h1>
            <p className="text-sm text-muted-foreground">Semestre 2026-1 · Gestión de disponibilidades y asignaciones</p>
          </div>
        </div>
        {totalCruces > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-semibold">
            <AlertTriangle className="w-4 h-4" />
            {totalCruces} cruce{totalCruces > 1 ? "s" : ""} detectado{totalCruces > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Docentes registrados", value: docentes.length, icon: User, color: "text-blue-600 bg-blue-50" },
          { label: "Disponibilidades", value: disponibilidades.length, icon: Calendar, color: "text-green-600 bg-green-50" },
          { label: "Asignaciones", value: asignaciones.length, icon: BookOpen, color: "text-purple-600 bg-purple-50" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {([
          { id: "disponibilidades", label: "Disponibilidades", Icon: Clock },
          { id: "asignaciones",     label: "Asignaciones",     Icon: BookOpen },
          { id: "horario",          label: "Vista de Horario", Icon: LayoutGrid },
        ] as { id: Tab; label: string; Icon: typeof Clock }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              tab === t.id ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.Icon className="w-4 h-4" />
            {t.label}
            {t.id === "horario" && totalCruces > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalCruces}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: DISPONIBILIDADES ────────────────────────────────────────── */}
      {tab === "disponibilidades" && (
        <div className="grid grid-cols-[380px_1fr] gap-5">
          {/* Form */}
          <Card className="border-border/60 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {dispEdit ? <><Edit2 className="w-4 h-4 text-primary" />Editar Disponibilidad</> : <><Plus className="w-4 h-4 text-primary" />Nueva Disponibilidad</>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Apellidos y Nombres del Docente</label>
                <Input
                  placeholder="Ej: GARCIA LOPEZ JUAN"
                  value={dispForm.docente}
                  onChange={e => setDispForm(f => ({ ...f, docente: e.target.value.toUpperCase() }))}
                  className="uppercase"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Día</label>
                <Sel value={dispForm.dia} onChange={v => setDispForm(f => ({ ...f, dia: v }))} options={diaOptions} placeholder="Seleccionar día..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Hora Inicio</label>
                  <Sel value={dispForm.horaInicio} onChange={v => setDispForm(f => ({ ...f, horaInicio: v }))} options={slotOptions} placeholder="Inicio" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Hora Fin</label>
                  <Sel value={dispForm.horaFin} onChange={v => setDispForm(f => ({ ...f, horaFin: v }))} options={slotOptions} placeholder="Fin" />
                </div>
              </div>
              {dispErr && (
                <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {dispErr}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button onClick={saveDisp} className="flex-1 gap-2">
                  <Check className="w-4 h-4" />
                  {dispEdit ? "Guardar cambios" : "Agregar disponibilidad"}
                </Button>
                {dispEdit && (
                  <Button variant="outline" onClick={() => { setDispEdit(null); setDispForm(emptyDisp); setDispErr(""); }}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Disponibilidades registradas
                <Badge className="bg-primary/10 text-primary border-0 font-semibold">{disponibilidades.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {disponibilidades.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No hay disponibilidades registradas aún.
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 text-left font-medium">Docente</th>
                        <th className="px-3 py-2.5 text-left font-medium w-28">Día</th>
                        <th className="px-3 py-2.5 text-left font-medium w-24">Inicio</th>
                        <th className="px-3 py-2.5 text-left font-medium w-24">Fin</th>
                        <th className="px-3 py-2.5 text-center font-medium w-20">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...disponibilidades]
                        .sort((a, b) => a.docente.localeCompare(b.docente) || DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia) || a.horaInicio.localeCompare(b.horaInicio))
                        .map(d => (
                          <tr key={d.id} className={`border-b last:border-0 hover:bg-muted/10 transition-colors ${dispEdit === d.id ? "bg-primary/5" : ""}`}>
                            <td className="px-4 py-2.5 font-medium text-xs">{d.docente}</td>
                            <td className="px-3 py-2.5 text-xs">{DIAS_LABEL[d.dia]}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-blue-700 font-semibold">{d.horaInicio}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-blue-700 font-semibold">{d.horaFin}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => startEditDisp(d)} className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteDisp(d.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB: ASIGNACIONES ────────────────────────────────────────────── */}
      {tab === "asignaciones" && (
        <div className="grid grid-cols-[380px_1fr] gap-5">
          {/* Form */}
          <Card className="border-border/60 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {asgnEdit ? <><Edit2 className="w-4 h-4 text-primary" />Editar Asignación</> : <><Plus className="w-4 h-4 text-primary" />Nueva Asignación</>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Docente *</label>
                {docenteOptions.length > 0 ? (
                  <Sel value={asgnForm.docente} onChange={v => updateAsgnForm({ docente: v })} options={docenteOptions} placeholder="Seleccionar docente..." />
                ) : (
                  <div className="text-xs text-muted-foreground p-2.5 border rounded-md bg-muted/30">
                    Primero registra disponibilidades de docentes.
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Carrera *</label>
                  <Input placeholder="Ej: IC" value={asgnForm.carrera} onChange={e => updateAsgnForm({ carrera: e.target.value.toUpperCase() })} className="uppercase" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Ciclo *</label>
                  <Input placeholder="Ej: 1" value={asgnForm.ciclo} onChange={e => updateAsgnForm({ ciclo: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Sección *</label>
                  <Input placeholder="Ej: A" value={asgnForm.seccion} onChange={e => updateAsgnForm({ seccion: e.target.value.toUpperCase() })} className="uppercase" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Tipo</label>
                  <Sel
                    value={asgnForm.tipo}
                    onChange={v => updateAsgnForm({ tipo: v })}
                    options={[{ value: "T", label: "Teoría (T)" }, { value: "P", label: "Práctica (P)" }, { value: "TP", label: "Teoría-Práctica (TP)" }]}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Curso *</label>
                <Input placeholder="Ej: Cálculo I" value={asgnForm.curso} onChange={e => updateAsgnForm({ curso: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Modalidad</label>
                <Sel
                  value={asgnForm.modalidad}
                  onChange={v => updateAsgnForm({ modalidad: v })}
                  options={[
                    { value: "Presencial", label: "Presencial" },
                    { value: "Virtual", label: "Virtual" },
                    { value: "Híbrido", label: "Híbrido" },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Día *</label>
                <Sel value={asgnForm.dia} onChange={v => updateAsgnForm({ dia: v })} options={diaOptions} placeholder="Seleccionar día..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Hora Inicio *</label>
                  <Sel value={asgnForm.horaInicio} onChange={v => updateAsgnForm({ horaInicio: v, horaFin: SLOT_END[v] || "" })} options={slotOptions} placeholder="Inicio" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Hora Fin *</label>
                  <Sel value={asgnForm.horaFin} onChange={v => updateAsgnForm({ horaFin: v })} options={slotOptions} placeholder="Fin" />
                </div>
              </div>

              {asgnErr && (
                <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {asgnErr}
                </div>
              )}
              {!asgnErr && asgnWarn && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {asgnWarn}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button onClick={saveAsgn} disabled={!!asgnErr} className="flex-1 gap-2">
                  <Check className="w-4 h-4" />
                  {asgnEdit ? "Guardar cambios" : "Agregar asignación"}
                </Button>
                {asgnEdit && (
                  <Button variant="outline" onClick={() => { setAsgnEdit(null); setAsgnForm(emptyAsgn); setAsgnErr(""); setAsgnWarn(""); }}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Asignaciones table */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Asignaciones registradas
                <Badge className="bg-primary/10 text-primary border-0 font-semibold">{asignaciones.length}</Badge>
                {totalCruces > 0 && (
                  <Badge className="bg-red-100 text-red-700 border-0 font-semibold">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {totalCruces} cruces
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {asignaciones.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No hay asignaciones registradas aún.
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 text-left font-medium">Docente</th>
                        <th className="px-3 py-2.5 text-left font-medium">Curso</th>
                        <th className="px-3 py-2.5 text-left font-medium w-20">Car/Cic/Sec</th>
                        <th className="px-3 py-2.5 text-left font-medium w-24">Día</th>
                        <th className="px-3 py-2.5 text-left font-medium w-28">Horario</th>
                        <th className="px-3 py-2.5 text-center font-medium w-20">Estado</th>
                        <th className="px-3 py-2.5 text-center font-medium w-20">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...asignaciones]
                        .sort((a, b) => a.docente.localeCompare(b.docente) || DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia))
                        .map(a => {
                          const cruce = teacherCrucesAt(a.docente, a.dia, a.horaInicio, a.horaFin, a.id) > 0;
                          return (
                            <tr key={a.id} className={`border-b last:border-0 hover:bg-muted/10 transition-colors ${cruce ? "bg-red-50" : ""}`}>
                              <td className="px-4 py-2.5 text-xs font-medium">{a.docente}</td>
                              <td className="px-3 py-2.5 text-xs">{a.curso}</td>
                              <td className="px-3 py-2.5 text-xs">
                                <span className="font-mono font-bold text-primary">{a.carrera}</span>
                                <span className="text-muted-foreground"> {a.ciclo}{a.seccion}</span>
                              </td>
                              <td className="px-3 py-2.5 text-xs">{DIAS_LABEL[a.dia]}</td>
                              <td className="px-3 py-2.5 font-mono text-xs">{a.horaInicio}–{a.horaFin}</td>
                              <td className="px-3 py-2.5 text-center">
                                {cruce
                                  ? <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">CRUCE</Badge>
                                  : <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">OK</Badge>}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => startEditAsgn(a)} className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors">
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => deleteAsgn(a.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB: HORARIO ─────────────────────────────────────────────────── */}
      {tab === "horario" && (
        <div className="space-y-4">
          {asignaciones.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No hay asignaciones para mostrar. Agrega asignaciones en la pestaña anterior.
            </div>
          ) : activeDias.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No hay días con horarios asignados.
            </div>
          ) : (
            <>
              {totalCruces > 0 && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Se detectaron <strong>{totalCruces} cruce{totalCruces > 1 ? "s" : ""}</strong> de horario.
                    Las celdas en rojo indican docentes con asignaciones simultáneas.
                    Ve a la pestaña <strong>Asignaciones</strong> para corregirlos.
                  </span>
                </div>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block" />Sin cruce</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />Con cruce</span>
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full border-collapse text-[11px] min-w-[640px]">
                  <thead>
                    <tr className="bg-primary text-white">
                      <th className="border border-primary/40 px-3 py-2 text-center font-semibold w-20">Hora</th>
                      {activeDias.map(d => (
                        <th key={d} className="border border-primary/40 px-3 py-2 text-center font-semibold">
                          {DIAS_LABEL[d]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeSlots.map((slot, si) => {
                      const absIdx = SLOTS.indexOf(slot);
                      return (
                        <tr key={slot}>
                          <td className="border border-gray-200 bg-[#D9E0F1] px-2 py-1.5 text-center font-mono text-[9px] whitespace-nowrap font-bold">
                            {slot}<br />{SLOT_END[slot] || ""}
                          </td>
                          {activeDias.map(dia => {
                            const key = `${dia}_${slot}`;
                            const cells = gridData.get(key) ?? [];
                            if (cells.length > 0) {
                              return (
                                <td key={dia} className="border border-gray-200 p-0 align-top" rowSpan={cells[0]?.spanSlots || 1}>
                                  <div className="flex flex-col gap-0.5 p-1">
                                    {cells.map((cell, ci) => (
                                      <div
                                        key={ci}
                                        className={`rounded p-1.5 text-center ${cell.hasCruce
                                          ? "bg-red-100 border border-red-300"
                                          : "bg-blue-50 border border-blue-200"
                                        }`}
                                      >
                                        <div className="font-bold text-[9px] text-gray-800 leading-tight truncate">
                                          {cell.asgn.curso}
                                        </div>
                                        <div className="text-[8px] text-gray-600 truncate">
                                          {cell.asgn.docente.split(" ").slice(0, 2).join(" ")}
                                        </div>
                                        <div className="text-[8px] text-gray-500 font-mono">
                                          {cell.asgn.carrera} {cell.asgn.ciclo}{cell.asgn.seccion}
                                        </div>
                                        {cell.hasCruce && (
                                          <div className="text-[8px] text-red-600 font-bold">⚠ CRUCE</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              );
                            }

                            // Check if this slot is occupied by a span from a previous row
                            const occupied = asignaciones.some(a => {
                              if (a.dia !== dia) return false;
                              const startIdx = SLOTS.indexOf(a.horaInicio);
                              const endIdx   = SLOTS.indexOf(a.horaFin);
                              return startIdx >= 0 && absIdx > startIdx && absIdx < endIdx;
                            });
                            if (occupied) return null;

                            return <td key={dia} className="border border-gray-100 bg-white" />;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
