import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as ExcelJS from "exceljs";
import {
  ShieldAlert, Plus, Trash2, RefreshCw, Search, X,
  UserX, UserMinus, AlertTriangle, FileWarning, Info,
  ChevronDown, Check, Pencil, CheckCircle2, Clock,
  Loader2, Download, RotateCcw, Circle, ArrowUpCircle,
  ArrowDownCircle, MinusCircle, BookOpen, DoorOpen,
  CalendarX, BanIcon, School, Zap, Bell, Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";
const GOLD = "#C9A84C";

// ─── Tipos comunes ────────────────────────────────────────────────────────────
export type EstadoFlag    = "PENDIENTE" | "EN_PROCESO" | "RESUELTO";
export type PrioridadFlag = "ALTA" | "NORMAL" | "BAJA";

// ─── Docentes ────────────────────────────────────────────────────────────────
export type TipoDocente =
  | "RENUNCIO_CARGA" | "NO_REGRESA" | "CAMBIO_PLANIFICACION"
  | "BAJA_TEMPORAL"  | "OTRO";

export type SeguridadDocente = {
  id: number; nombre: string; tipo: TipoDocente;
  estado: EstadoFlag; prioridad: PrioridadFlag;
  observacion: string | null; resolucion: string | null;
  registradoEn: string; registradoPor: string | null;
  resueltaEn: string | null; resueltaPor: string | null;
};

// ─── Incidencias ─────────────────────────────────────────────────────────────
export type TipoIncidencia =
  | "SIN_DOCENTE" | "CAMBIO_AULA" | "CONFLICTO_HORARIO"
  | "CANCELACION" | "ACCESO_RESTRINGIDO" | "OTRO";

export type SeguridadIncidencia = {
  id: number; tipo: TipoIncidencia; curso: string;
  seccion: string | null; aula: string | null;
  estado: EstadoFlag; prioridad: PrioridadFlag;
  observacion: string | null; resolucion: string | null;
  registradoEn: string; registradoPor: string | null;
  resueltaEn: string | null; resueltaPor: string | null;
};

// ─── Catálogos ────────────────────────────────────────────────────────────────
const TIPOS_DOC = [
  { value: "RENUNCIO_CARGA"      as TipoDocente, label: "Renunció a su carga lectiva",   color: "text-red-700",    bg: "bg-red-50 border-red-200",      Icon: UserX },
  { value: "NO_REGRESA"          as TipoDocente, label: "No regresa este semestre",       color: "text-orange-700", bg: "bg-orange-50 border-orange-200", Icon: UserMinus },
  { value: "CAMBIO_PLANIFICACION"as TipoDocente, label: "Cambio en la planificación",     color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",   Icon: AlertTriangle },
  { value: "BAJA_TEMPORAL"       as TipoDocente, label: "Baja temporal",                  color: "text-purple-700", bg: "bg-purple-50 border-purple-200", Icon: FileWarning },
  { value: "OTRO"                as TipoDocente, label: "Otro",                           color: "text-gray-700",   bg: "bg-gray-50 border-gray-200",     Icon: Info },
];

const TIPOS_INC = [
  { value: "SIN_DOCENTE"        as TipoIncidencia, label: "Sección sin docente asignado", desc: "Sección activa que no tiene docente confirmado.",                  color: "text-red-700",    bg: "bg-red-50 border-red-200",       Icon: Users },
  { value: "CAMBIO_AULA"        as TipoIncidencia, label: "Cambio de aula",               desc: "El aula asignada fue modificada o está en disputa.",               color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",      Icon: DoorOpen },
  { value: "CONFLICTO_HORARIO"  as TipoIncidencia, label: "Conflicto de horario",         desc: "Dos actividades asignadas al mismo espacio/tiempo.",               color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",   Icon: CalendarX },
  { value: "CANCELACION"        as TipoIncidencia, label: "Cancelación de sección",       desc: "La sección fue cancelada por causas administrativas o académicas.", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", Icon: BanIcon },
  { value: "ACCESO_RESTRINGIDO" as TipoIncidencia, label: "Acceso restringido al aula",   desc: "El aula no está disponible: mantenimiento, cierre, etc.",          color: "text-purple-700", bg: "bg-purple-50 border-purple-200", Icon: School },
  { value: "OTRO"               as TipoIncidencia, label: "Otra incidencia",              desc: "Cualquier otro problema no contemplado.",                          color: "text-gray-700",   bg: "bg-gray-50 border-gray-200",     Icon: BookOpen },
];

const ESTADOS = [
  { value: "PENDIENTE"  as EstadoFlag, label: "Pendiente",  color: "text-red-600",     bg: "bg-red-50 border-red-200",       Icon: Circle },
  { value: "EN_PROCESO" as EstadoFlag, label: "En proceso", color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",   Icon: Loader2 },
  { value: "RESUELTO"   as EstadoFlag, label: "Resuelto",   color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200",Icon: CheckCircle2 },
];

const PRIORIDADES = [
  { value: "ALTA"   as PrioridadFlag, label: "Alta",   color: "text-red-600",  Icon: ArrowUpCircle },
  { value: "NORMAL" as PrioridadFlag, label: "Normal", color: "text-blue-600", Icon: MinusCircle },
  { value: "BAJA"   as PrioridadFlag, label: "Baja",   color: "text-gray-400", Icon: ArrowDownCircle },
];

function tipoDocInfo(t: string)  { return TIPOS_DOC.find(x => x.value === t) ?? TIPOS_DOC[TIPOS_DOC.length - 1]; }
function tipoIncInfo(t: string)  { return TIPOS_INC.find(x => x.value === t) ?? TIPOS_INC[TIPOS_INC.length - 1]; }
function estadoInfo(e: string)   { return ESTADOS.find(x => x.value === e) ?? ESTADOS[0]; }
function prioInfo(p: string)     { return PRIORIDADES.find(x => x.value === p) ?? PRIORIDADES[1]; }

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "Etc/GMT+5", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ─── Excel export ─────────────────────────────────────────────────────────────
async function exportarExcel(
  docentes: SeguridadDocente[],
  incidencias: SeguridadIncidencia[],
  baseUrl: string,
) {
  const wb = new ExcelJS.Workbook();
  const NAVY_A = "FF001F5F";
  const GOLD_A = "FFC9A84C";
  const WHITE  = "FFFFFFFF";

  const mkSheet = (ws: ExcelJS.Worksheet, cols: { width: number }[], title: string, subtitle: string, total: number) => {
    ws.columns = cols;
    try { /* logo attached later */ } catch { /* */ }

    ws.mergeCells(`C1:${String.fromCharCode(65 + cols.length - 1)}1`);
    const c1 = ws.getCell("C1");
    c1.value = "UNIVERSIDAD AUTÓNOMA DE ICA — Portal Académico 2026-I";
    c1.font = { bold: true, size: 12, color: { argb: NAVY_A }, name: "Calibri" };
    c1.alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells(`C2:${String.fromCharCode(65 + cols.length - 1)}2`);
    const c2 = ws.getCell("C2");
    c2.value = `Módulo Seguridad — ${title}`;
    c2.font = { bold: true, size: 11, color: { argb: GOLD_A }, name: "Calibri" };
    c2.alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells(`C3:${String.fromCharCode(65 + cols.length - 1)}3`);
    const c3 = ws.getCell("C3");
    c3.value = `${subtitle} — Total: ${total} — Generado: ${new Date().toLocaleString("es-PE", { timeZone: "Etc/GMT+5" })}`;
    c3.font = { size: 8, color: { argb: "FF666666" }, name: "Calibri" };
    c3.alignment = { horizontal: "center" };

    ws.getRow(1).height = 22;
    ws.getRow(2).height = 20;
    ws.getRow(3).height = 14;
    ws.getRow(4).height = 6;
    ws.mergeCells(`A4:${String.fromCharCode(65 + cols.length - 1)}4`);
    ws.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_A } };
  };

  const mkHeader = (ws: ExcelJS.Worksheet, headers: string[], rowNum: number) => {
    ws.getRow(rowNum).height = 20;
    headers.forEach((h, i) => {
      const cell = ws.getRow(rowNum).getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9.5, color: { argb: WHITE }, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_A } };
      cell.alignment = { horizontal: i <= 1 ? "left" : "center", vertical: "middle" };
    });
  };

  const ESTADO_BG: Record<string, string> = { PENDIENTE: "FFFEE2E2", EN_PROCESO: "FFFEF3C7", RESUELTO: "FFD1FAE5" };

  // Sheet 1: Docentes
  const ws1 = wb.addWorksheet("Situaciones Docentes");
  mkSheet(ws1,
    [{ width: 5 },{ width: 36 },{ width: 22 },{ width: 14 },{ width: 10 },{ width: 28 },{ width: 28 },{ width: 18 },{ width: 16 },{ width: 18 }],
    "Situaciones Docentes", `${docentes.length} registros`, docentes.length);
  mkHeader(ws1, ["N°","Docente","Tipo","Estado","Prioridad","Observación","Resolución","Registrado en","Por","Resuelto en"], 5);
  docentes.forEach((r, i) => {
    const rn = 6 + i;
    ws1.getRow(rn).height = 15;
    const bg = ESTADO_BG[r.estado] ?? "FFFFFFFF";
    const vals = [i+1, r.nombre, tipoDocInfo(r.tipo).label, r.estado, r.prioridad, r.observacion ?? "", r.resolucion ?? "", formatDate(r.registradoEn), r.registradoPor ?? "", formatDate(r.resueltaEn)];
    vals.forEach((v, ci) => {
      const cell = ws1.getRow(rn).getCell(ci + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { size: 9, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? bg : "FFFAFAFA" } };
      cell.alignment = { horizontal: ci <= 1 ? "left" : "center", vertical: "middle" };
    });
  });

  // Sheet 2: Incidencias
  const ws2 = wb.addWorksheet("Incidencias Cursos y Aulas");
  mkSheet(ws2,
    [{ width: 5 },{ width: 30 },{ width: 12 },{ width: 14 },{ width: 22 },{ width: 14 },{ width: 10 },{ width: 28 },{ width: 28 },{ width: 18 }],
    "Incidencias Cursos y Aulas", `${incidencias.length} registros`, incidencias.length);
  mkHeader(ws2, ["N°","Curso","Sección","Aula","Tipo de Incidencia","Estado","Prioridad","Observación","Resolución","Registrado en"], 5);
  incidencias.forEach((r, i) => {
    const rn = 6 + i;
    ws2.getRow(rn).height = 15;
    const bg = ESTADO_BG[r.estado] ?? "FFFFFFFF";
    const vals = [i+1, r.curso, r.seccion ?? "—", r.aula ?? "—", tipoIncInfo(r.tipo).label, r.estado, r.prioridad, r.observacion ?? "", r.resolucion ?? "", formatDate(r.registradoEn)];
    vals.forEach((v, ci) => {
      const cell = ws2.getRow(rn).getCell(ci + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { size: 9, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? bg : "FFFAFAFA" } };
      cell.alignment = { horizontal: ci <= 1 ? "left" : "center", vertical: "middle" };
    });
  });

  // Footer both sheets
  [ws1, ws2].forEach(ws => {
    const lastRow = ws.rowCount + 1;
    const lastCol = String.fromCharCode(65 + ws.columnCount - 1);
    ws.mergeCells(`A${lastRow}:${lastCol}${lastRow}`);
    const foot = ws.getCell(`A${lastRow}`);
    foot.value = "Universidad Autónoma de Ica · Portal Académico 2026-I";
    foot.font = { size: 8, italic: true, color: { argb: "FF999999" }, name: "Calibri" };
    foot.alignment = { horizontal: "center" };
    foot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `seguridad-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Shared sub-components ────────────────────────────────────────────────────
type PrioridadSelectorProps = {
  value: PrioridadFlag; onChange: (v: PrioridadFlag) => void;
};
function PrioridadSelector({ value, onChange }: PrioridadSelectorProps) {
  return (
    <div className="flex gap-2">
      {PRIORIDADES.map(p => (
        <button key={p.value} type="button" onClick={() => onChange(p.value)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
            value === p.value ? `${p.color} border-current bg-current/5` : "border-gray-200 text-gray-400 hover:border-gray-300"
          }`}
        >
          <p.Icon className="w-3.5 h-3.5" /> {p.label}
        </button>
      ))}
    </div>
  );
}

