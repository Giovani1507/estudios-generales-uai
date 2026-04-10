import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert, Plus, Trash2, RefreshCw, Search, X,
  UserX, UserMinus, AlertTriangle, FileWarning, Info,
  ChevronDown, Check, Pencil,
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

export type SeguridadDocente = {
  id: number;
  nombre: string;
  tipo: TipoFlag;
  observacion: string | null;
  registradoEn: string;
  registradoPor: string | null;
};

const TIPOS: { value: TipoFlag; label: string; desc: string; color: string; bg: string; Icon: React.FC<{className?: string}> }[] = [
  {
    value: "RENUNCIO_CARGA",
    label: "Renunció a su carga lectiva",
    desc: "El docente renunció formalmente a las horas asignadas.",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    Icon: UserX,
  },
  {
    value: "NO_REGRESA",
    label: "No regresa este semestre",
    desc: "El docente no dictará clases en el semestre 2026-I.",
    color: "text-orange-700",
    bg: "bg-orange-50 border-orange-200",
    Icon: UserMinus,
  },
  {
    value: "CAMBIO_PLANIFICACION",
    label: "Cambio en la planificación",
    desc: "Hubo un cambio en su carga, horario o carrera asignada.",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    Icon: AlertTriangle,
  },
  {
    value: "BAJA_TEMPORAL",
    label: "Baja temporal",
    desc: "Permiso, licencia médica u otra ausencia temporal.",
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
    Icon: FileWarning,
  },
  {
    value: "OTRO",
    label: "Otro",
    desc: "Otra situación no contemplada en las opciones anteriores.",
    color: "text-gray-700",
    bg: "bg-gray-50 border-gray-200",
    Icon: Info,
  },
];

