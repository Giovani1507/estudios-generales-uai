import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Mail, CheckCircle2, Trash2, Loader2, Search, RefreshCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLogPageEntry } from "@/hooks/use-activity-log";
import { useAuth } from "@/lib/auth";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const SHARED_URL = `${apiBase}/api/shared-state/docentesSinAsistencias`;

type Flag = {
  id: string;
  docente: string;
  codigoCurso: string;
  nombreCurso: string;
  carrera: string | null;
  ciclo: string | null;
  seccion: string | null;
  sede: string | null;
  motivo: "VACIO" | "REPETIDO" | "IGUAL";
  flaggedAt: string;
  flaggedByName: string | null;
  correoEnviado: boolean;
  correoEnviadoAt: string | null;
  correoEnviadoByName: string | null;
};

type Teacher = { id: number; fullName: string; email: string | null };

const fmtFecha = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

const norm = (s: string | null | undefined) => (s || "").toUpperCase().trim();

export default function DocentesSinAsistencias() {
  useLogPageEntry("Docentes sin Asistencias");
  const { toast } = useToast();
  const { user } = useAuth();
  const [list, setList] = useState<Flag[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"PENDIENTES" | "ENVIADOS" | "TODOS">("TODOS");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const lastUpdatedAtRef = useRef<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch(SHARED_URL, { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      const value = Array.isArray(data?.value) ? data.value : [];
      setList(value);
      lastUpdatedAtRef.current = data?.updatedAt || null;
    } catch {}
  };

  const loadTeachers = async () => {
    try {
      const r = await fetch(`${apiBase}/api/teachers`, { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      setTeachers(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([load(), loadTeachers()]);
      setLoading(false);
    })();
  }, []);

  // Polling: refrescar cada 6s para ver lo que marcaron otros
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      load();
    }, 6000);
    return () => window.clearInterval(id);
  }, []);

  const teacherByName = useMemo(() => {
    const m = new Map<string, Teacher>();
    for (const t of teachers) m.set(norm(t.fullName), t);
    return m;
  }, [teachers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return list.filter(f => {
      if (filter === "PENDIENTES" && f.correoEnviado) return false;
      if (filter === "ENVIADOS" && !f.correoEnviado) return false;
      if (!q) return true;
      const hay = `${f.docente} ${f.nombreCurso} ${f.codigoCurso} ${f.carrera || ""} ${f.seccion || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [list, filter, search]);

  const counts = useMemo(() => ({
    pendientes: list.filter(f => !f.correoEnviado).length,
    enviados:   list.filter(f =>  f.correoEnviado).length,
    total:      list.length,
  }), [list]);

  const persist = async (next: Flag[]) => {
    setList(next);
    try {
      const r = await fetch(SHARED_URL, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      if (r.ok) {
        const data = await r.json();
        lastUpdatedAtRef.current = data?.updatedAt || null;
      }
    } catch {
      toast({ title: "No se pudo guardar el cambio", variant: "destructive" });
    }
  };

  const toggleEnviado = async (id: string) => {
    setSavingIds(prev => new Set(prev).add(id));
    const next = list.map(f => {
      if (f.id !== id) return f;
      const enviado = !f.correoEnviado;
      return {
        ...f,
        correoEnviado: enviado,
        correoEnviadoAt: enviado ? new Date().toISOString() : null,
        correoEnviadoByName: enviado ? (user?.fullName || null) : null,
      };
    });
    await persist(next);
    setSavingIds(prev => {
      const s = new Set(prev); s.delete(id); return s;
    });
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Quitar este registro?")) return;
    await persist(list.filter(f => f.id !== id));
  };

  const limpiarEnviados = async () => {
    if (!confirm(`¿Eliminar los ${counts.enviados} registros con correo enviado?`)) return;
    await persist(list.filter(f => !f.correoEnviado));
  };

  const enviarCorreo = (f: Flag) => {
    // Si ya está marcado como enviado, solo mostramos confirmación.
    if (f.correoEnviado) {
      toast({
        title: "✉️ Correo ya enviado",
        description: `Se envió correo al docente ${f.docente}${f.correoEnviadoByName ? ` (registrado por ${f.correoEnviadoByName})` : ""}.`,
        duration: 5000,
      });
      return;
    }
    const teacher = teacherByName.get(norm(f.docente));
    const email = teacher?.email || "";
    const subject = encodeURIComponent(
      f.motivo === "VACIO"
        ? `Asistencia sin marcas - ${f.nombreCurso} (${f.seccion || ""})`
        : `Asistencia sin actualizar - ${f.nombreCurso} (${f.seccion || ""})`
    );
    const body = encodeURIComponent(
      `Estimado(a) docente ${f.docente}:\n\n` +
      `Le escribimos respecto a la asistencia del curso ${f.nombreCurso}` +
      `${f.codigoCurso ? ` (${f.codigoCurso})` : ""}` +
      `${f.seccion ? ` — sección ${f.seccion}` : ""}.\n\n` +
      (f.motivo === "VACIO"
        ? `El archivo de asistencia subido no contiene marcas registradas. Le pedimos por favor regularizar las asistencias en el sistema y volver a generar el reporte.\n\n`
        : f.motivo === "IGUAL"
        ? `Al sincronizar su asistencia no se encontraron cambios respecto a la información anterior. Le pedimos verificar que las marcas estén registradas en el sistema y volver a sincronizar.\n\n`
        : `El archivo de asistencia subido es idéntico al del periodo anterior, por lo que no se reflejan nuevas marcas. Le pedimos verificar y subir la versión actualizada.\n\n`) +
      `Quedamos atentos.\nCoordinación Académica UAI`
    );
    // Abrimos el cliente de correo en una pestaña nueva (más fiable que cambiar
    // window.location, que podría romper la navegación de la SPA).
    const mailto = `mailto:${email}?subject=${subject}&body=${body}`;
    const a = document.createElement("a");
    a.href = mailto;
    a.rel = "noopener noreferrer";
    a.target = "_self";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (!email) {
      toast({
        title: "Sin correo registrado",
        description: `No hay email guardado para ${f.docente}. Se abrió el correo en blanco.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "✉️ Abriendo correo",
        description: `Se abrió el cliente de correo para ${f.docente} (${email}). Marca el ✓ cuando lo envíes.`,
        duration: 5000,
      });
    }
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
            Docentes sin asistencias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aparecen automáticamente cuando alguien intenta subir un Excel <b>vacío</b> (sin marcas) o <b>idéntico</b> al anterior.
            Marca con el check al docente cuando ya le hayas enviado el correo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50">
            {counts.pendientes} pendientes
          </Badge>
          <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300 bg-emerald-50">
            {counts.enviados} con correo enviado
          </Badge>
          <Button variant="outline" size="sm" className="h-8" onClick={() => load()}>
            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Actualizar
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border/40 p-4 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar docente, curso, sección…"
              className="pl-8 h-9 bg-white"
            />
          </div>
          <div className="flex gap-1 text-xs">
            {(["PENDIENTES","ENVIADOS","TODOS"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`px-3 py-1.5 rounded-full border transition ${
                  filter === opt
                    ? "bg-[#001f5f] text-white border-[#001f5f]"
                    : "bg-white text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {opt === "PENDIENTES" ? `Pendientes (${counts.pendientes})`
                 : opt === "ENVIADOS" ? `Enviados (${counts.enviados})`
                 : `Todos (${counts.total})`}
              </button>
            ))}
          </div>
          {counts.enviados > 0 && (
            <Button variant="ghost" size="sm" className="h-8 ml-auto text-rose-600 hover:text-rose-700" onClick={limpiarEnviados}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Quitar enviados
            </Button>
          )}
        </div>

        <div className="overflow-auto rounded-lg border border-border/40">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Cargando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              {list.length === 0
                ? "No hay docentes marcados. Aquí aparecerán automáticamente cuando alguien suba un Excel vacío o repetido."
                : "No hay registros para los filtros seleccionados."}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-center w-10">✓</th>
                  <th className="px-3 py-2 text-left">Docente</th>
                  <th className="px-3 py-2 text-left">Curso</th>
                  <th className="px-3 py-2 text-center">Sec</th>
                  <th className="px-3 py-2 text-center">Sede</th>
                  <th className="px-3 py-2 text-center">Motivo</th>
                  <th className="px-3 py-2 text-left">Marcado</th>
                  <th className="px-3 py-2 text-left">Correo</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => {
                  const teacher = teacherByName.get(norm(f.docente));
                  const saving = savingIds.has(f.id);
                  return (
                    <tr key={f.id} className={`${i % 2 ? "bg-muted/20" : ""} ${f.correoEnviado ? "bg-emerald-50/40" : ""}`}>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={f.correoEnviado}
                          disabled={saving}
                          onChange={() => toggleEnviado(f.id)}
                          className="h-4 w-4 accent-emerald-600 cursor-pointer"
                          title={f.correoEnviado ? "Marcar como pendiente" : "Marcar como correo enviado"}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold">{f.docente}</div>
                        <div className="text-[10px] text-muted-foreground">{teacher?.email || "sin email registrado"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium max-w-[260px] line-clamp-2">{f.nombreCurso}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{f.codigoCurso}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono">{f.seccion || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="outline" className="text-[10px]">{f.sede || "—"}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {f.motivo === "VACIO" ? (
                          <Badge className="bg-rose-500 text-white border-0 text-[10px]">Sin marcas</Badge>
                        ) : f.motivo === "IGUAL" ? (
                          <Badge className="bg-sky-500 text-white border-0 text-[10px]">Sin cambios</Badge>
                        ) : (
                          <Badge className="bg-amber-500 text-white border-0 text-[10px]">Repetido</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-muted-foreground">
                        <div>{fmtFecha(f.flaggedAt)}</div>
                        {f.flaggedByName && <div>por {f.flaggedByName}</div>}
                      </td>
                      <td className="px-3 py-2 text-[10px]">
                        {f.correoEnviado ? (
                          <div className="text-emerald-700">
                            <div className="flex items-center gap-1 font-semibold">
                              <CheckCircle2 className="h-3 w-3" /> Enviado
                            </div>
                            <div>{fmtFecha(f.correoEnviadoAt)}</div>
                            {f.correoEnviadoByName && <div>por {f.correoEnviadoByName}</div>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Pendiente</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 gap-1 text-[10px] border-blue-300 text-blue-700 hover:bg-blue-50"
                          onClick={() => enviarCorreo(f)}
                        >
                          <Mail className="h-3 w-3" /> Correo
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                          onClick={() => eliminar(f.id)}
                          title="Quitar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
