import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Users, Shuffle, Plus, Trash2, Download, Search, Sparkles,
  UserCheck, AlertTriangle, CheckCircle2,
} from "lucide-react";
import * as ExcelJS from "exceljs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

type PlanRow = {
  local: string; facultad: string; carrera: string; carreraFull: string;
  ciclo: string; seccion: string; codigo: string; curso: string;
  modalidad: string; modalidadCurso?: string; docente: string; dia: string; hora: string; horaFin: string;
};

type Unidad = {
  key: string;          // unique id
  docente: string;
  curso: string;
  codigo: string;
  carrera: string;
  ciclo: string;
  seccion: string;
  sede: string;
  modalidad: string;
  dia: string;
  // Todos los días en los que se dicta esta planilla (normalizados),
  // porque un mismo curso-sección puede tener clases en varios días.
  dias: string[];
  hora: string;
  horaFin: string;
  // Todas las sesiones (día + hora inicio + hora fin) de esta planilla.
  sesiones: { dia: string; hora: string; horaFin: string }[];
  facultad: string;
};

type Worker = { id: string; nombre: string; monto: number };

type DocenteUnit = {
  key: string;          // docente (normalizado)
  docente: string;
  planillas: Unidad[];
};

const normDia = (d?: string | null): string => {
  const x = (d || "").toUpperCase().trim()
    .replace(/Á/g, "A").replace(/É/g, "E").replace(/Í/g, "I").replace(/Ó/g, "O").replace(/Ú/g, "U");
  if (x.startsWith("LUN")) return "LUNES";
  if (x.startsWith("MAR")) return "MARTES";
  if (x.startsWith("MIE")) return "MIÉRCOLES";
  if (x.startsWith("JUE")) return "JUEVES";
  if (x.startsWith("VIE")) return "VIERNES";
  if (x.startsWith("SAB")) return "SÁBADO";
  if (x.startsWith("DOM")) return "DOMINGO";
  return "";
};

// Convierte secciones con grupo (A1, A2, B1) a su sección base (A, B).
// Mantiene secciones simples (A, B) o no estándar tal cual.
const baseSeccion = (s: string | null | undefined): string => {
  const t = String(s || "").trim().toUpperCase();
  const m = t.match(/^([A-Z]+)\d+$/);
  return m ? m[1] : t;
};

const sedeNorm = (v?: string | null) => {
  const s = (v || "").toUpperCase().trim();
  if (s === "PRINCIPAL" || s === "SEDE" || s === "ICA" || s === "") return "SEDE";
  if (s === "FILIAL" || s === "CHINCHA") return "FILIAL";
  if (s === "SUNAMPE") return "SUNAMPE";
  if (s === "HUAURA") return "HUAURA";
  if (s === "PORUMA") return "PORUMA";
  return "SEDE";
};