function tipoInfo(tipo: TipoFlag) {
  return TIPOS.find(t => t.value === tipo) ?? TIPOS[TIPOS.length - 1];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "Etc/GMT+5",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function Seguridad() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<SeguridadDocente[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("TODOS");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editObs, setEditObs] = useState("");

  // New record form
  const [showForm, setShowForm] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newTipo, setNewTipo] = useState<TipoFlag>("RENUNCIO_CARGA");
  const [newObs, setNewObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [tipoOpen, setTipoOpen] = useState(false);

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

  async function handleSave() {
    if (!newNombre.trim()) { toast({ title: "Ingresa el nombre del docente", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nombre: newNombre.trim(),
          tipo: newTipo,
          observacion: newObs.trim() || null,
          registradoPor: user?.username || null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `${r.status}`);
      const nuevo = await r.json();
      setData(prev => [...prev, nuevo]);
      setNewNombre(""); setNewTipo("RENUNCIO_CARGA"); setNewObs(""); setShowForm(false);
      toast({ title: "Registro guardado" });
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
        body: JSON.stringify({ observacion: editObs }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const updated = await r.json();
      setData(prev => prev.map(x => x.id === id ? updated : x));
      setEditingId(null);
      toast({ title: "Observación actualizada" });
    } catch (err) {
      toast({ title: "Error al actualizar", description: String(err), variant: "destructive" });
    }
  }

  const filtered = data.filter(r => {
    if (filterTipo !== "TODOS" && r.tipo !== filterTipo) return false;
    const q = search.trim().toUpperCase();
    return !q || r.nombre.toUpperCase().includes(q) || (r.observacion || "").toUpperCase().includes(q);
  });

  const counts = TIPOS.reduce((acc, t) => {
    acc[t.value] = data.filter(r => r.tipo === t.value).length;
    return acc;
  }, {} as Record<string, number>);

  const selectedTipo = TIPOS.find(t => t.value === newTipo)!;

  return (
    <div className="flex flex-col gap-5 p-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}>
            <ShieldAlert className="w-6 h-6" /> Seguridad — Cambios de Docentes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona situaciones especiales: renuncias, bajas y cambios en la planificación docente
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setShowForm(v => !v)}
            style={{ background: NAVY, color: "#fff" }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> {showForm ? "Cancelar" : "Nuevo Registro"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {TIPOS.map(({ value, label, color, bg, Icon }) => (
          <button
            key={value}
            onClick={() => setFilterTipo(filterTipo === value ? "TODOS" : value)}
            className={`rounded-xl border-2 p-3 text-left transition-all ${
              filterTipo === value ? "ring-2 ring-offset-1" : ""
            } ${bg}`}
            style={filterTipo === value ? { borderColor: NAVY, ringColor: NAVY } : {}}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className={`text-xl font-black ${color}`}>{counts[value] ?? 0}</span>
            </div>
            <p className={`text-[10px] font-semibold leading-tight ${color} opacity-80`}>{label}</p>
          </button>
        ))}
      </div>

      {/* New record form */}
      {showForm && (
        <Card className="rounded-2xl border-2" style={{ borderColor: NAVY + "30" }}>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-bold" style={{ color: NAVY }}>Nuevo Registro de Seguridad</p>

            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Apellidos y Nombres del Docente *</label>
              <Input
                placeholder="Ej: RECUAY SALAZAR CARLOS ALBERTO"
                value={newNombre}
                onChange={e => setNewNombre(e.target.value.toUpperCase())}
                className="font-medium"
              />
              <p className="text-[10px] text-gray-400">Escríbelo exactamente como aparece en el sistema (en mayúsculas)</p>
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Tipo de Situación *</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTipoOpen(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${selectedTipo.bg} ${selectedTipo.color}`}
                >
                  <span className="flex items-center gap-2">
                    <selectedTipo.Icon className="w-4 h-4" />
                    {selectedTipo.label}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${tipoOpen ? "rotate-180" : ""}`} />
                </button>
                {tipoOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    {TIPOS.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => { setNewTipo(t.value); setTipoOpen(false); }}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b last:border-0 ${
                          newTipo === t.value ? "bg-blue-50" : ""
                        }`}
                      >
                        <t.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.color}`} />
                        <div>
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

            {/* Observación */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Observación / Detalle</label>
              <textarea
                placeholder="Detalles adicionales sobre la situación del docente..."
                value={newObs}
                onChange={e => setNewObs(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                style={{ background: NAVY, color: "#fff" }}
              >
                {saving ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Guardando…</> : "Guardar Registro"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterTipo("TODOS")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filterTipo === "TODOS" ? "text-white border-transparent" : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
            }`}
            style={filterTipo === "TODOS" ? { background: NAVY } : {}}
          >
            Todos ({data.length})
          </button>
        </div>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
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

      {/* Cards list */}
      {loading && data.length === 0 ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" /> Cargando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Sin registros de seguridad</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const info = tipoInfo(r.tipo);
            const isEditing = editingId === r.id;
            return (
              <Card key={r.id} className={`rounded-xl border-2 shadow-sm overflow-hidden ${info.bg}`}>
                <CardContent className="p-0">
                  <div className="flex items-start gap-3 p-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${info.bg}`}>
                      <info.Icon className={`w-5 h-5 ${info.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className={`font-bold text-sm ${info.color}`}>{r.nombre}</p>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${info.bg} ${info.color}`}>
                            {info.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => { setEditingId(isEditing ? null : r.id); setEditObs(r.observacion || ""); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/60 hover:text-blue-600 transition-colors"
                            title="Editar observación"
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

                      {/* Observacion / edit */}
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={editObs}
                            onChange={e => setEditObs(e.target.value)}
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Observación..."
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs" style={{ background: NAVY, color: "#fff" }}
                              onClick={() => handleEditSave(r.id)}>
                              <Check className="w-3 h-3 mr-1" />Guardar
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => setEditingId(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : r.observacion && (
                        <p className={`mt-1.5 text-xs italic ${info.color} opacity-80`}>"{r.observacion}"</p>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                        <span>{formatDate(r.registradoEn)}</span>
                        {r.registradoPor && <span>· Por: <span className="font-semibold">{r.registradoPor}</span></span>}
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
              <li>▸ Los docentes registrados aquí aparecen automáticamente marcados en la <strong>Lista de Docentes</strong>.</li>
              <li>▸ Los de tipo <em>"Renunció a su carga lectiva"</em> se muestran en <span className="text-red-600 font-semibold">rojo</span> con el badge RENUNCIÓ.</li>
              <li>▸ Todos los tipos afectan también el <strong>Excel descargado</strong> de la lista.</li>
              <li>▸ El nombre debe escribirse en <strong>MAYÚSCULAS</strong> tal como aparece en el sistema.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
