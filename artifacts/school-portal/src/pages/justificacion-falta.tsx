import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck, Loader2, Plus, Search, Trash2, CheckCircle2, RefreshCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

type Justificacion = {
  id: number;
  apellidoNombre: string;
  curso: string;
  ciclo: string;
  docente: string;
  dia: string;
  descripcion: string | null;
  justificado: boolean;
  justificadoAt: string | null;
  justificadoPor: string | null;
  createdByUsername: string | null;
  createdAt: string;
};

const DIAS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];

export default function JustificacionFalta() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<Justificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    apellidoNombre: "",
    curso: "",
    ciclo: "",
    docente: "",
    dia: "",
    descripcion: "",
  });

  const fetchAll = async () => {
    try {
      const r = await fetch(`${apiBase}/api/justificaciones`, { credentials: "include" });
      if (!r.ok) throw new Error("error");
      const data = await r.json();
      setItems(data);
    } catch {
      toast({ title: "Error", description: "No se pudo cargar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // Log entrada al apartado
    fetch(`${apiBase}/api/activity/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ type: "ingreso_apartado", detail: "Justificación de Falta" }),
    }).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.apellidoNombre.trim() || !form.curso.trim() || !form.ciclo.trim() || !form.docente.trim() || !form.dia) {
      toast({ title: "Datos incompletos", description: "Completa todos los campos obligatorios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${apiBase}/api/justificaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("err");
      const created = await r.json();
      setItems(prev => [created, ...prev]);
      setForm({ apellidoNombre: "", curso: "", ciclo: "", docente: "", dia: "", descripcion: "" });
      toast({
        title: "Registrado",
        description: `${created.apellidoNombre} fue derivado a Soporte de Justificación.`,
      });
    } catch {
      toast({ title: "Error", description: "No se pudo registrar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      const r = await fetch(`${apiBase}/api/justificaciones/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error();
      setItems(prev => prev.filter(x => x.id !== id));
      toast({ title: "Eliminado" });
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter(x =>
      x.apellidoNombre.toLowerCase().includes(q) ||
      x.curso.toLowerCase().includes(q) ||
      x.docente.toLowerCase().includes(q) ||
      (x.descripcion || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const stats = useMemo(() => ({
    total: items.length,
    justificados: items.filter(x => x.justificado).length,
    pendientes: items.filter(x => !x.justificado).length,
  }), [items]);

  const puedeEliminar = user?.role === "administrador" || user?.role === "coordinador";

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#001f5f]">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
            Justificación de Falta
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registra a un estudiante. Aparecerá automáticamente en <b>Soporte Justificación</b> para hacer seguimiento.
          </p>
        </div>
        <Button variant="outline" onClick={fetchAll} className="gap-2">
          <RefreshCcw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-white rounded-xl border shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-bold text-[#001f5f] flex items-center gap-1.5">
            <Plus className="h-4 w-4 text-blue-600" /> Nuevo registro
          </h3>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label className="text-xs">Apellido y nombre *</Label>
              <Input value={form.apellidoNombre}
                onChange={e => setForm({ ...form, apellidoNombre: e.target.value.toUpperCase() })}
                placeholder="PEREZ GARCIA JUAN" className="uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Curso *</Label>
                <Input value={form.curso}
                  onChange={e => setForm({ ...form, curso: e.target.value })}
                  placeholder="Matemática I" />
              </div>
              <div>
                <Label className="text-xs">Ciclo *</Label>
                <Input value={form.ciclo}
                  onChange={e => setForm({ ...form, ciclo: e.target.value })}
                  placeholder="1, 2, 3..." />
              </div>
            </div>
            <div>
              <Label className="text-xs">Docente *</Label>
              <Input value={form.docente}
                onChange={e => setForm({ ...form, docente: e.target.value.toUpperCase() })}
                placeholder="APELLIDOS Y NOMBRES" className="uppercase" />
            </div>
            <div>
              <Label className="text-xs">Día *</Label>
              <select
                value={form.dia}
                onChange={e => setForm({ ...form, dia: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Selecciona —</option>
                {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Textarea value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Motivo de la falta…" rows={3} />
            </div>
            <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
            </Button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#001f5f]">Mis registros</h3>
              <Badge className="bg-[#001f5f] text-white border-0">{stats.total}</Badge>
              <Badge className="bg-emerald-600 text-white border-0">{stats.justificados} justificados</Badge>
              <Badge className="bg-amber-500 text-white border-0">{stats.pendientes} pendientes</Badge>
            </div>
            <div className="relative w-56">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" className="pl-8 h-9" />
            </div>
          </div>
          <div className="max-h-[640px] overflow-auto">
            {loading ? (
              <div className="p-8 flex justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Aún no hay registros.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-2 py-2 text-left">Estudiante</th>
                    <th className="px-2 py-2 text-left">Curso · Ciclo</th>
                    <th className="px-2 py-2 text-left">Docente · Día</th>
                    <th className="px-2 py-2 text-center">Estado</th>
                    {puedeEliminar && <th className="px-2 py-2"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map(j => (
                    <tr key={j.id} className={j.justificado ? "bg-emerald-50/50" : ""}>
                      <td className="px-2 py-2 align-top">
                        <div className="font-bold text-[#001f5f]">{j.apellidoNombre}</div>
                        {j.descripcion && <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{j.descripcion}</div>}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div>{j.curso}</div>
                        <div className="text-[10px] text-muted-foreground">Ciclo {j.ciclo}</div>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="text-[11px]">{j.docente}</div>
                        <div className="text-[10px] text-muted-foreground">{j.dia}</div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {j.justificado ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> JUSTIFICADO
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700">PENDIENTE</span>
                        )}
                      </td>
                      {puedeEliminar && (
                        <td className="px-2 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => eliminar(j.id)} className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
