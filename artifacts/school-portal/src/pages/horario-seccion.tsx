import { useState, useMemo } from "react";
import { useEffect } from "react";
import { BookOpen, Users, Clock, MapPin, User, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Types ────────────────────────────────────────────────────────────────────
interface Row {
  local: string; carrera: string; carreraFull: string;
  ciclo: string; seccion: string; codigo: string; curso: string;
  modalidadCurso: string; horasT: number; horasP: number; horas: number;
  horasAcad: number; docente: string; modalidad: string; tipo: string;
  dia: string; hora: string; horaFin: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const FICA_SEDES = ["PRINCIPAL", "FILIAL", "HUAURA"] as const;
const FCS_SEDES  = ["PRINCIPAL", "FILIAL", "SUNAMPE", "HUAURA", "PORUMA"] as const;

const FICA_CARRERAS: Record<string, string> = {
  AE: "Administración de Empresas",
  AF: "Administración y Finanzas",
  AR: "Arquitectura",
  CA: "Contabilidad",
  DE: "Derecho",
  IC: "Ingeniería Civil",
  IN: "Ingeniería Industrial",
  IS: "Ingeniería de Sistemas",
};

const FCS_CARRERAS: Record<string, string> = {
  EN: "Enfermería",
  MH: "Medicina Humana",
  OB: "Obstetricia",
  PS: "Psicología",
  T1: "Tecnología Médica I",
  T2: "Tecnología Médica II",
  T3: "Tecnología Médica III",
  T4: "Tecnología Médica IV",
};

const DAYS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO","DOMINGO"];
const DAYS_LABEL = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

const SLOTS = [
  "07:40","08:30","09:20","10:10","11:00","11:50","12:40",
  "13:30","14:20","15:10","16:00","16:50","17:40","18:30",
  "19:20","20:10","21:00","21:50","22:40",
];
const SLOT_END: Record<string, string> = {
  "07:40":"08:30","08:30":"09:20","09:20":"10:10","10:10":"11:00",
  "11:00":"11:50","11:50":"12:40","12:40":"13:30","13:30":"14:20",
  "14:20":"15:10","15:10":"16:00","16:00":"16:50","16:50":"17:40",
  "17:40":"18:30","18:30":"19:20","19:20":"20:10","20:10":"21:00",
  "21:00":"21:50","21:50":"22:40","22:40":"23:30",
};

const COURSE_COLORS = [
  { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" }, // blue
  { bg: "#dcfce7", border: "#86efac", text: "#166534" }, // green
  { bg: "#fef9c3", border: "#fde047", text: "#854d0e" }, // yellow
  { bg: "#fce7f3", border: "#f9a8d4", text: "#9d174d" }, // pink
  { bg: "#ede9fe", border: "#c4b5fd", text: "#5b21b6" }, // purple
  { bg: "#ffedd5", border: "#fdba74", text: "#c2410c" }, // orange
  { bg: "#cffafe", border: "#67e8f9", text: "#0e7490" }, // cyan
  { bg: "#d1fae5", border: "#6ee7b7", text: "#065f46" }, // emerald
  { bg: "#f3f4f6", border: "#d1d5db", text: "#374151" }, // gray
  { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" }, // red
];

function normDia(d: string) {
  return d.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function slotIdx(h: string) {
  const i = SLOTS.indexOf(h.trim());
  return i >= 0 ? i : SLOTS.findIndex(s => s >= h.trim());
}

function slotEndIdx(h: string) {
  const t = h.trim();
  const i = SLOTS.findIndex(s => SLOT_END[s] === t || s === t);
  if (i >= 0) return i;
  // find slot whose end matches
  const j = SLOTS.findIndex(s => SLOT_END[s] >= t);
  return j >= 0 ? j : SLOTS.length - 1;
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function modalidadBadge(m: string) {
  const n = m.toUpperCase();
  if (n.includes("VIRTUAL"))  return <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] font-semibold">Virtual</Badge>;
  if (n.includes("HIBRIDO") || n.includes("HÍBRIDO")) return <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] font-semibold">Híbrido</Badge>;
  return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] font-semibold">Presencial</Badge>;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function HorarioSeccion() {
  const base = import.meta.env.BASE_URL;
  const [facultad, setFacultad] = useState<"FICA"|"FCS">("FICA");
  const [carrera, setCarrera] = useState<string>("");
  const [ciclo, setCiclo]     = useState<string>("");
  const [seccion, setSeccion] = useState<string>("");
  const [sede, setSede]       = useState<string>("ALL");
  const [data, setData]       = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const carreraMap = facultad === "FICA" ? FICA_CARRERAS : FCS_CARRERAS;
  const sedeList   = (facultad === "FICA" ? FICA_SEDES : FCS_SEDES) as readonly string[];

  // Reset downstream filters when faculty changes
  useEffect(() => { setCarrera(""); setCiclo(""); setSeccion(""); setSede("ALL"); }, [facultad]);
  useEffect(() => { setCiclo(""); setSeccion(""); setSede("ALL"); }, [carrera]);
  useEffect(() => { setSeccion(""); setSede("ALL"); }, [ciclo]);

  // Load JSON data
  useEffect(() => {
    setLoading(true);
    const file = facultad === "FICA"
      ? `${base}planificacion-fica-2026-1.json`
      : `${base}planificacion-fcs-2026-1.json`;
    fetch(file).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [facultad, base]);

  // Available ciclos for selected career (restricted to 1 and 2)
  const availCiclos = useMemo(() => {
    if (!carrera) return [];
    return [...new Set(data.filter(r => r.carrera === carrera && (r.ciclo === "1" || r.ciclo === "2")).map(r => r.ciclo))]
      .sort((a, b) => Number(a) - Number(b));
  }, [data, carrera]);

  // Available sections for selected career + ciclo
  const availSecciones = useMemo(() => {
    if (!carrera || !ciclo) return [];
    return [...new Set(
      data.filter(r => r.carrera === carrera && r.ciclo === ciclo).map(r => r.seccion)
    )].sort();
  }, [data, carrera, ciclo]);

  // Filtered rows for selected group (+ optional sede filter)
  const rows = useMemo<Row[]>(() => {
    if (!carrera || !ciclo || !seccion) return [];
    return data.filter(r =>
      r.carrera === carrera &&
      r.ciclo === ciclo &&
      r.seccion === seccion &&
      (!sede || sede === "ALL" || r.local === sede)
    );
  }, [data, carrera, ciclo, seccion, sede]);

  // Sedes available for the selected group
  const availSedes = useMemo(() => {
    if (!carrera || !ciclo || !seccion) return sedeList;
    const inData = new Set(
      data.filter(r => r.carrera === carrera && r.ciclo === ciclo && r.seccion === seccion).map(r => r.local)
    );
    return sedeList.filter(s => inData.has(s));
  }, [data, carrera, ciclo, seccion, sedeList]);

  // Unique courses for color mapping
  const uniqueCursos = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    rows.forEach(r => { if (!seen.has(r.curso)) { seen.add(r.curso); list.push(r.curso); } });
    return list;
  }, [rows]);

  const courseColor = useMemo(() => {
    const map: Record<string, typeof COURSE_COLORS[0]> = {};
    uniqueCursos.forEach((c, i) => { map[c] = COURSE_COLORS[i % COURSE_COLORS.length]; });
    return map;
  }, [uniqueCursos]);

  // Build schedule grid: day × slot → rows
  const grid = useMemo(() => {
    const g: Record<string, Record<number, Row[]>> = {};
    DAYS.forEach(d => { g[d] = {}; });
    rows.forEach(r => {
      if (!r.dia || !r.hora) return;
      const dayKey = normDia(r.dia);
      const si = slotIdx(r.hora);
      const ei = r.horaFin ? slotEndIdx(r.horaFin) : si;
      for (let i = si; i <= ei; i++) {
        if (!g[dayKey]) g[dayKey] = {};
        if (!g[dayKey][i]) g[dayKey][i] = [];
        if (i === si) g[dayKey][i].push(r);
        else g[dayKey][i].push({ ...r, _cont: true } as any);
      }
    });
    return g;
  }, [rows]);

  // Find active days and slot range
  const activeDays = useMemo(
    () => DAYS.filter(d => Object.keys(grid[d] || {}).length > 0),
    [grid]
  );
  const activeSlots = useMemo(() => {
    if (rows.length === 0) return SLOTS;
    const used = new Set<number>();
    rows.forEach(r => {
      if (!r.hora) return;
      const si = slotIdx(r.hora);
      const ei = r.horaFin ? slotEndIdx(r.horaFin) : si;
      for (let i = si; i <= ei; i++) used.add(i);
    });
    if (used.size === 0) return SLOTS;
    const arr = [...used].sort((a, b) => a - b);
    const min = Math.max(0, arr[0] - 1);
    const max = Math.min(SLOTS.length - 1, arr[arr.length - 1] + 1);
    return SLOTS.slice(min, max + 1).map((_, idx) => idx + min);
  }, [rows]);

  const showGrid = rows.length > 0;
  const title = carrera && ciclo && seccion
    ? `${carreraMap[carrera] || carrera} — Ciclo ${ciclo} · Sección ${seccion}`
    : null;

  // Unique course list for summary table
  const courseList = useMemo(() => {
    const map: Record<string, { curso: string; docente: string; horas: number; modalidad: string; horarios: string[] }> = {};
    rows.forEach(r => {
      const k = r.codigo || r.curso;
      if (!map[k]) map[k] = { curso: r.curso, docente: r.docente, horas: r.horasAcad || r.horas, modalidad: r.modalidad, horarios: [] };
      if (r.dia && r.hora) {
        const label = `${r.dia.charAt(0) + r.dia.slice(1).toLowerCase().replace("ercoles","ércoles").replace("ábado","ábado")} ${r.hora}–${r.horaFin || ""}`;
        if (!map[k].horarios.includes(label)) map[k].horarios.push(label);
      }
    });
    return Object.values(map);
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <GraduationCap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Horario por Carrera</h1>
          <p className="text-sm text-gray-500">Selecciona una carrera, ciclo y sección para ver el horario completo</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Faculty tabs */}
        <div className="flex gap-2 mb-5">
          {(["FICA", "FCS"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFacultad(f)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                facultad === f
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f === "FICA" ? "Facultad FICA" : "Facultad FCS"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Carrera */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Carrera</label>
            <Select value={carrera} onValueChange={setCarrera}>
              <SelectTrigger className="h-10 bg-gray-50 border-gray-200">
                <SelectValue placeholder="Seleccionar carrera…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(carreraMap).sort((a,b)=>a[1].localeCompare(b[1])).map(([code, name]) => (
                  <SelectItem key={code} value={code}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ciclo */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Ciclo</label>
            <Select value={ciclo} onValueChange={setCiclo} disabled={!carrera}>
              <SelectTrigger className="h-10 bg-gray-50 border-gray-200">
                <SelectValue placeholder={carrera ? "Seleccionar ciclo…" : "Elige carrera"} />
              </SelectTrigger>
              <SelectContent>
                {availCiclos.map(c => (
                  <SelectItem key={c} value={c}>Ciclo {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sección */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Sección</label>
            <Select value={seccion} onValueChange={setSeccion} disabled={!ciclo}>
              <SelectTrigger className="h-10 bg-gray-50 border-gray-200">
                <SelectValue placeholder={ciclo ? "Seleccionar sección…" : "Elige ciclo"} />
              </SelectTrigger>
              <SelectContent>
                {availSecciones.map(s => (
                  <SelectItem key={s} value={s}>Sección {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sede */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Sede</label>
            <Select value={sede} onValueChange={setSede} disabled={!seccion}>
              <SelectTrigger className="h-10 bg-gray-50 border-gray-200">
                <SelectValue placeholder={seccion ? "Todas las sedes" : "Elige sección"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las sedes</SelectItem>
                {availSedes.map(s => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
          Cargando datos…
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !showGrid && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">Selecciona una carrera, ciclo y sección</p>
          <p className="text-gray-400 text-sm mt-1">para ver el horario completo del grupo</p>
        </div>
      )}

      {/* ── Results ── */}
      {showGrid && (
        <div className="space-y-5">
          {/* Group header */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-0.5">{facultad}</p>
              <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">{title}</h2>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-primary/60" />
                <strong className="text-gray-800">{uniqueCursos.length}</strong> cursos
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary/60" />
                <strong className="text-gray-800">{[...new Set(rows.map(r=>r.docente).filter(Boolean))].length}</strong> docentes
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary/60" />
                <strong className="text-gray-800">{courseList.reduce((a,c)=>a+c.horas,0)}</strong> hrs/sem
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary/60" />
                {[...new Set(rows.map(r=>r.local))].join(" · ")}
              </span>
            </div>
          </div>

          {/* ── Schedule grid ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">Cuadro Horario Semanal</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[640px]">
                <thead>
                  <tr>
                    <th className="w-20 px-2 py-2.5 bg-gray-50 border-b border-r border-gray-200 text-gray-500 font-semibold text-center">Hora</th>
                    {activeDays.map(d => (
                      <th key={d} className="px-2 py-2.5 bg-gray-50 border-b border-r border-gray-200 text-gray-700 font-bold text-center min-w-[110px]">
                        {DAYS_LABEL[DAYS.indexOf(d)]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map((slot, si) => {
                    const inRange = (activeSlots as number[]).includes(si);
                    if (!inRange) return null;
                    const hasAny = activeDays.some(d => grid[d]?.[si]?.length);
                    return (
                      <tr key={slot} className={hasAny ? "" : "opacity-40"}>
                        <td className="px-2 py-1 border-b border-r border-gray-100 bg-gray-50 text-center text-gray-500 font-mono whitespace-nowrap">
                          {slot}
                        </td>
                        {activeDays.map(d => {
                          const cells = grid[d]?.[si] || [];
                          const main = cells.find((c: any) => !c._cont);
                          if (!main) {
                            return <td key={d} className="border-b border-r border-gray-100 p-1" />;
                          }
                          const col = courseColor[main.curso] || COURSE_COLORS[0];
                          return (
                            <td
                              key={d}
                              className="border-b border-r border-gray-100 p-1 align-top"
                            >
                              <div
                                className="rounded-lg px-2 py-1.5 h-full"
                                style={{ background: col.bg, border: `1px solid ${col.border}` }}
                              >
                                <p className="font-semibold leading-tight mb-0.5 line-clamp-2" style={{ color: col.text, fontSize: "10px" }}>
                                  {main.curso}
                                </p>
                                {main.docente && (
                                  <p className="text-[9px] leading-tight opacity-75" style={{ color: col.text }}>
                                    {main.docente.split(" ").slice(0, 2).join(" ")}
                                  </p>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Color legend ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Cursos del grupo</p>
            <div className="flex flex-wrap gap-2">
              {uniqueCursos.map(c => {
                const col = courseColor[c] || COURSE_COLORS[0];
                return (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text }}
                  >
                    {c}
                  </span>
                );
              })}
            </div>
          </div>

          {/* ── Course detail table ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">Detalle de Cursos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">#</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Curso</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Docente</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Horario</th>
                    <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Hrs</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Modalidad</th>
                  </tr>
                </thead>
                <tbody>
                  {courseList.map((c, i) => {
                    const col = courseColor[c.curso] || COURSE_COLORS[0];
                    return (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ background: col.border }}
                            />
                            <span className="font-semibold text-gray-800 text-xs leading-tight">{c.curso}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            {c.docente || <span className="text-gray-300 italic">Sin asignar</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {c.horarios.join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block bg-primary/10 text-primary font-bold text-xs px-2 py-0.5 rounded-full">
                            {c.horas}
                          </span>
                        </td>
                        <td className="px-4 py-3">{modalidadBadge(c.modalidad)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
