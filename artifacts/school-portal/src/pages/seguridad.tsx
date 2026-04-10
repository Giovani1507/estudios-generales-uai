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
  ArrowDownCircle, MinusCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";
const GOLD = "#C9A84C";

export type TipoFlag =
  | "RENUNCIO_CARGA"
  | "NO_REGRESA"
  | "CAMBIO_PLANIFICACION"
  | "BAJA_TEMPORAL"
  | "OTRO";

export type EstadoFlag = "PENDIENTE" | "EN_PROCESO" | "RESUELTO";
export type PrioridadFlag = "ALTA" | "NORMAL" | "BAJA";

export type SeguridadDocente = {
  id: number;
  nombre: string;
  tipo: TipoFlag;
  estado: EstadoFlag;
  prioridad: PrioridadFlag;
  observacion: string | null;
  resolucion: string | null;
  registradoEn: string;
  registradoPor: string | null;
  resueltaEn: string | null;
  resueltaPor: string | null;
};

const TIPOS: {
  value: TipoFlag; label: string; desc: string;
  color: string; bg: string; Icon: React.FC<{ className?: string }>;
}[] = [
  { value: "RENUNCIO_CARGA",      label: "Renunció a su carga lectiva",   desc: "El docente renunció formalmente a las horas asignadas.",         color: "text-red-700",    bg: "bg-red-50 border-red-200",    Icon: UserX },
  { value: "NO_REGRESA",          label: "No regresa este semestre",       desc: "El docente no dictará clases en el semestre 2026-I.",            color: "text-orange-700", bg: "bg-orange-50 border-orange-200", Icon: UserMinus },
  { value: "CAMBIO_PLANIFICACION",label: "Cambio en la planificación",     desc: "Hubo un cambio en su carga, horario o carrera asignada.",        color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",  Icon: AlertTriangle },
  { value: "BAJA_TEMPORAL",       label: "Baja temporal",                  desc: "Permiso, licencia médica u otra ausencia temporal.",             color: "text-purple-700", bg: "bg-purple-50 border-purple-200", Icon: FileWarning },
  { value: "OTRO",                label: "Otro",                           desc: "Otra situación no contemplada en las opciones anteriores.",       color: "text-gray-700",   bg: "bg-gray-50 border-gray-200",    Icon: Info },
];

const ESTADOS: { value: EstadoFlag; label: string; color: string; bg: string; ring: string; Icon: React.FC<{ className?: string }> }[] = [
  { value: "PENDIENTE",  label: "Pendiente",   color: "text-red-600",    bg: "bg-red-50 border-red-200",      ring: "ring-red-300",    Icon: Circle },
  { value: "EN_PROCESO", label: "En proceso",  color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",  ring: "ring-amber-300",  Icon: Loader2 },
  { value: "RESUELTO",   label: "Resuelto",    color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-200",ring: "ring-emerald-300",Icon: CheckCircle2 },
];

const PRIORIDADES: { value: PrioridadFlag; label: string; color: string; Icon: React.FC<{ className?: string }> }[] = [
  { value: "ALTA",   label: "Alta",   color: "text-red-600",    Icon: ArrowUpCircle },
  { value: "NORMAL", label: "Normal", color: "text-blue-600",   Icon: MinusCircle },
  { value: "BAJA",   label: "Baja",   color: "text-gray-400",   Icon: ArrowDownCircle },
];

function tipoInfo(tipo: TipoFlag)         { return TIPOS.find(t => t.value === tipo) ?? TIPOS[TIPOS.length - 1]; }
function estadoInfo(estado: EstadoFlag)   { return ESTADOS.find(e => e.value === estado) ?? ESTADOS[0]; }
function prioridadInfo(p: PrioridadFlag)  { return PRIORIDADES.find(x => x.value === p) ?? PRIORIDADES[1]; }

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "Etc/GMT+5",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Excel export ─────────────────────────────────────────────────────────────
async function exportarExcelSeguridad(data: SeguridadDocente[], baseUrl: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Seguridad Docentes");

  const NAVY_A = "FF001F5F";
  const GOLD_A = "FFC9A84C";
  const WHITE  = "FFFFFFFF";

  // Widths
  ws.columns = [
    { width: 5 },   // N°
    { width: 38 },  // Docente
    { width: 22 },  // Tipo
    { width: 14 },  // Estado
    { width: 10 },  // Prioridad
    { width: 30 },  // Observación
    { width: 30 },  // Resolución
    { width: 18 },  // Registrado en
    { width: 16 },  // Registrado por
    { width: 18 },  // Resuelto en
  ];

  // Try logo
  try {
    const logoUrl = `${baseUrl}logo-sidebar.png`;
    const resp = await fetch(logoUrl);
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      const imgId = wb.addImage({ buffer: buf, extension: "png" });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, br: { col: 2, row: 3 }, editAs: "oneCell" });
    }
  } catch { /* skip */ }

  // Title rows
  ws.mergeCells("C1:J1");
  const t1 = ws.getCell("C1");
  t1.value = "UNIVERSIDAD AUTÓNOMA DE ICA";
  t1.font = { bold: true, size: 13, color: { argb: NAVY_A }, name: "Calibri" };
  t1.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("C2:J2");
  const t2 = ws.getCell("C2");
  t2.value = "Módulo de Seguridad — Registro de Situaciones Docentes";
  t2.font = { bold: true, size: 11, color: { argb: GOLD_A }, name: "Calibri" };
  t2.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("C3:J3");
  const t3 = ws.getCell("C3");
  t3.value = `Generado: ${new Date().toLocaleString("es-PE", { timeZone: "Etc/GMT+5" })} — Total: ${data.length} registros`;
  t3.font = { size: 9, color: { argb: "FF666666" }, name: "Calibri" };
  t3.alignment = { horizontal: "center", vertical: "middle" };

  ws.getRow(1).height = 22;
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 16;

  // Divider
  ws.getRow(4).height = 6;
  ws.mergeCells("A4:J4");
  ws.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_A } };

  // Header
  const headers = ["N°", "Docente", "Tipo de Situación", "Estado", "Prioridad", "Observación", "Resolución", "Registrado en", "Registrado por", "Resuelto en"];
  ws.getRow(5).height = 22;
  headers.forEach((h, i) => {
    const cell = ws.getRow(5).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9.5, color: { argb: WHITE }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_A } };
    cell.alignment = { horizontal: i <= 1 ? "left" : "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF3355AA" } },
      bottom: { style: "thin", color: { argb: "FF3355AA" } },
      left: { style: "thin", color: { argb: "FF3355AA" } },
      right: { style: "thin", color: { argb: "FF3355AA" } },
    };
  });

  // Estado colors
  const ESTADO_COLORS: Record<string, string> = {
    PENDIENTE:  "FFFEE2E2",
    EN_PROCESO: "FFFEF3C7",
    RESUELTO:   "FFD1FAE5",
  };

  data.forEach((r, idx) => {
    const rowNum = 6 + idx;
    ws.getRow(rowNum).height = 16;
    const bg = ESTADO_COLORS[r.estado] ?? "FFFFFFFF";
    const alt = idx % 2 === 0 ? bg : "FFFAFAFA";

    const tipo = tipoInfo(r.tipo);
    const vals = [
      idx + 1,
      r.nombre,
      tipo.label,
      r.estado,
      r.prioridad,
      r.observacion ?? "",
      r.resolucion ?? "",
      formatDate(r.registradoEn),
      r.registradoPor ?? "",
      formatDate(r.resueltaEn),
    ];

    vals.forEach((v, i) => {
      const cell = ws.getRow(rowNum).getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { size: 9, name: "Calibri", color: { argb: "FF1E293B" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: alt.replace("#", "FF") } };
      cell.alignment = { horizontal: i <= 1 ? "left" : "center", vertical: "middle", wrapText: i === 5 || i === 6 };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        left:   { style: "hair", color: { argb: "FFE2E8F0" } },
        right:  { style: "hair", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  // Footer
  const footRow = 6 + data.length;
  ws.getRow(footRow).height = 16;
  ws.mergeCells(`A${footRow}:J${footRow}`);
  const foot = ws.getCell(`A${footRow}`);
  foot.value = `Universidad Autónoma de Ica · Portal Académico 2026-I · ${new Date().getFullYear()}`;
  foot.font = { size: 8, italic: true, color: { argb: "FF888888" }, name: "Calibri" };
  foot.alignment = { horizontal: "center" };
  foot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `seguridad-docentes-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type PlanRow = { docente: string; [k: string]: unknown };

// ─── Component ────────────────────────────────────────────────────────────────
export default function Seguridad() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<SeguridadDocente[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("TODOS");
  const [filterEstado, setFilterEstado] = useState<string>("ACTIVOS");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  // Edit panel state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editObs, setEditObs] = useState("");
  const [editTipo, setEditTipo] = useState<TipoFlag>("RENUNCIO_CARGA");
  const [editPrioridad, setEditPrioridad] = useState<PrioridadFlag>("NORMAL");

  // Resolve dialog
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [allDocentes, setAllDocentes] = useState<string[]>([]);
  const [newNombre, setNewNombre] = useState("");
  const [docenteQuery, setDocenteQuery] = useState("");
  const [docenteOpen, setDocenteOpen] = useState(false);
  const docenteRef = useRef<HTMLDivElement>(null);
  const [newTipo, setNewTipo] = useState<TipoFlag>("RENUNCIO_CARGA");
  const [newEstado] = useState<EstadoFlag>("PENDIENTE");
  const [newPrioridad, setNewPrioridad] = useState<PrioridadFlag>("NORMAL");
  const [newObs, setNewObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [tipoOpen, setTipoOpen] = useState(false);

  const registeredNames = useMemo(() => new Set(data.map(d => d.nombre.trim().toUpperCase())), [data]);

  const docenteSuggestions = useMemo(() => {
    const q = docenteQuery.trim().toUpperCase();
    if (!q) return allDocentes.slice(0, 50);
    return allDocentes.filter(n => n.includes(q)).slice(0, 50);
  }, [allDocentes, docenteQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (docenteRef.current && !docenteRef.current.contains(e.target as Node)) {
        setDocenteOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes`, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      setData(await r.json());
    } catch (err) {
      toast({ title: "Error al cargar", description: String(err), variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}planificacion-fica-2026-1.json`).then(r => r.ok ? r.json() : []),
      fetch(`${base}planificacion-fcs-2026-1.json`).then(r => r.ok ? r.json() : []),
    ]).then(([fica, fcs]: [PlanRow[], PlanRow[]]) => {
      const names = new Set<string>();
      [...fica, ...fcs].forEach(row => {
        if (row.docente && typeof row.docente === "string") names.add(row.docente.trim().toUpperCase());
      });
      setAllDocentes([...names].sort());
    }).catch(() => {});
  }, []);

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!newNombre.trim()) { toast({ title: "Selecciona un docente", variant: "destructive" }); return; }
    if (!allDocentes.includes(newNombre.trim().toUpperCase())) {
      toast({ title: "Docente no encontrado en el sistema", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nombre: newNombre.trim(),
          tipo: newTipo,
          estado: newEstado,
          prioridad: newPrioridad,
          observacion: newObs.trim() || null,
          registradoPor: user?.username || null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `${r.status}`);
      const nuevo = await r.json();
      setData(prev => [nuevo, ...prev]);
      setNewNombre(""); setDocenteQuery(""); setNewTipo("RENUNCIO_CARGA");
      setNewPrioridad("NORMAL"); setNewObs(""); setShowForm(false);
      toast({ title: "Registro guardado correctamente" });
    } catch (err) {
      toast({ title: "Error al guardar", description: String(err), variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este registro de seguridad?")) return;
    setDeleting(id);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      setData(prev => prev.filter(x => x.id !== id));
      toast({ title: "Registro eliminado" });
    } catch (err) {
      toast({ title: "Error al eliminar", description: String(err), variant: "destructive" });
    } finally { setDeleting(null); }
  }

  async function handleEditSave(id: number) {
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ observacion: editObs, tipo: editTipo, prioridad: editPrioridad }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const updated = await r.json();
      setData(prev => prev.map(x => x.id === id ? updated : x));
      setEditingId(null);
      toast({ title: "Registro actualizado" });
    } catch (err) {
      toast({ title: "Error al actualizar", description: String(err), variant: "destructive" });
    }
  }

  async function handleResolve(id: number) {
    setResolving(true);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estado: "RESUELTO", resolucion: resolveNote.trim() || null, resueltaPor: user?.username || null }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const updated = await r.json();
      setData(prev => prev.map(x => x.id === id ? updated : x));
      setResolvingId(null); setResolveNote("");
      toast({ title: "Marcado como resuelto", description: "El docente ya no aparecerá marcado en la lista." });
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally { setResolving(false); }
  }

  async function handleCambiarEstado(id: number, estado: EstadoFlag) {
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estado, resueltaPor: estado === "RESUELTO" ? user?.username : null }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const updated = await r.json();
      setData(prev => prev.map(x => x.id === id ? updated : x));
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const counts = {
    tipo:   TIPOS.reduce((a, t) => { a[t.value] = data.filter(r => r.tipo === t.value).length; return a; }, {} as Record<string, number>),
    estado: ESTADOS.reduce((a, e) => { a[e.value] = data.filter(r => r.estado === e.value).length; return a; }, {} as Record<string, number>),
    pendientes: data.filter(r => r.estado === "PENDIENTE").length,
    activos: data.filter(r => r.estado !== "RESUELTO").length,
  };

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (filterEstado === "ACTIVOS" && r.estado === "RESUELTO") return false;
      if (filterEstado !== "ACTIVOS" && filterEstado !== "TODOS" && r.estado !== filterEstado) return false;
      if (filterTipo !== "TODOS" && r.tipo !== filterTipo) return false;
      const q = search.trim().toUpperCase();
      return !q || r.nombre.toUpperCase().includes(q) || (r.observacion || "").toUpperCase().includes(q);
    });
  }, [data, filterEstado, filterTipo, search]);

  const selectedTipo = TIPOS.find(t => t.value === newTipo)!;

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 p-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}>
            <ShieldAlert className="w-6 h-6" /> Seguridad — Situaciones Docentes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona renuncias, bajas y cambios en la planificación docente 2026-I
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={async () => {
              setExporting(true);
              try { await exportarExcelSeguridad(data, import.meta.env.BASE_URL); }
              catch { toast({ title: "Error al exportar", variant: "destructive" }); }
              finally { setExporting(false); }
            }}
            disabled={exporting || data.length === 0}
          >
            <Download className={`w-4 h-4 mr-1.5 ${exporting ? "animate-spin" : ""}`} />
            {exporting ? "Exportando…" : "Excel"}
          </Button>
          <Button
            size="sm"
            onClick={() => { setShowForm(v => !v); if (showForm) { setNewNombre(""); setDocenteQuery(""); } }}
            style={{ background: NAVY, color: "#fff" }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> {showForm ? "Cancelar" : "Nuevo Registro"}
          </Button>
        </div>
      </div>

      {/* Dashboard stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Estado cards */}
        {ESTADOS.map(({ value, label, color, bg, Icon }) => (
          <button
            key={value}
            onClick={() => setFilterEstado(filterEstado === value ? "TODOS" : value)}
            className={`rounded-xl border-2 p-3 text-left transition-all ${bg} ${filterEstado === value ? "ring-2 ring-offset-1 ring-current" : ""}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className={`text-2xl font-black ${color}`}>{counts.estado[value] ?? 0}</span>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${color} opacity-80`}>{label}</p>
          </button>
        ))}
        {/* Total */}
        <div className="rounded-xl border-2 p-3 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            <span className="text-2xl font-black text-slate-600">{data.length}</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total registros</p>
        </div>
      </div>

      {/* Tipo breakdown */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterTipo("TODOS")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterTipo === "TODOS" ? "text-white border-transparent" : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"}`}
          style={filterTipo === "TODOS" ? { background: NAVY } : {}}
        >
          Todos los tipos ({counts.activos} activos)
        </button>
        {TIPOS.map(({ value, label, Icon, color, bg }) => (
          <button
            key={value}
            onClick={() => setFilterTipo(filterTipo === value ? "TODOS" : value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${bg} ${color} ${filterTipo === value ? "ring-2 ring-offset-1" : ""}`}
          >
            <Icon className="w-3 h-3" />
            {label.split(" ").slice(0, 2).join(" ")} ({counts.tipo[value] ?? 0})
          </button>
        ))}
      </div>

      {/* Estado filter pills */}
      <div className="flex items-center gap-2 flex-wrap -mt-2">
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Mostrar:</span>
        {[
          { key: "ACTIVOS", label: `Activos (${counts.activos})` },
          { key: "PENDIENTE", label: `Pendientes (${counts.estado["PENDIENTE"] ?? 0})` },
          { key: "EN_PROCESO", label: `En proceso (${counts.estado["EN_PROCESO"] ?? 0})` },
          { key: "RESUELTO", label: `Resueltos (${counts.estado["RESUELTO"] ?? 0})` },
          { key: "TODOS", label: `Todos (${data.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterEstado(key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              filterEstado === key
                ? "text-white border-transparent"
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
            }`}
            style={filterEstado === key ? { background: NAVY } : {}}
          >
            {label}
          </button>
        ))}
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar docente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {search && <button className="absolute right-2 top-2" onClick={() => setSearch("")}><X className="w-4 h-4 text-gray-400" /></button>}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
      </div>

      {/* New record form */}
      {showForm && (
        <Card className="rounded-2xl border-2" style={{ borderColor: NAVY + "30" }}>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-bold" style={{ color: NAVY }}>Nuevo Registro de Seguridad</p>

            {/* Docente combobox */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Docente *</label>
              <div ref={docenteRef} className="relative">
                <div
                  className={`flex items-center gap-2 w-full border-2 rounded-xl px-3 py-2.5 cursor-text transition-all ${
                    docenteOpen ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300"
                  } bg-white`}
                  onClick={() => setDocenteOpen(true)}
                >
                  <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    className="flex-1 text-sm font-medium bg-transparent outline-none placeholder:text-gray-400"
                    placeholder={allDocentes.length === 0 ? "Cargando docentes…" : "Buscar docente del sistema…"}
                    value={newNombre ? newNombre : docenteQuery}
                    onChange={e => { setNewNombre(""); setDocenteQuery(e.target.value.toUpperCase()); setDocenteOpen(true); }}
                    onFocus={() => setDocenteOpen(true)}
                  />
                  {newNombre
                    ? <button type="button" onClick={() => { setNewNombre(""); setDocenteQuery(""); }} className="shrink-0"><X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" /></button>
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  }
                </div>
                {docenteOpen && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      {docenteSuggestions.length === 0
                        ? <p className="px-4 py-3 text-sm text-gray-400 italic">Sin coincidencias</p>
                        : docenteSuggestions.map(nombre => {
                          const yaReg = registeredNames.has(nombre);
                          const isSel = newNombre === nombre;
                          return (
                            <button
                              key={nombre} type="button" disabled={yaReg}
                              onClick={() => { setNewNombre(nombre); setDocenteQuery(""); setDocenteOpen(false); }}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm border-b last:border-0 transition-colors
                                ${isSel ? "bg-blue-50 text-blue-800 font-semibold" : ""}
                                ${yaReg ? "opacity-40 cursor-not-allowed bg-gray-50" : "hover:bg-primary/5 text-foreground"}`}
                            >
                              <span className="flex-1 font-medium">{nombre}</span>
                              {isSel && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                              {yaReg && <span className="text-[10px] font-bold text-orange-500 shrink-0">YA REGISTRADO</span>}
                            </button>
                          );
                        })
                      }
                    </div>
                    <div className="px-3 py-1.5 border-t bg-gray-50 text-[10px] text-gray-400">{allDocentes.length} docentes del sistema</div>
                  </div>
                )}
              </div>
              {newNombre && <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1"><Check className="w-3 h-3" /> Docente seleccionado</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Tipo de Situación *</label>
                <div className="relative">
                  <button
                    type="button" onClick={() => setTipoOpen(v => !v)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${selectedTipo.bg} ${selectedTipo.color}`}
                  >
                    <span className="flex items-center gap-2"><selectedTipo.Icon className="w-4 h-4" />{selectedTipo.label}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${tipoOpen ? "rotate-180" : ""}`} />
                  </button>
                  {tipoOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                      {TIPOS.map(t => (
                        <button
                          key={t.value} type="button"
                          onClick={() => { setNewTipo(t.value); setTipoOpen(false); }}
                          className={`w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors border-b last:border-0 ${newTipo === t.value ? "bg-blue-50" : ""}`}
                        >
                          <t.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.color}`} />
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${t.color}`}>{t.label}</p>
                            <p className="text-xs text-gray-400">{t.desc}</p>
                          </div>
                          {newTipo === t.value && <Check className="w-4 h-4 text-blue-600 ml-auto shrink-0 mt-0.5" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Prioridad */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Prioridad</label>
                <div className="flex gap-2">
                  {PRIORIDADES.map(p => (
                    <button
                      key={p.value} type="button"
                      onClick={() => setNewPrioridad(p.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                        newPrioridad === p.value
                          ? `${p.color} border-current bg-current/5`
                          : "border-gray-200 text-gray-400 hover:border-gray-300"
                      }`}
                    >
                      <p.Icon className="w-3.5 h-3.5" /> {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Observación */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Observación / Detalle</label>
              <textarea
                placeholder="Detalles adicionales sobre la situación del docente..."
                value={newObs} onChange={e => setNewObs(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} style={{ background: NAVY, color: "#fff" }}>
                {saving ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Guardando…</> : "Guardar Registro"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards list */}
      {loading && data.length === 0 ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" /> Cargando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Sin registros para los filtros seleccionados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const tipo  = tipoInfo(r.tipo);
            const est   = estadoInfo(r.estado);
            const prio  = prioridadInfo(r.prioridad);
            const isEditing   = editingId === r.id;
            const isResolving = resolvingId === r.id;
            const resuelto = r.estado === "RESUELTO";

            return (
              <Card key={r.id} className={`rounded-xl border-2 shadow-sm overflow-hidden transition-all ${resuelto ? "opacity-70 border-emerald-200 bg-emerald-50/40" : tipo.bg}`}>
                <CardContent className="p-0">
                  <div className="flex items-start gap-3 p-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${resuelto ? "bg-emerald-100" : tipo.bg}`}>
                      {resuelto
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        : <tipo.Icon className={`w-5 h-5 ${tipo.color}`} />
                      }
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm ${resuelto ? "text-emerald-700 line-through decoration-emerald-400" : tipo.color}`}>
                            {r.nombre}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tipo.bg} ${tipo.color}`}>
                              <tipo.Icon className="w-2.5 h-2.5" /> {tipo.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${est.bg} ${est.color}`}>
                              <est.Icon className="w-2.5 h-2.5" /> {est.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${prio.color}`}>
                              <prio.Icon className="w-3 h-3" /> {prio.label}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Estado change buttons */}
                          {!resuelto && (
                            <>
                              {r.estado === "PENDIENTE" && (
                                <button
                                  onClick={() => handleCambiarEstado(r.id, "EN_PROCESO")}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200 transition-colors"
                                  title="Marcar en proceso"
                                >
                                  <Clock className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => { setResolvingId(r.id); setResolveNote(""); }}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200 transition-colors"
                                title="Marcar como resuelto"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          {resuelto && (
                            <button
                              onClick={() => handleCambiarEstado(r.id, "PENDIENTE")}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200 transition-colors"
                              title="Reabrir"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => { setEditingId(isEditing ? null : r.id); setEditObs(r.observacion || ""); setEditTipo(r.tipo); setEditPrioridad(r.prioridad); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/60 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            disabled={deleting === r.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/60 hover:text-red-600 transition-colors disabled:opacity-40"
                            title="Eliminar"
                          >
                            {deleting === r.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Observación */}
                      {!isEditing && !isResolving && r.observacion && (
                        <p className={`mt-1.5 text-xs italic ${tipo.color} opacity-80`}>"{r.observacion}"</p>
                      )}

                      {/* Resolución */}
                      {resuelto && r.resolucion && (
                        <p className="mt-1.5 text-xs italic text-emerald-600 opacity-80">✓ {r.resolucion}</p>
                      )}

                      {/* Resolve dialog */}
                      {isResolving && (
                        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                          <p className="text-xs font-bold text-emerald-700">¿Cómo se resolvió? (opcional)</p>
                          <textarea
                            value={resolveNote}
                            onChange={e => setResolveNote(e.target.value)}
                            rows={2}
                            className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-xs bg-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            placeholder="Ej: Se asignó nuevo docente, se reasignó la carga..."
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleResolve(r.id)} disabled={resolving}>
                              {resolving ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Guardando</> : <><CheckCircle2 className="w-3 h-3 mr-1" />Marcar Resuelto</>}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => setResolvingId(null)}>Cancelar</Button>
                          </div>
                        </div>
                      )}

                      {/* Edit panel */}
                      {isEditing && (
                        <div className="mt-3 space-y-3 p-3 bg-white/60 rounded-xl border border-gray-200">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Tipo</p>
                              <select
                                value={editTipo}
                                onChange={e => setEditTipo(e.target.value as TipoFlag)}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                              >
                                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Prioridad</p>
                              <select
                                value={editPrioridad}
                                onChange={e => setEditPrioridad(e.target.value as PrioridadFlag)}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                              >
                                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                              </select>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Observación</p>
                            <textarea
                              value={editObs} onChange={e => setEditObs(e.target.value)}
                              rows={2}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                              placeholder="Observación..."
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs" style={{ background: NAVY, color: "#fff" }}
                              onClick={() => handleEditSave(r.id)}>
                              <Check className="w-3 h-3 mr-1" />Guardar cambios
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => setEditingId(null)}>Cancelar</Button>
                          </div>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 flex-wrap">
                        <span>Registrado: {formatDate(r.registradoEn)}</span>
                        {r.registradoPor && <span>· Por: <span className="font-semibold">{r.registradoPor}</span></span>}
                        {resuelto && r.resueltaEn && (
                          <span className="text-emerald-500">· Resuelto: {formatDate(r.resueltaEn)} {r.resueltaPor && `por ${r.resueltaPor}`}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <Card className="rounded-xl border-dashed border-2 mt-2" style={{ borderColor: GOLD + "60" }}>
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 shrink-0 mt-0.5" style={{ color: NAVY }} />
          <div className="text-sm">
            <p className="font-semibold" style={{ color: NAVY }}>¿Cómo funciona este módulo?</p>
            <ul className="text-xs text-gray-500 mt-1 space-y-0.5">
              <li>▸ Los registros <strong>activos</strong> (Pendiente / En proceso) marcan al docente en la Lista de Docentes con su badge de color.</li>
              <li>▸ Al marcar un registro como <strong>Resuelto</strong>, el docente deja de aparecer marcado automáticamente.</li>
              <li>▸ Usa el botón <em>Excel</em> para exportar el registro completo con todos los estados y detalles.</li>
              <li>▸ Solo puedes registrar docentes que existen en la planificación FICA o FCS 2026-I.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
