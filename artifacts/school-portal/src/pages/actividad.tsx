import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Activity, Search, RefreshCw, LogIn, LogOut, Download, AlertCircle, Loader2, Clock,
  ClipboardCheck, CheckCircle2, XCircle, Trash2, DoorOpen, Pencil,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

type Log = {
  id: number;
  userId: number | null;
  username: string;
  fullName: string | null;
  role: string | null;
  type: string;
  detail: string | null;
  ip: string | null;
  createdAt: string;
};

const TYPE_CONFIG: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }>; color: string }> = {
  login:                    { label: "Ingreso",            Icon: LogIn,          color: "bg-green-100 text-green-800 border-green-200" },
  logout:                   { label: "Salida",             Icon: LogOut,         color: "bg-slate-100 text-slate-700 border-slate-200" },
  descarga:                 { label: "Descarga",           Icon: Download,       color: "bg-blue-100 text-blue-800 border-blue-200"   },
  ingreso_apartado:         { label: "Entrada apartado",   Icon: DoorOpen,       color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  justificacion_registro:   { label: "Reg. justificación", Icon: ClipboardCheck, color: "bg-blue-100 text-blue-800 border-blue-200"   },
  justificacion_check:      { label: "Justificó",          Icon: CheckCircle2,   color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  justificacion_uncheck:    { label: "Desmarcó just.",     Icon: XCircle,        color: "bg-amber-100 text-amber-800 border-amber-200" },
  justificacion_eliminacion:{ label: "Elim. justificación",Icon: Trash2,         color: "bg-rose-100 text-rose-800 border-rose-200"   },
  edicion:                  { label: "Edición",            Icon: Pencil,         color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  eliminacion:              { label: "Eliminación",        Icon: Trash2,         color: "bg-rose-100 text-rose-800 border-rose-200"   },
  check:                    { label: "Marcado check",      Icon: CheckCircle2,   color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function Actividad() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("TODOS");
  const [refreshing, setRefreshing] = useState(false);

  const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const resp = await fetch(`${base}/api/activity`, { credentials: "include" });
      if (!resp.ok) throw new Error("Sin acceso");
      const data = await resp.json();
      setLogs(data);
    } catch (e: any) {
      setError(e.message ?? "Error al cargar los registros");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = useMemo(() => {
    let result = logs;
    if (tipoFiltro !== "TODOS") result = result.filter(l => l.type === tipoFiltro);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.username.toLowerCase().includes(q) ||
        (l.fullName ?? "").toLowerCase().includes(q) ||
        (l.detail ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, tipoFiltro, search]);

  const stats = useMemo(() => ({
    total: logs.length,
    logins: logs.filter(l => l.type === "login").length,
    logouts: logs.filter(l => l.type === "logout").length,
    descargas: logs.filter(l => l.type === "descarga").length,
    usuarios: new Set(logs.map(l => l.username)).size,
  }), [logs]);

  if (user?.role !== "administrador") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertCircle className="w-12 h-12 opacity-20" />
        <p className="text-sm">Acceso restringido al administrador principal.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Registro de Actividad</h1>
            <p className="text-sm text-muted-foreground">Movimientos del Portal Académico 2026-1</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total eventos", value: stats.total, color: "text-primary" },
          { label: "Ingresos",      value: stats.logins,    color: "text-green-600" },
          { label: "Salidas",       value: stats.logouts,   color: "text-slate-600" },
          { label: "Descargas",     value: stats.descargas, color: "text-blue-600"  },
          { label: "Usuarios únicos", value: stats.usuarios, color: "text-amber-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-border rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los tipos</SelectItem>
            <SelectItem value="login">Ingresos</SelectItem>
            <SelectItem value="logout">Salidas</SelectItem>
            <SelectItem value="descarga">Descargas</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-[280px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar usuario o detalle…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {logs.length} registros
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">Cargando registros…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-destructive opacity-60" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay registros para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#001F5F] text-white">
                  <th className="px-3 py-3 text-center text-xs font-semibold w-10">#</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold w-24">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Usuario</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">Nombre completo</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">Detalle</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold w-20">Rol</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold w-24">Fecha</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold w-20">Hora</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => {
                  const cfg = TYPE_CONFIG[log.type] ?? { label: log.type, Icon: Activity, color: "bg-gray-100 text-gray-700 border-gray-200" };
                  const { Icon } = cfg;
                  return (
                    <tr
                      key={log.id}
                      className={`border-b last:border-0 hover:bg-primary/5 transition-colors ${
                        i % 2 === 0 ? "bg-white" : "bg-muted/30"
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-primary">{log.username}</td>
                      <td className="px-3 py-2.5 text-sm text-foreground">{log.fullName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[220px] truncate" title={log.detail ?? ""}>
                        {log.detail ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                          {log.role ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTime(log.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