type EstadoBadgeProps = { estado: EstadoFlag };
function EstadoBadge({ estado }: EstadoBadgeProps) {
  const e = estadoInfo(estado);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${e.bg} ${e.color}`}>
      <e.Icon className="w-2.5 h-2.5" /> {e.label}
    </span>
  );
}

// ─── PlanRow type ─────────────────────────────────────────────────────────────
type PlanRow = { docente: string; [k: string]: unknown };

// ─── Main component ───────────────────────────────────────────────────────────
type Tab = "docentes" | "incidencias" | "alertas";

export default function Seguridad() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("docentes");

  // ── Docentes state ─────────────────────────────────────────────────────────
  const [docentes, setDocentes] = useState<SeguridadDocente[]>([]);
  const [allDocentes, setAllDocentes] = useState<string[]>([]);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [searchDoc, setSearchDoc] = useState("");
  const [filterTipoDoc, setFilterTipoDoc] = useState("TODOS");
  const [filterEstadoDoc, setFilterEstadoDoc] = useState("ACTIVOS");

  // Docente form
  const [showFormDoc, setShowFormDoc] = useState(false);
  const [newDocNombre, setNewDocNombre] = useState("");
  const [docenteQuery, setDocenteQuery] = useState("");
  const [docenteOpen, setDocenteOpen] = useState(false);
  const docenteRef = useRef<HTMLDivElement>(null);
  const [newDocTipo, setNewDocTipo] = useState<TipoDocente>("RENUNCIO_CARGA");
  const [newDocPrio, setNewDocPrio] = useState<PrioridadFlag>("NORMAL");
  const [newDocObs, setNewDocObs] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);
  const [tipoDocOpen, setTipoDocOpen] = useState(false);

  // Docente edit/resolve
  const [editDocId, setEditDocId] = useState<number | null>(null);
  const [editDocObs, setEditDocObs] = useState("");
  const [editDocTipo, setEditDocTipo] = useState<TipoDocente>("RENUNCIO_CARGA");
  const [editDocPrio, setEditDocPrio] = useState<PrioridadFlag>("NORMAL");
  const [resolveDocId, setResolveDocId] = useState<number | null>(null);
  const [resolveDocNote, setResolveDocNote] = useState("");
  const [resolvingDoc, setResolvingDoc] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<number | null>(null);

  // ── Incidencias state ──────────────────────────────────────────────────────
  const [incidencias, setIncidencias] = useState<SeguridadIncidencia[]>([]);
  const [loadingInc, setLoadingInc] = useState(false);
  const [searchInc, setSearchInc] = useState("");
  const [filterTipoInc, setFilterTipoInc] = useState("TODOS");
  const [filterEstadoInc, setFilterEstadoInc] = useState("ACTIVOS");

  // Incidencia form
  const [showFormInc, setShowFormInc] = useState(false);
  const [newIncTipo, setNewIncTipo] = useState<TipoIncidencia>("SIN_DOCENTE");
  const [newIncCurso, setNewIncCurso] = useState("");
  const [newIncSeccion, setNewIncSeccion] = useState("");
  const [newIncAula, setNewIncAula] = useState("");
  const [newIncPrio, setNewIncPrio] = useState<PrioridadFlag>("NORMAL");
  const [newIncObs, setNewIncObs] = useState("");
  const [savingInc, setSavingInc] = useState(false);
  const [tipoIncOpen, setTipoIncOpen] = useState(false);

  // Incidencia edit/resolve
  const [editIncId, setEditIncId] = useState<number | null>(null);
  const [editIncObs, setEditIncObs] = useState("");
  const [editIncPrio, setEditIncPrio] = useState<PrioridadFlag>("NORMAL");
  const [resolveIncId, setResolveIncId] = useState<number | null>(null);
  const [resolveIncNote, setResolveIncNote] = useState("");
  const [resolvingInc, setResolvingInc] = useState(false);
  const [deletingInc, setDeletingInc] = useState<number | null>(null);

  const [exporting, setExporting] = useState(false);

  // ── Registered names (no duplicates) ──────────────────────────────────────
  const registeredNames = useMemo(() => new Set(docentes.map(d => d.nombre.trim().toUpperCase())), [docentes]);
  const docenteSugs = useMemo(() => {
    const q = docenteQuery.trim().toUpperCase();
    return (q ? allDocentes.filter(n => n.includes(q)) : allDocentes).slice(0, 60);
  }, [allDocentes, docenteQuery]);

  useEffect(() => {
    function h(e: MouseEvent) { if (docenteRef.current && !docenteRef.current.contains(e.target as Node)) setDocenteOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDoc = useCallback(async () => {
    setLoadingDoc(true);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes`, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      setDocentes(await r.json());
    } catch (e) { toast({ title: "Error al cargar docentes", description: String(e), variant: "destructive" }); }
    finally { setLoadingDoc(false); }
  }, []);

  const fetchInc = useCallback(async () => {
    setLoadingInc(true);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-incidencias`, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      setIncidencias(await r.json());
    } catch (e) { toast({ title: "Error al cargar incidencias", description: String(e), variant: "destructive" }); }
    finally { setLoadingInc(false); }
  }, []);

  useEffect(() => { fetchDoc(); fetchInc(); }, [fetchDoc, fetchInc]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}planificacion-fica-2026-1.json`).then(r => r.ok ? r.json() : []),
      fetch(`${base}planificacion-fcs-2026-1.json`).then(r => r.ok ? r.json() : []),
    ]).then(([fica, fcs]: [PlanRow[], PlanRow[]]) => {
      const names = new Set<string>();
      [...fica, ...fcs].forEach(row => { if (row.docente) names.add(row.docente.trim().toUpperCase()); });
      setAllDocentes([...names].sort());
    }).catch(() => {});
  }, []);

  // ── Docentes CRUD ──────────────────────────────────────────────────────────
  async function saveDoc() {
    if (!newDocNombre.trim()) { toast({ title: "Selecciona un docente", variant: "destructive" }); return; }
    setSavingDoc(true);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ nombre: newDocNombre, tipo: newDocTipo, prioridad: newDocPrio, observacion: newDocObs.trim() || null, registradoPor: user?.username }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `${r.status}`);
      const nuevo = await r.json();
      setDocentes(p => [nuevo, ...p]);
      setNewDocNombre(""); setDocenteQuery(""); setNewDocTipo("RENUNCIO_CARGA"); setNewDocPrio("NORMAL"); setNewDocObs(""); setShowFormDoc(false);
      toast({ title: "Docente registrado" });
    } catch (e) { toast({ title: "Error", description: String(e), variant: "destructive" }); }
    finally { setSavingDoc(false); }
  }

  async function deleteDoc(id: number) {
    if (!confirm("¿Eliminar este registro?")) return;
    setDeletingDoc(id);
    try {
      await fetch(`${apiBase}/api/seguridad-docentes/${id}`, { method: "DELETE", credentials: "include" });
      setDocentes(p => p.filter(x => x.id !== id));
      toast({ title: "Eliminado" });
    } catch { toast({ title: "Error al eliminar", variant: "destructive" }); }
    finally { setDeletingDoc(null); }
  }

  async function editDocSave(id: number) {
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ observacion: editDocObs, tipo: editDocTipo, prioridad: editDocPrio }),
      });
      const updated = await r.json();
      setDocentes(p => p.map(x => x.id === id ? updated : x));
      setEditDocId(null); toast({ title: "Actualizado" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  async function resolveDoc(id: number) {
    setResolvingDoc(true);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ estado: "RESUELTO", resolucion: resolveDocNote.trim() || null, resueltaPor: user?.username }),
      });
      const updated = await r.json();
      setDocentes(p => p.map(x => x.id === id ? updated : x));
      setResolveDocId(null); setResolveDocNote("");
      toast({ title: "Marcado como resuelto" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setResolvingDoc(false); }
  }

  async function cambiarEstadoDoc(id: number, estado: EstadoFlag) {
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ estado, resueltaPor: estado === "RESUELTO" ? user?.username : null }),
      });
      const updated = await r.json();
      setDocentes(p => p.map(x => x.id === id ? updated : x));
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  // ── Incidencias CRUD ───────────────────────────────────────────────────────
  async function saveInc() {
    if (!newIncCurso.trim()) { toast({ title: "Escribe el nombre del curso o sección", variant: "destructive" }); return; }
    setSavingInc(true);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-incidencias`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ tipo: newIncTipo, curso: newIncCurso, seccion: newIncSeccion || null, aula: newIncAula || null, prioridad: newIncPrio, observacion: newIncObs.trim() || null, registradoPor: user?.username }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `${r.status}`);
      const nuevo = await r.json();
      setIncidencias(p => [nuevo, ...p]);
      setNewIncCurso(""); setNewIncSeccion(""); setNewIncAula(""); setNewIncTipo("SIN_DOCENTE"); setNewIncPrio("NORMAL"); setNewIncObs(""); setShowFormInc(false);
      toast({ title: "Incidencia registrada" });
    } catch (e) { toast({ title: "Error", description: String(e), variant: "destructive" }); }
    finally { setSavingInc(false); }
  }

  async function deleteInc(id: number) {
    if (!confirm("¿Eliminar esta incidencia?")) return;
    setDeletingInc(id);
    try {
      await fetch(`${apiBase}/api/seguridad-incidencias/${id}`, { method: "DELETE", credentials: "include" });
      setIncidencias(p => p.filter(x => x.id !== id));
      toast({ title: "Eliminado" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setDeletingInc(null); }
  }

  async function editIncSave(id: number) {
    try {
      const r = await fetch(`${apiBase}/api/seguridad-incidencias/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ observacion: editIncObs, prioridad: editIncPrio }),
      });
      const updated = await r.json();
      setIncidencias(p => p.map(x => x.id === id ? updated : x));
      setEditIncId(null); toast({ title: "Actualizado" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  async function resolveInc(id: number) {
    setResolvingInc(true);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-incidencias/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ estado: "RESUELTO", resolucion: resolveIncNote.trim() || null, resueltaPor: user?.username }),
      });
      const updated = await r.json();
      setIncidencias(p => p.map(x => x.id === id ? updated : x));
      setResolveIncId(null); setResolveIncNote("");
      toast({ title: "Incidencia resuelta" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setResolvingInc(false); }
  }

  async function cambiarEstadoInc(id: number, estado: EstadoFlag) {
    try {
      const r = await fetch(`${apiBase}/api/seguridad-incidencias/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ estado }),
      });
      const updated = await r.json();
      setIncidencias(p => p.map(x => x.id === id ? updated : x));
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  // ── Derived / computed ─────────────────────────────────────────────────────
  const docActivos     = docentes.filter(d => d.estado !== "RESUELTO");
  const incActivas     = incidencias.filter(i => i.estado !== "RESUELTO");
  const totalCriticos  = [...docActivos, ...incActivas].filter(x => x.prioridad === "ALTA").length;
  const totalPendientes = [...docentes, ...incidencias].filter(x => x.estado === "PENDIENTE").length;

  const filteredDoc = useMemo(() => docentes.filter(r => {
    if (filterEstadoDoc === "ACTIVOS" && r.estado === "RESUELTO") return false;
    if (filterEstadoDoc !== "ACTIVOS" && filterEstadoDoc !== "TODOS" && r.estado !== filterEstadoDoc) return false;
    if (filterTipoDoc !== "TODOS" && r.tipo !== filterTipoDoc) return false;
    const q = searchDoc.trim().toUpperCase();
    return !q || r.nombre.toUpperCase().includes(q) || (r.observacion || "").toUpperCase().includes(q);
  }), [docentes, filterEstadoDoc, filterTipoDoc, searchDoc]);

  const filteredInc = useMemo(() => incidencias.filter(r => {
    if (filterEstadoInc === "ACTIVOS" && r.estado === "RESUELTO") return false;
    if (filterEstadoInc !== "ACTIVOS" && filterEstadoInc !== "TODOS" && r.estado !== filterEstadoInc) return false;
    if (filterTipoInc !== "TODOS" && r.tipo !== filterTipoInc) return false;
    const q = searchInc.trim().toUpperCase();
    return !q || r.curso.toUpperCase().includes(q) || (r.seccion || "").toUpperCase().includes(q) || (r.observacion || "").toUpperCase().includes(q);
  }), [incidencias, filterEstadoInc, filterTipoInc, searchInc]);

  // Alerts
  const alertas = useMemo(() => {
    const list: { tipo: "critica" | "aviso" | "info"; titulo: string; detalle: string }[] = [];
    const docCriticos = docActivos.filter(d => d.prioridad === "ALTA" && d.estado === "PENDIENTE");
    if (docCriticos.length > 0) {
      docCriticos.forEach(d => list.push({ tipo: "critica", titulo: `Docente sin atender — ${d.nombre}`, detalle: `Tipo: ${tipoDocInfo(d.tipo).label} · Pendiente desde ${formatDate(d.registradoEn)}` }));
    }
    const incCriticas = incActivas.filter(i => i.prioridad === "ALTA" && i.estado === "PENDIENTE");
    if (incCriticas.length > 0) {
      incCriticas.forEach(i => list.push({ tipo: "critica", titulo: `Incidencia crítica — ${i.curso}${i.seccion ? ` (Secc. ${i.seccion})` : ""}`, detalle: `${tipoIncInfo(i.tipo).label} · Registrado: ${formatDate(i.registradoEn)}` }));
    }
    const viejosDoc = docActivos.filter(d => d.estado === "PENDIENTE" && daysSince(d.registradoEn) >= 5);
    viejosDoc.forEach(d => list.push({ tipo: "aviso", titulo: `Situación docente sin resolver (${daysSince(d.registradoEn)} días)`, detalle: `${d.nombre} — ${tipoDocInfo(d.tipo).label}` }));
    const viejasInc = incActivas.filter(i => i.estado === "PENDIENTE" && daysSince(i.registradoEn) >= 5);
    viejasInc.forEach(i => list.push({ tipo: "aviso", titulo: `Incidencia sin resolver (${daysSince(i.registradoEn)} días)`, detalle: `${i.curso}${i.seccion ? ` Secc. ${i.seccion}` : ""} — ${tipoIncInfo(i.tipo).label}` }));
    const enProceso = [...docActivos, ...incActivas].filter(x => x.estado === "EN_PROCESO");
    if (enProceso.length > 0) list.push({ tipo: "info", titulo: `${enProceso.length} situaciones en proceso`, detalle: "En seguimiento activo por el equipo." });
    if (list.length === 0) list.push({ tipo: "info", titulo: "Sin alertas activas", detalle: "No hay situaciones críticas ni pendientes urgentes en este momento." });
    return list;
  }, [docActivos, incActivas]);

  const selectedDocTipo = TIPOS_DOC.find(t => t.value === newDocTipo)!;
  const selectedIncTipo = TIPOS_INC.find(t => t.value === newIncTipo)!;

  // ── Generic record card for docentes ──────────────────────────────────────
  const DocCard = ({ r }: { r: SeguridadDocente }) => {
    const tipo = tipoDocInfo(r.tipo);
    const resuelto = r.estado === "RESUELTO";
    const isEditing = editDocId === r.id;
    const isResolving = resolveDocId === r.id;
    return (
      <Card className={`rounded-xl border-2 shadow-sm overflow-hidden transition-all ${resuelto ? "opacity-65 border-emerald-200 bg-emerald-50/30" : tipo.bg}`}>
        <CardContent className="p-0">
          <div className="flex items-start gap-3 p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${resuelto ? "bg-emerald-100" : tipo.bg}`}>
              {resuelto ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <tipo.Icon className={`w-5 h-5 ${tipo.color}`} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${resuelto ? "text-emerald-700 line-through" : tipo.color}`}>{r.nombre}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tipo.bg} ${tipo.color}`}>
                      <tipo.Icon className="w-2.5 h-2.5" /> {tipo.label}
                    </span>
                    <EstadoBadge estado={r.estado} />
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${prioInfo(r.prioridad).color}`}>
                      <ArrowUpCircle className="w-3 h-3" /> {r.prioridad}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!resuelto && <>
                    {r.estado === "PENDIENTE" && (
                      <button onClick={() => cambiarEstadoDoc(r.id, "EN_PROCESO")} className="p-1.5 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 border border-amber-200 transition-colors" title="Marcar en proceso"><Clock className="w-3.5 h-3.5" /></button>
                    )}
                    <button onClick={() => { setResolveDocId(r.id); setResolveDocNote(""); }} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 border border-emerald-200 transition-colors" title="Resolver"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                  </>}
                  {resuelto && <button onClick={() => cambiarEstadoDoc(r.id, "PENDIENTE")} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200 transition-colors" title="Reabrir"><RotateCcw className="w-3.5 h-3.5" /></button>}
                  <button onClick={() => { setEditDocId(isEditing ? null : r.id); setEditDocObs(r.observacion || ""); setEditDocTipo(r.tipo); setEditDocPrio(r.prioridad); }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-white/60 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteDoc(r.id)} disabled={deletingDoc === r.id} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-white/60 transition-colors disabled:opacity-40">{deletingDoc === r.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                </div>
              </div>
              {!isEditing && !isResolving && r.observacion && <p className={`mt-1.5 text-xs italic ${tipo.color} opacity-80`}>"{r.observacion}"</p>}
              {resuelto && r.resolucion && <p className="mt-1.5 text-xs italic text-emerald-600">✓ {r.resolucion}</p>}
              {isResolving && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-emerald-700">¿Cómo se resolvió? (opcional)</p>
                  <textarea value={resolveDocNote} onChange={e => setResolveDocNote(e.target.value)} rows={2} className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-xs bg-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Detalle de la solución..." />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => resolveDoc(r.id)} disabled={resolvingDoc}>{resolvingDoc ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}Marcar Resuelto</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResolveDocId(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
              {isEditing && (
                <div className="mt-3 p-3 bg-white/60 border border-gray-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Tipo</p>
                      <select value={editDocTipo} onChange={e => setEditDocTipo(e.target.value as TipoDocente)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                        {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Prioridad</p>
                      <select value={editDocPrio} onChange={e => setEditDocPrio(e.target.value as PrioridadFlag)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                        {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <textarea value={editDocObs} onChange={e => setEditDocObs(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Observación..." />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" style={{ background: NAVY, color: "#fff" }} onClick={() => editDocSave(r.id)}><Check className="w-3 h-3 mr-1" />Guardar</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditDocId(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 flex-wrap">
                <span>{formatDate(r.registradoEn)}</span>
                {r.registradoPor && <span>· Por: <span className="font-semibold">{r.registradoPor}</span></span>}
                {resuelto && r.resueltaEn && <span className="text-emerald-500">· Resuelto: {formatDate(r.resueltaEn)}{r.resueltaPor ? ` por ${r.resueltaPor}` : ""}</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── Incidencia card ────────────────────────────────────────────────────────
  const IncCard = ({ r }: { r: SeguridadIncidencia }) => {
    const tipo = tipoIncInfo(r.tipo);
    const resuelto = r.estado === "RESUELTO";
    const isEditing = editIncId === r.id;
    const isResolving = resolveIncId === r.id;
    return (
      <Card className={`rounded-xl border-2 shadow-sm overflow-hidden transition-all ${resuelto ? "opacity-65 border-emerald-200 bg-emerald-50/30" : tipo.bg}`}>
        <CardContent className="p-0">
          <div className="flex items-start gap-3 p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${resuelto ? "bg-emerald-100" : tipo.bg}`}>
              {resuelto ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <tipo.Icon className={`w-5 h-5 ${tipo.color}`} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${resuelto ? "text-emerald-700 line-through" : tipo.color}`}>{r.curso}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {r.seccion && <span className="text-[10px] bg-white/70 border px-1.5 py-0.5 rounded text-gray-600 font-mono">Secc. {r.seccion}</span>}
                    {r.aula && <span className="text-[10px] bg-white/70 border px-1.5 py-0.5 rounded text-gray-600 font-mono">Aula {r.aula}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tipo.bg} ${tipo.color}`}><tipo.Icon className="w-2.5 h-2.5" />{tipo.label}</span>
                    <EstadoBadge estado={r.estado} />
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${prioInfo(r.prioridad).color}`}><ArrowUpCircle className="w-3 h-3" />{r.prioridad}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!resuelto && <>
                    {r.estado === "PENDIENTE" && <button onClick={() => cambiarEstadoInc(r.id, "EN_PROCESO")} className="p-1.5 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 border border-amber-200 transition-colors" title="En proceso"><Clock className="w-3.5 h-3.5" /></button>}
                    <button onClick={() => { setResolveIncId(r.id); setResolveIncNote(""); }} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 border border-emerald-200 transition-colors" title="Resolver"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                  </>}
                  {resuelto && <button onClick={() => cambiarEstadoInc(r.id, "PENDIENTE")} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200 transition-colors" title="Reabrir"><RotateCcw className="w-3.5 h-3.5" /></button>}
                  <button onClick={() => { setEditIncId(isEditing ? null : r.id); setEditIncObs(r.observacion || ""); setEditIncPrio(r.prioridad); }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-white/60 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteInc(r.id)} disabled={deletingInc === r.id} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-white/60 transition-colors disabled:opacity-40">{deletingInc === r.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                </div>
              </div>
              {!isEditing && !isResolving && r.observacion && <p className={`mt-1.5 text-xs italic ${tipo.color} opacity-80`}>"{r.observacion}"</p>}
              {resuelto && r.resolucion && <p className="mt-1.5 text-xs italic text-emerald-600">✓ {r.resolucion}</p>}
              {isResolving && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-emerald-700">¿Cómo se resolvió?</p>
                  <textarea value={resolveIncNote} onChange={e => setResolveIncNote(e.target.value)} rows={2} className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-xs bg-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Detalle..." />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => resolveInc(r.id)} disabled={resolvingInc}><CheckCircle2 className="w-3 h-3 mr-1" />Marcar Resuelta</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResolveIncId(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
              {isEditing && (
                <div className="mt-3 p-3 bg-white/60 border border-gray-200 rounded-xl space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Prioridad</p>
                    <PrioridadSelector value={editIncPrio} onChange={setEditIncPrio} />
                  </div>
                  <textarea value={editIncObs} onChange={e => setEditIncObs(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white resize-none focus:outline-none" placeholder="Observación..." />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" style={{ background: NAVY, color: "#fff" }} onClick={() => editIncSave(r.id)}><Check className="w-3 h-3 mr-1" />Guardar</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditIncId(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                <span>{formatDate(r.registradoEn)}</span>
                {r.registradoPor && <span>· Por: <span className="font-semibold">{r.registradoPor}</span></span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 p-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}>
            <ShieldAlert className="w-6 h-6" /> Módulo de Seguridad
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de situaciones docentes e incidencias de cursos y aulas — 2026-I
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { fetchDoc(); fetchInc(); }} disabled={loadingDoc || loadingInc}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${(loadingDoc || loadingInc) ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button size="sm" variant="outline" onClick={async () => {
            setExporting(true);
            try { await exportarExcel(docentes, incidencias, import.meta.env.BASE_URL); }
            catch { toast({ title: "Error al exportar", variant: "destructive" }); }
            finally { setExporting(false); }
          }} disabled={exporting}>
            <Download className={`w-4 h-4 mr-1.5 ${exporting ? "animate-spin" : ""}`} />
            {exporting ? "Exportando…" : "Excel Completo"}
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Docentes activos",     value: docActivos.length,    color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",      Icon: Users },
          { label: "Incidencias activas",  value: incActivas.length,    color: "text-purple-700",  bg: "bg-purple-50 border-purple-200",  Icon: BookOpen },
          { label: "Casos críticos",       value: totalCriticos,        color: "text-red-700",     bg: "bg-red-50 border-red-200",        Icon: Zap },
          { label: "Pendientes en total",  value: totalPendientes,      color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",    Icon: Bell },
        ].map(({ label, value, color, bg, Icon }) => (
          <div key={label} className={`rounded-xl border-2 p-3 ${bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className={`text-2xl font-black ${color}`}>{value}</span>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${color} opacity-70`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {([
          { key: "docentes",    label: "Situaciones Docentes", badge: docActivos.length },
          { key: "incidencias", label: "Cursos y Aulas",       badge: incActivas.length },
          { key: "alertas",     label: "Alertas",              badge: alertas.filter(a => a.tipo === "critica" || a.tipo === "aviso").length },
        ] as { key: Tab; label: string; badge: number }[]).map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
              tab === key
                ? "border-current text-[#001F5F]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            style={tab === key ? { borderColor: NAVY } : {}}
          >
            {label}
            {badge > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                tab === key ? "bg-[#001F5F] text-white" : "bg-gray-200 text-gray-600"
              }`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Docentes ── */}
      {tab === "docentes" && (
        <div className="flex flex-col gap-4">
          {/* Actions */}
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setShowFormDoc(v => !v); if (showFormDoc) { setNewDocNombre(""); setDocenteQuery(""); } }} style={{ background: NAVY, color: "#fff" }}>
              <Plus className="w-4 h-4 mr-1.5" />{showFormDoc ? "Cancelar" : "Nuevo Registro"}
            </Button>
          </div>

          {/* Form */}
          {showFormDoc && (
            <Card className="rounded-2xl border-2" style={{ borderColor: NAVY + "30" }}>
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-bold" style={{ color: NAVY }}>Registrar Situación de Docente</p>

                {/* Docente combobox */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Docente *</label>
                  <div ref={docenteRef} className="relative">
                    <div className={`flex items-center gap-2 w-full border-2 rounded-xl px-3 py-2.5 cursor-text transition-all ${docenteOpen ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300"} bg-white`} onClick={() => setDocenteOpen(true)}>
                      <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <input
                        type="text"
                        className="flex-1 text-sm font-medium bg-transparent outline-none placeholder:text-gray-400"
                        placeholder={allDocentes.length === 0 ? "Cargando…" : "Buscar docente del sistema…"}
                        value={newDocNombre ? newDocNombre : docenteQuery}
                        onChange={e => { setNewDocNombre(""); setDocenteQuery(e.target.value.toUpperCase()); setDocenteOpen(true); }}
                        onFocus={() => setDocenteOpen(true)}
                      />
                      {newDocNombre ? <button type="button" onClick={() => { setNewDocNombre(""); setDocenteQuery(""); }}><X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" /></button>
                        : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                    </div>
                    {docenteOpen && (
                      <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
                        <div className="max-h-52 overflow-y-auto">
                          {docenteSugs.length === 0
                            ? <p className="px-4 py-3 text-sm text-gray-400 italic">Sin coincidencias</p>
                            : docenteSugs.map(nombre => {
                              const ya = registeredNames.has(nombre);
                              return (
                                <button key={nombre} type="button" disabled={ya}
                                  onClick={() => { setNewDocNombre(nombre); setDocenteQuery(""); setDocenteOpen(false); }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm border-b last:border-0 transition-colors ${newDocNombre === nombre ? "bg-blue-50 font-semibold" : ""} ${ya ? "opacity-40 cursor-not-allowed bg-gray-50" : "hover:bg-primary/5"}`}
                                >
                                  <span className="flex-1 font-medium">{nombre}</span>
                                  {newDocNombre === nombre && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                  {ya && <span className="text-[10px] font-bold text-orange-500 shrink-0">YA REGISTRADO</span>}
                                </button>
                              );
                            })}
                        </div>
                        <div className="px-3 py-1.5 border-t bg-gray-50 text-[10px] text-gray-400">{allDocentes.length} docentes disponibles</div>
                      </div>
                    )}
                  </div>
                  {newDocNombre && <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1"><Check className="w-3 h-3" />Seleccionado</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tipo */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Tipo *</label>
                    <div className="relative">
                      <button type="button" onClick={() => setTipoDocOpen(v => !v)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${selectedDocTipo.bg} ${selectedDocTipo.color}`}>
                        <span className="flex items-center gap-2"><selectedDocTipo.Icon className="w-4 h-4" />{selectedDocTipo.label}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${tipoDocOpen ? "rotate-180" : ""}`} />
                      </button>
                      {tipoDocOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                          {TIPOS_DOC.map(t => (
                            <button key={t.value} type="button" onClick={() => { setNewDocTipo(t.value); setTipoDocOpen(false); }}
                              className={`w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 border-b last:border-0 ${newDocTipo === t.value ? "bg-blue-50" : ""}`}>
                              <t.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.color}`} />
                              <span className={`text-sm font-semibold ${t.color}`}>{t.label}</span>
                              {newDocTipo === t.value && <Check className="w-4 h-4 text-blue-600 ml-auto" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Prioridad */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Prioridad</label>
                    <PrioridadSelector value={newDocPrio} onChange={setNewDocPrio} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Observación</label>
                  <textarea value={newDocObs} onChange={e => setNewDocObs(e.target.value)} rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Detalles de la situación..." />
                </div>

                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowFormDoc(false)}>Cancelar</Button>
                  <Button size="sm" onClick={saveDoc} disabled={savingDoc} style={{ background: NAVY, color: "#fff" }}>
                    {savingDoc ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Guardando…</> : "Guardar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { key: "ACTIVOS", label: `Activos (${docActivos.length})` },
              { key: "PENDIENTE", label: `Pendientes (${docentes.filter(d=>d.estado==="PENDIENTE").length})` },
              { key: "EN_PROCESO", label: `En proceso (${docentes.filter(d=>d.estado==="EN_PROCESO").length})` },
              { key: "RESUELTO", label: `Resueltos (${docentes.filter(d=>d.estado==="RESUELTO").length})` },
              { key: "TODOS", label: `Todos (${docentes.length})` },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilterEstadoDoc(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${filterEstadoDoc === key ? "text-white border-transparent" : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"}`}
                style={filterEstadoDoc === key ? { background: NAVY } : {}}>
                {label}
              </button>
            ))}
            <div className="flex gap-1.5 flex-wrap ml-auto">
              {TIPOS_DOC.map(t => (
                <button key={t.value} onClick={() => setFilterTipoDoc(filterTipoDoc === t.value ? "TODOS" : t.value)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${t.bg} ${t.color} ${filterTipoDoc === t.value ? "ring-2 ring-offset-1" : ""}`}>
                  {t.label.split(" ")[0]}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Buscar…" value={searchDoc} onChange={e => setSearchDoc(e.target.value)} className="pl-8 h-8 text-sm w-44" />
              {searchDoc && <button className="absolute right-2 top-2" onClick={() => setSearchDoc("")}><X className="w-4 h-4 text-gray-400" /></button>}
            </div>
            <span className="text-xs text-muted-foreground">{filteredDoc.length} registros</span>
          </div>

          {/* Cards */}
          {loadingDoc && docentes.length === 0 ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground"><RefreshCw className="w-5 h-5 animate-spin" /> Cargando...</div>
          ) : filteredDoc.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-sm">Sin registros</p></div>
          ) : (
            <div className="space-y-3">{filteredDoc.map(r => <DocCard key={r.id} r={r} />)}</div>
          )}
        </div>
      )}

      {/* ── TAB: Incidencias ── */}
      {tab === "incidencias" && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowFormInc(v => !v)} style={{ background: NAVY, color: "#fff" }}>
              <Plus className="w-4 h-4 mr-1.5" />{showFormInc ? "Cancelar" : "Nueva Incidencia"}
            </Button>
          </div>

          {showFormInc && (
            <Card className="rounded-2xl border-2" style={{ borderColor: NAVY + "30" }}>
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-bold" style={{ color: NAVY }}>Registrar Incidencia de Curso o Aula</p>

                {/* Tipo selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Tipo de Incidencia *</label>
                  <div className="relative">
                    <button type="button" onClick={() => setTipoIncOpen(v => !v)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${selectedIncTipo.bg} ${selectedIncTipo.color}`}>
                      <span className="flex items-center gap-2"><selectedIncTipo.Icon className="w-4 h-4" />{selectedIncTipo.label}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${tipoIncOpen ? "rotate-180" : ""}`} />
                    </button>
                    {tipoIncOpen && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                        {TIPOS_INC.map(t => (
                          <button key={t.value} type="button" onClick={() => { setNewIncTipo(t.value); setTipoIncOpen(false); }}
                            className={`w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 border-b last:border-0 ${newIncTipo === t.value ? "bg-blue-50" : ""}`}>
                            <t.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.color}`} />
                            <div className="flex-1">
                              <p className={`text-sm font-semibold ${t.color}`}>{t.label}</p>
                              <p className="text-xs text-gray-400">{t.desc}</p>
                            </div>
                            {newIncTipo === t.value && <Check className="w-4 h-4 text-blue-600 ml-auto mt-0.5 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Curso / Sección / Aula */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3 md:col-span-1 space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Curso / Asignatura *</label>
                    <Input placeholder="Ej: MATEMÁTICA I" value={newIncCurso} onChange={e => setNewIncCurso(e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Sección</label>
                    <Input placeholder="Ej: A, B…" value={newIncSeccion} onChange={e => setNewIncSeccion(e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Aula</label>
                    <Input placeholder="Ej: 101, L-3…" value={newIncAula} onChange={e => setNewIncAula(e.target.value.toUpperCase())} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Prioridad</label>
                  <PrioridadSelector value={newIncPrio} onChange={setNewIncPrio} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Observación</label>
                  <textarea value={newIncObs} onChange={e => setNewIncObs(e.target.value)} rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Detalles de la incidencia..." />
                </div>

                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowFormInc(false)}>Cancelar</Button>
                  <Button size="sm" onClick={saveInc} disabled={savingInc} style={{ background: NAVY, color: "#fff" }}>
                    {savingInc ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Guardando…</> : "Guardar Incidencia"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters incidencias */}
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { key: "ACTIVOS", label: `Activas (${incActivas.length})` },
              { key: "PENDIENTE", label: `Pendientes (${incidencias.filter(i=>i.estado==="PENDIENTE").length})` },
              { key: "EN_PROCESO", label: `En proceso (${incidencias.filter(i=>i.estado==="EN_PROCESO").length})` },
              { key: "RESUELTO", label: `Resueltas (${incidencias.filter(i=>i.estado==="RESUELTO").length})` },
              { key: "TODOS", label: `Todas (${incidencias.length})` },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilterEstadoInc(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${filterEstadoInc === key ? "text-white border-transparent" : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"}`}
                style={filterEstadoInc === key ? { background: NAVY } : {}}>
                {label}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Buscar curso…" value={searchInc} onChange={e => setSearchInc(e.target.value)} className="pl-8 h-8 text-sm w-44" />
              {searchInc && <button className="absolute right-2 top-2" onClick={() => setSearchInc("")}><X className="w-4 h-4 text-gray-400" /></button>}
            </div>
            <span className="text-xs text-muted-foreground">{filteredInc.length} registros</span>
          </div>

          {loadingInc && incidencias.length === 0 ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground"><RefreshCw className="w-5 h-5 animate-spin" /> Cargando...</div>
          ) : filteredInc.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground"><BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-sm">Sin incidencias registradas</p></div>
          ) : (
            <div className="space-y-3">{filteredInc.map(r => <IncCard key={r.id} r={r} />)}</div>
          )}
        </div>
      )}

      {/* ── TAB: Alertas ── */}
      {tab === "alertas" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">Alertas generadas automáticamente según los datos actuales del módulo.</p>
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
              a.tipo === "critica" ? "bg-red-50 border-red-200" :
              a.tipo === "aviso"  ? "bg-amber-50 border-amber-200" :
                                    "bg-blue-50 border-blue-200"
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                a.tipo === "critica" ? "bg-red-100" :
                a.tipo === "aviso"  ? "bg-amber-100" :
                                      "bg-blue-100"
              }`}>
                {a.tipo === "critica" ? <Zap className="w-5 h-5 text-red-600" /> :
                 a.tipo === "aviso"   ? <Bell className="w-5 h-5 text-amber-600" /> :
                                        <Info className="w-5 h-5 text-blue-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${
                  a.tipo === "critica" ? "text-red-700" :
                  a.tipo === "aviso"  ? "text-amber-700" :
                                        "text-blue-700"
                }`}>{a.titulo}</p>
                <p className={`text-xs mt-0.5 ${
                  a.tipo === "critica" ? "text-red-600/80" :
                  a.tipo === "aviso"  ? "text-amber-600/80" :
                                        "text-blue-600/80"
                }`}>{a.detalle}</p>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${
                a.tipo === "critica" ? "bg-red-600 text-white" :
                a.tipo === "aviso"  ? "bg-amber-500 text-white" :
                                      "bg-blue-500 text-white"
              }`}>
                {a.tipo === "critica" ? "CRÍTICO" : a.tipo === "aviso" ? "AVISO" : "INFO"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