const COLORES_WORKER = [
  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", dot: "bg-emerald-500" },
  { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-300",     dot: "bg-sky-500" },
  { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-300",  dot: "bg-violet-500" },
  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-300",   dot: "bg-amber-500" },
  { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-300",    dot: "bg-rose-500" },
];

const newId = () => Math.random().toString(36).slice(2, 9);

// Devuelve "rank" cronológico de una sesión: día (0=LUN, 6=DOM) * 10000 + minutos del día.
const ORDEN_DIAS = ["LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO"];
const minutosHora = (h: string): number => {
  const m = String(h || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 99 * 60;
  return Number(m[1]) * 60 + Number(m[2]);
};
const rankSesion = (s: { dia: string; hora: string }): number => {
  const di = ORDEN_DIAS.indexOf(s.dia);
  const d = di < 0 ? 99 : di;
  return d * 10000 + minutosHora(s.hora);
};
// rank más temprano de un docente (mira todas sus planillas y todas las sesiones).
const rankDocente = (d: DocenteUnit): number => {
  let best = Number.MAX_SAFE_INTEGER;
  for (const u of d.planillas) {
    const ses = (u.sesiones && u.sesiones.length > 0)
      ? u.sesiones
      : [{ dia: normDia(u.dia), hora: u.hora || "" }];
    for (const s of ses) {
      const r = rankSesion(s);
      if (r < best) best = r;
    }
  }
  return best;
};
const ordenarPorHorario = (lista: DocenteUnit[]): DocenteUnit[] => {
  // Ordena planillas dentro de cada docente y luego docentes entre sí.
  const con = lista.map(d => ({
    ...d,
    planillas: [...d.planillas].sort((a, b) => {
      const ra = Math.min(...((a.sesiones && a.sesiones.length > 0) ? a.sesiones : [{ dia: normDia(a.dia), hora: a.hora }]).map(rankSesion));
      const rb = Math.min(...((b.sesiones && b.sesiones.length > 0) ? b.sesiones : [{ dia: normDia(b.dia), hora: b.hora }]).map(rankSesion));
      return ra - rb;
    }),
  }));
  return con.sort((a, b) => {
    const ra = rankDocente(a);
    const rb = rankDocente(b);
    if (ra !== rb) return ra - rb;
    return a.docente.localeCompare(b.docente);
  });
};

const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const a = [...arr];
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function DivisionTareas() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [yaSubidas, setYaSubidas] = useState<Set<string>>(new Set());

  // Filtros
  const [sedesF, setSedesF] = useState<Set<string>>(new Set());
  const [facultadF, setFacultadF] = useState<"TODAS" | "FCS" | "FICA">("TODAS");
  const [ciclosF, setCiclosF] = useState<Set<string>>(new Set(["1", "2"]));
  const [diaF, setDiaF] = useState<string>("TODOS");
  const [excluirSubidas, setExcluirSubidas] = useState(true);
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000));

  // Estado compartido entre todos los usuarios (persistido en el servidor).
  const [workers, setWorkers] = useState<Worker[]>([
    { id: newId(), nombre: "Giovanni", monto: 56 },
    { id: newId(), nombre: "Valery",   monto: 56 },
  ]);
  const [asignaciones, setAsignaciones] = useState<Record<string, DocenteUnit[]>>({});
  const [sobrantes, setSobrantes] = useState<DocenteUnit[]>([]);
  const [marcadosSubidos, setMarcadosSubidos] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const toggleSubido = (docenteKey: string) => {
    setMarcadosSubidos(prev => {
      const next = new Set(prev);
      if (next.has(docenteKey)) next.delete(docenteKey);
      else next.add(docenteKey);
      return next;
    });
  };
  const [search, setSearch] = useState("");

  // --- Sincronización compartida (multiusuario) ---
  const lastSavedJsonRef = useRef<string>("");
  const lastUpdatedAtRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const SHARED_URL = `${apiBase}/api/shared-state/divisionTareas`;

  const applyServerPayload = (payload: any) => {
    if (!payload || typeof payload !== "object") return;
    if (Array.isArray(payload.workers)) setWorkers(payload.workers);
    if (payload.asignaciones && typeof payload.asignaciones === "object") setAsignaciones(payload.asignaciones);
    if (Array.isArray(payload.sobrantes)) setSobrantes(payload.sobrantes);
    if (Array.isArray(payload.marcadosSubidos)) setMarcadosSubidos(new Set(payload.marcadosSubidos));
  };

  // Carga inicial desde el servidor
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(SHARED_URL, { credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          if (!cancelled && data?.value) {
            applyServerPayload(data.value);
            lastSavedJsonRef.current = JSON.stringify(data.value);
            lastUpdatedAtRef.current = data.updatedAt || null;
          }
        }
      } catch {}
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir cambios al servidor (debounce)
  useEffect(() => {
    if (!hydrated) return;
    const payload = {
      workers,
      asignaciones,
      sobrantes,
      marcadosSubidos: [...marcadosSubidos],
    };
    const json = JSON.stringify(payload);
    if (json === lastSavedJsonRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        setSyncing(true);
        const r = await fetch(SHARED_URL, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: payload }),
        });
        if (r.ok) {
          const data = await r.json();
          lastSavedJsonRef.current = json;
          lastUpdatedAtRef.current = data?.updatedAt || lastUpdatedAtRef.current;
        }
      } catch {} finally { setSyncing(false); }
    }, 600);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [hydrated, workers, asignaciones, sobrantes, marcadosSubidos, SHARED_URL]);

  // Polling: refrescar cambios hechos por otros usuarios
  useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(async () => {
      if (saveTimerRef.current) return; // pendiente de guardar lo nuestro
      if (document.hidden) return;
      try {
        const r = await fetch(SHARED_URL, { credentials: "include" });
        if (!r.ok) return;
        const data = await r.json();
        const updatedAt = data?.updatedAt || null;
        if (updatedAt && updatedAt === lastUpdatedAtRef.current) return;
        const newJson = JSON.stringify(data?.value ?? null);
        if (newJson === lastSavedJsonRef.current) {
          lastUpdatedAtRef.current = updatedAt;
          return;
        }
        if (data?.value) {
          applyServerPayload(data.value);
          lastSavedJsonRef.current = newJson;
          lastUpdatedAtRef.current = updatedAt;
        }
      } catch {}
    }, 4000);
    return () => window.clearInterval(id);
  }, [hydrated, SHARED_URL]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const base = apiBase + "/";
        const [fica, fcs, subidas] = await Promise.all([
          fetch(`${base}planificacion-fica-2026-1.json`).then(r => r.json()),
          fetch(`${base}planificacion-fcs-2026-1.json`).then(r => r.json()),
          fetch(`${apiBase}/api/asistencia-planillas`, { credentials: "include" })
            .then(r => r.ok ? r.json() : []).catch(() => []),
        ]);

        // dedupe planificación a unidades únicas (codigo+seccion+sede+docente).
        // Cada unidad acumula TODOS los días en que se dicta (un curso puede
        // dictarse Lun y Mar, por eso `dias` es un set).
        const map = new Map<string, Unidad & { _dias: Set<string> }>();
        const all: PlanRow[] = [
          ...(Array.isArray(fica) ? fica : Object.values(fica)) as PlanRow[],
          ...(Array.isArray(fcs)  ? fcs  : Object.values(fcs))  as PlanRow[],
        ];
        for (const r of all) {
          if (!r || !r.docente || !r.codigo) continue;
          const sede = sedeNorm(r.local);
          const docente = String(r.docente).toUpperCase().trim();
          const sec = baseSeccion(r.seccion);
          const key = `${docente}|${r.codigo}|${sec}|${sede}`;
          if (!map.has(key)) {
            map.set(key, {
              key,
              docente,
              curso: r.curso || "",
              codigo: r.codigo,
              carrera: r.carreraFull || r.carrera || "",
              ciclo: String(r.ciclo || ""),
              seccion: sec,
              sede,
              modalidad: r.modalidad || r.modalidadCurso || "",
              dia: r.dia || "",
              dias: [],
              hora: r.hora || "",
              horaFin: r.horaFin || "",
              sesiones: [],
              facultad: r.facultad || "",
              _dias: new Set<string>(),
              _sesiones: new Map<string, { dia: string; hora: string; horaFin: string }>(),
            } as any);
          }
          const d = normDia(r.dia);
          if (d) (map.get(key)! as any)._dias.add(d);
          const ses = (map.get(key)! as any)._sesiones as Map<string, { dia: string; hora: string; horaFin: string }>;
          const sesKey = `${d}|${r.hora || ""}|${r.horaFin || ""}`;
          if (d && r.hora && !ses.has(sesKey)) ses.set(sesKey, { dia: d, hora: r.hora, horaFin: r.horaFin || "" });
        }
        const arr: Unidad[] = Array.from(map.values()).map((u: any) => {
          const { _dias, _sesiones, ...rest } = u;
          const sesiones = Array.from(_sesiones.values()).sort((a: any, b: any) => {
            const ord = ["LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO"];
            const da = ord.indexOf(a.dia), db = ord.indexOf(b.dia);
            if (da !== db) return da - db;
            return String(a.hora).localeCompare(String(b.hora));
          });
          return { ...rest, dias: Array.from(_dias) as string[], sesiones };
        });
        setUnidades(arr);

        // Ya subidas: marcar (codigo+seccion-base+docente+sede)
        const ya = new Set<string>();
        for (const p of subidas as Array<{ docente: string | null; codigoCurso: string | null; seccion: string | null; sede: string | null }>) {
          const k = `${(p.docente || "").toUpperCase().trim()}|${p.codigoCurso || ""}|${baseSeccion(p.seccion)}|${sedeNorm(p.sede)}`;
          ya.add(k);
        }
        setYaSubidas(ya);
      } catch (e) {
        console.error(e);
        toast({ title: "Error al cargar", description: "No se pudo cargar la planificación.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sedes = useMemo(() => Array.from(new Set(unidades.map(u => u.sede))).sort(), [unidades]);

  // Candidatos sin aplicar el filtro de "ya subidas" (para mostrar el total real)
  const candidatosTotales = useMemo(() => {
    let base = unidades;
    if (sedesF.size > 0) base = base.filter(u => sedesF.has(u.sede));
    if (facultadF !== "TODAS") base = base.filter(u => u.facultad === facultadF);
    if (ciclosF.size > 0) base = base.filter(u => ciclosF.has(String(u.ciclo).trim()));
    if (diaF !== "TODOS") base = base.filter(u => u.dias.includes(diaF));
    return base;
  }, [unidades, sedesF, facultadF, ciclosF, diaF]);

  const candidatos = useMemo(() => {
    if (excluirSubidas && yaSubidas.size > 0) {
      return candidatosTotales.filter(u => !yaSubidas.has(u.key));
    }
    return candidatosTotales;
  }, [candidatosTotales, excluirSubidas, yaSubidas]);

  // Agrupa las planillas por DOCENTE único. Cada DocenteUnit es 1 "persona" a repartir.
  const docentesCandidatos = useMemo<DocenteUnit[]>(() => {
    const m = new Map<string, DocenteUnit>();
    for (const u of candidatos) {
      if (!m.has(u.docente)) m.set(u.docente, { key: u.docente, docente: u.docente, planillas: [] });
      m.get(u.docente)!.planillas.push(u);
    }
    return Array.from(m.values()).sort((a, b) => a.docente.localeCompare(b.docente));
  }, [candidatos]);

  // Total de docentes (sin excluir los ya subidos) — coincide con el conteo de la página de Asistencia.
  const totalDocentesAll = useMemo(() => {
    const set = new Set<string>();
    for (const u of candidatosTotales) set.add(u.docente);
    return set.size;
  }, [candidatosTotales]);

  const totalSolicitado = workers.reduce((s, w) => s + (Number.isFinite(w.monto) ? w.monto : 0), 0);
  const tieneAsignacion = Object.keys(asignaciones).length > 0;

  const updateWorker = (id: string, patch: Partial<Worker>) => {
    setWorkers(ws => ws.map(w => w.id === id ? { ...w, ...patch } : w));
  };

  const addWorker = () => setWorkers(ws => [...ws, { id: newId(), nombre: "", monto: 0 }]);
  const removeWorker = (id: string) => setWorkers(ws => ws.filter(w => w.id !== id));

  const balanceAuto = () => {
    if (workers.length === 0) return;
    const n = workers.length;
    const total = docentesCandidatos.length;
    const base = Math.floor(total / n);
    const rest = total - base * n;
    setWorkers(ws => ws.map((w, i) => ({ ...w, monto: base + (i < rest ? 1 : 0) })));
  };

  const repartir = (opts?: { auto?: boolean }) => {
    if (workers.length === 0) {
      toast({ title: "Sin compañeros", description: "Agrega al menos una persona.", variant: "destructive" });
      return;
    }
    const conNombre = workers.filter(w => (w.nombre || "").trim());
    if (conNombre.length !== workers.length) {
      toast({ title: "Falta nombre", description: "Completa el nombre de todos.", variant: "destructive" });
      return;
    }

    // Reparto automático: si todos los montos están en 0 o se pide auto,
    // se divide equitativamente entre los compañeros.
    const totalManual = workers.reduce((s, w) => s + Math.max(0, Math.floor(w.monto || 0)), 0);
    const auto = opts?.auto || totalManual === 0;

    let cantidades: number[];
    if (auto) {
      const n = workers.length;
      const total = docentesCandidatos.length;
      const base = Math.floor(total / n);
      const rest = total - base * n;
      cantidades = workers.map((_w, i) => base + (i < rest ? 1 : 0));
      // Reflejar la cantidad asignada en el campo "monto" de cada compañero
      // para que el usuario vea cuánto le tocó.
      setWorkers(ws => ws.map((w, i) => ({ ...w, monto: cantidades[i] })));
    } else {
      cantidades = workers.map(w => Math.max(0, Math.floor(w.monto || 0)));
      const totalReq = cantidades.reduce((s, n) => s + n, 0);
      if (totalReq > docentesCandidatos.length) {
        toast({
          title: "No alcanzan",
          description: `Pediste ${totalReq} pero solo hay ${docentesCandidatos.length} docentes disponibles. Ajusta los montos o quita el filtro de "ya subidas".`,
          variant: "destructive",
        });
        return;
      }
    }

    const pool = seededShuffle(docentesCandidatos, seed);
    const out: Record<string, DocenteUnit[]> = {};
    let cursor = 0;
    for (let i = 0; i < workers.length; i++) {
      const n = cantidades[i];
      // Asigna el bloque al compañero, pero ordena cronológicamente:
      // primero por día (LUN..DOM) y luego por hora (07:40 antes que 09:30).
      out[workers[i].id] = ordenarPorHorario(pool.slice(cursor, cursor + n));
      cursor += n;
    }
    const sob = ordenarPorHorario(pool.slice(cursor));
    setAsignaciones(out);
    setSobrantes(sob);
    const totalAsig = cantidades.reduce((s, n) => s + n, 0);
    const totalPlanillas = Object.values(out).reduce((s, arr) => s + arr.reduce((x, d) => x + d.planillas.length, 0), 0);
    toast({
      title: auto ? "División automática" : "Reparto listo",
      description: `${totalAsig} docente(s) asignados · ${totalPlanillas} planillas en total.`,
    });
  };

  const reShuffle = () => {
    setSeed(Math.floor(Math.random() * 1_000_000));
    // Repartir con nueva semilla en el siguiente click; o repartir directo:
    setTimeout(() => repartir(), 0);
  };

  const limpiar = () => { setAsignaciones({}); setSobrantes([]); };

  const exportXLSX = async () => {
    const wb = new ExcelJS.Workbook();
    const resumen = wb.addWorksheet("Resumen");
    resumen.columns = [{ width: 30 }, { width: 18 }, { width: 18 }];
    resumen.getRow(1).values = ["DIVISIÓN DE TAREAS · 2026-1"];
    resumen.getRow(1).font = { bold: true, size: 14, color: { argb: "FF001F5F" } };
    resumen.mergeCells(1, 1, 1, 3);
    const sedesTxt = sedesF.size === 0 ? "TODAS" : Array.from(sedesF).join(" + ");
    resumen.getRow(2).values = [`Sede: ${sedesTxt}   ·   Facultad: ${facultadF}`];
    resumen.mergeCells(2, 1, 2, 3);
    resumen.getRow(4).values = ["Compañero", "Docentes", "Planillas", "Solicitados"];
    resumen.columns = [{ width: 30 }, { width: 12 }, { width: 12 }, { width: 14 }];
    resumen.getRow(4).eachCell(c => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
      c.alignment = { horizontal: "center" };
    });
    workers.forEach((w, i) => {
      const r = resumen.getRow(5 + i);
      const lista = asignaciones[w.id] || [];
      r.getCell(1).value = w.nombre;
      r.getCell(2).value = lista.length;
      r.getCell(3).value = lista.reduce((s, d) => s + d.planillas.length, 0);
      r.getCell(4).value = w.monto;
    });

    const writeSheet = (name: string, list: DocenteUnit[]) => {
      const ws = wb.addWorksheet(name.slice(0, 30));
      ws.columns = [
        { width: 6 }, { width: 36 }, { width: 12 }, { width: 30 }, { width: 22 },
        { width: 8 }, { width: 8 }, { width: 12 }, { width: 14 }, { width: 38 },
      ];
      ws.getRow(1).values = ["Doc N°", "Docente", "Código", "Curso", "Carrera", "Ciclo", "Sec", "Sede", "Modalidad", "Horario"];
      ws.getRow(1).eachCell(c => {
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5F" } };
        c.alignment = { horizontal: "center", wrapText: true };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
      let row = 2;
      list.forEach((d, docIdx) => {
        d.planillas.forEach((u, i) => {
          const r = ws.getRow(row++);
          const horario = (u.sesiones || []).map(s => `${s.dia}: ${s.hora}${s.horaFin ? ` HASTA LAS ${s.horaFin}` : ""}`).join(" · ")
                          || `${u.dia}: ${u.hora}${u.horaFin ? ` HASTA LAS ${u.horaFin}` : ""}`;
          r.values = [
            i === 0 ? docIdx + 1 : "",
            i === 0 ? d.docente : "",
            u.codigo, u.curso, u.carrera, u.ciclo, u.seccion, u.sede, u.modalidad, horario,
          ];
          r.alignment = { wrapText: true, vertical: "top" };
          r.eachCell(c => {
            c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
            c.font = { size: 10 };
          });
          if (i === 0) {
            r.getCell(1).font = { size: 10, bold: true };
            r.getCell(2).font = { size: 10, bold: true };
          }
        });
      });
    };

    workers.forEach(w => writeSheet(w.nombre || "Sin nombre", asignaciones[w.id] || []));
    if (sobrantes.length > 0) writeSheet("Sobrantes", sobrantes);

    const buf = await wb.xlsx.writeBuffer() as ArrayBuffer;
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Division_Tareas_${sedeF}_2026-1.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando planificación…
        </div>
      </div>
    );
  }

  const filtroBusqueda = (list: DocenteUnit[]) => {
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter(d => {
      const hay = `${d.docente} ${d.planillas.map(u => `${u.curso} ${u.codigo} ${u.carrera} ${u.seccion} ${u.sede}`).join(" ")}`;
      return hay.toLowerCase().includes(q);
    });
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#001f5f]">
            <Users className="h-6 w-6 text-emerald-600" />
            División de Tareas — Subida de Asistencia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reparte aleatoriamente las planillas pendientes entre tus compañeros para subir asistencia.
            Filtra por sede, indica el monto que le toca a cada uno y obtén la asignación sin choques.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={limpiar} disabled={!tieneAsignacion} className="gap-2">
            <Trash2 className="h-4 w-4" /> Limpiar
          </Button>
          <Button onClick={exportXLSX} disabled={!tieneAsignacion} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-border/50 shadow-sm p-4 space-y-3">
        <h3 className="text-sm font-bold text-[#001f5f] flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-emerald-600" /> Configuración del reparto
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sede:</span>
            <button
              type="button"
              onClick={() => setSedesF(new Set())}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition ${sedesF.size === 0 ? "bg-[#001f5f] text-white border-[#001f5f]" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
            >
              TODAS
            </button>
            {sedes.map(s => {
              const active = sedesF.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSedesF(prev => {
                      const n = new Set(prev);
                      if (n.has(s)) n.delete(s); else n.add(s);
                      return n;
                    });
                  }}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition ${active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <PillGroup label="Facultad" value={facultadF} onChange={(v) => setFacultadF(v as "TODAS" | "FCS" | "FICA")} options={["TODAS", "FCS", "FICA"]} />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ciclo:</span>
            {["1","2","3","4","5","6","7","8","9","10"].map(c => {
              const active = ciclosF.has(c);
              return (
                <button key={c} type="button" onClick={() => {
                  setCiclosF(prev => {
                    const n = new Set(prev);
                    if (n.has(c)) n.delete(c); else n.add(c);
                    return n;
                  });
                }} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${active ? "bg-[#001f5f] text-white border-[#001f5f]" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                  {c}
                </button>
              );
            })}
          </div>
          <PillGroup label="Día" value={diaF} onChange={setDiaF} options={["TODOS","LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO"]} />
          <label className="flex items-center gap-1.5 text-xs ml-2 cursor-pointer select-none">
            <input type="checkbox" checked={excluirSubidas} onChange={(e) => setExcluirSubidas(e.target.checked)} />
            Excluir las que <b>ya están subidas</b>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="gap-1" title={excluirSubidas && totalDocentesAll !== docentesCandidatos.length ? `Hay ${totalDocentesAll} docentes en total con estos filtros; ${totalDocentesAll - docentesCandidatos.length} ya tienen toda su asistencia subida y se excluyen del reparto.` : undefined}>
              <UserCheck className="h-3.5 w-3.5" />
              {docentesCandidatos.length} docentes
              {excluirSubidas && totalDocentesAll !== docentesCandidatos.length && (
                <span className="text-muted-foreground font-normal"> de {totalDocentesAll}</span>
              )}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px]">
              {candidatos.length} planillas
            </Badge>
            {yaSubidas.size > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {yaSubidas.size} ya subidas
              </Badge>
            )}
          </div>
        </div>

        {/* Compañeros */}
        <div className="border-t border-border/40 pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Compañeros <span className="text-[10px] text-muted-foreground/80 font-normal normal-case">(deja la cantidad en 0 para que se reparta solo)</span>
            </h4>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={balanceAuto} className="h-7 text-xs gap-1" title="Calcula y muestra cuánto le toca a cada uno">
                <Sparkles className="h-3.5 w-3.5" /> Calcular cantidades
              </Button>
              <Button variant="ghost" size="sm" onClick={addWorker} className="h-7 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" /> Agregar
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {workers.map((w, idx) => {
              const c = COLORES_WORKER[idx % COLORES_WORKER.length];
              return (
                <div key={w.id} className={`flex items-center gap-2 p-2 rounded-lg border ${c.border} ${c.bg}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                  <Input
                    value={w.nombre}
                    onChange={(e) => updateWorker(w.id, { nombre: e.target.value })}
                    placeholder="Nombre"
                    className="h-8 text-sm flex-1 bg-white"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={w.monto}
                    onChange={(e) => updateWorker(w.id, { monto: parseInt(e.target.value) || 0 })}
                    placeholder="Monto"
                    className="h-8 text-sm w-20 bg-white text-center font-bold"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeWorker(w.id)} className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-border/40">
            <div className="text-xs text-muted-foreground">
              Total a repartir: <b className={totalSolicitado > docentesCandidatos.length ? "text-rose-600" : "text-[#001f5f]"}>{totalSolicitado || docentesCandidatos.length}</b> docentes / {docentesCandidatos.length} disponibles
            </div>
            <div className="flex gap-2">
              {tieneAsignacion && (
                <Button variant="outline" onClick={reShuffle} className="gap-2 h-9 text-sm">
                  <Shuffle className="h-4 w-4" /> Volver a sortear
                </Button>
              )}
              <Button onClick={() => repartir({ auto: true })} className="gap-2 h-9 bg-emerald-600 hover:bg-emerald-700 text-white" title="Reparte equitativamente sin necesidad de cantidades">
                <Sparkles className="h-4 w-4" /> División automática
              </Button>
              <Button onClick={() => repartir()} variant="outline" className="gap-2 h-9 border-[#001f5f] text-[#001f5f] hover:bg-[#001f5f]/5" title="Usa las cantidades indicadas por compañero">
                <Shuffle className="h-4 w-4" /> Repartir por cantidad
              </Button>
            </div>
          </div>
          {totalSolicitado > docentesCandidatos.length && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Estás pidiendo más docentes de los que hay disponibles con los filtros actuales.
            </div>
          )}
        </div>
      </div>

      {/* Resultado */}
      {tieneAsignacion && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en las asignaciones…" className="pl-8 h-9 bg-white" />
            </div>
            <Badge className="bg-[#001f5f] text-white border-0">Sede: {sedesF.size === 0 ? "TODAS" : Array.from(sedesF).join(" + ")}</Badge>
            {sobrantes.length > 0 && <Badge className="bg-amber-500 text-white border-0">{sobrantes.length} sobrantes</Badge>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {workers.map((w, idx) => {
              const c = COLORES_WORKER[idx % COLORES_WORKER.length];
              const lista = filtroBusqueda(asignaciones[w.id] || []);
              const totalDoc = (asignaciones[w.id] || []).length;
              const totalPla = (asignaciones[w.id] || []).reduce((s, d) => s + d.planillas.length, 0);
              return (
                <div key={w.id} className="bg-white rounded-xl border border-border/50 shadow-sm overflow-hidden">
                  <div className={`px-4 py-3 ${c.bg} border-b ${c.border} flex items-center justify-between gap-2`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${c.dot}`} />
                      <h3 className={`text-sm font-bold ${c.text}`}>{w.nombre || "Sin nombre"}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={`${c.dot} text-white border-0`}>{totalDoc} docentes</Badge>
                      <Badge variant="outline" className="text-[10px]">{totalPla} planillas</Badge>
                    </div>
                  </div>
                  <div className="max-h-[460px] overflow-auto">
                    {lista.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground text-xs">Sin resultados</div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {lista.map((d, i) => {
                          const subido = marcadosSubidos.has(d.key);
                          return (
                          <div key={d.key} className={`px-3 py-2 transition-colors ${subido ? "bg-emerald-50 hover:bg-emerald-100/70" : "hover:bg-slate-50/60"}`}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => toggleSubido(d.key)}
                                  title={subido ? "Marcado como subido (clic para desmarcar)" : "Marcar como subido"}
                                  className={`shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                                    subido
                                      ? "bg-emerald-600 border-emerald-600 text-white"
                                      : "bg-white border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-300"
                                  }`}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{i + 1}.</span>
                                <span className={`text-xs font-bold truncate ${subido ? "text-emerald-800 line-through decoration-emerald-400/60" : "text-[#001f5f]"}`}>{d.docente}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {subido && <Badge className="bg-emerald-600 text-white border-0 text-[10px]">SUBIDO</Badge>}
                                <Badge variant="secondary" className="text-[10px]">{d.planillas.length} cursos</Badge>
                              </div>
                            </div>
                            <div className="pl-8 space-y-1">
                              {d.planillas.map(u => (
                                <div key={u.key} className="text-[11px] leading-tight border-l-2 border-slate-200 pl-2">
                                  <div className="flex items-start gap-2">
                                    <span className="font-mono text-muted-foreground shrink-0">{u.codigo}</span>
                                    <span className="flex-1 truncate">{u.curso}</span>
                                    <span className="text-[10px] font-semibold text-slate-500 shrink-0">C{u.ciclo}-{u.seccion}</span>
                                    <span className="text-[10px] px-1 rounded bg-slate-100 font-semibold shrink-0">{u.sede}</span>
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap gap-1">
                                    {(u.sesiones && u.sesiones.length > 0 ? u.sesiones : [{ dia: u.dia, hora: u.hora, horaFin: u.horaFin }]).map((s, idx) => (
                                      <span key={idx} className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                        {s.dia}: {s.hora}{s.horaFin ? ` HASTA LAS ${s.horaFin}` : ""}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {sobrantes.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-300 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Sobrantes (no asignadas)
                </h3>
                <Badge className="bg-amber-500 text-white border-0">{sobrantes.length}</Badge>
              </div>
              <div className="max-h-[260px] overflow-auto divide-y divide-border/40">
                {filtroBusqueda(sobrantes).map((d) => (
                  <div key={d.key} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-amber-800">{d.docente}</span>
                      <Badge variant="secondary" className="text-[10px]">{d.planillas.length} cursos</Badge>
                    </div>
                    <div className="pl-3 space-y-0.5">
                      {d.planillas.map(u => (
                        <div key={u.key} className="flex items-start gap-2 text-[11px]">
                          <span className="font-mono text-muted-foreground">{u.codigo}</span>
                          <span className="flex-1 truncate">{u.curso}</span>
                          <span className="text-[10px] font-semibold text-slate-500">C{u.ciclo}-{u.seccion}</span>
                          <span className="text-[10px] text-slate-500">{u.dia}</span>
                          <span className="text-[10px] px-1 rounded bg-slate-100 font-semibold">{u.sede}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PillGroup({ label, value, onChange, options, labelMap }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; labelMap?: Record<string, string>;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${value === o ? "bg-[#001f5f] border-[#001f5f] text-white" : "bg-white text-muted-foreground border-border hover:bg-muted/40"}`}
        >
          {labelMap?.[o] || o}
        </button>
      ))}
    </div>
  );
}
