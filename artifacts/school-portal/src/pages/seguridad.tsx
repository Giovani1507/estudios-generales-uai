import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Search, X, RefreshCw, UserX, Check, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";

type PlanRow = { docente: string; [k: string]: unknown };

type FlagRecord = {
  id: number;
  nombre: string;
  tipo: string;
  estado: string;
};

export default function Seguridad() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [allDocentes, setAllDocentes] = useState<string[]>([]);
  const [flags, setFlags] = useState<FlagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  // Cargar docentes del JSON
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}planificacion-fica-2026-1.json`).then(r => r.ok ? r.json() : []),
      fetch(`${base}planificacion-fcs-2026-1.json`).then(r => r.ok ? r.json() : []),
    ]).then(([fica, fcs]: [PlanRow[], PlanRow[]]) => {
      const names = new Set<string>();
      [...fica, ...fcs].forEach(row => {
        if (row.docente) names.add(row.docente.trim().toUpperCase());
      });
      setAllDocentes([...names].sort());
    }).catch(() => {});
  }, []);

  // Cargar flags del servidor
  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/seguridad-docentes`, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      const data: FlagRecord[] = await r.json();
      setFlags(data.filter(f => f.estado !== "RESUELTO"));
    } catch (e) {
      toast({ title: "Error al cargar registros", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  // Mapa: nombre → id del flag activo
  const flagMap = useMemo(() => {
    const m = new Map<string, number>();
    flags.forEach(f => m.set(f.nombre.trim().toUpperCase(), f.id));
    return m;
  }, [flags]);

  async function toggleFlag(nombre: string) {
    setToggling(nombre);
    try {
      if (flagMap.has(nombre)) {
        // Quitar flag → marcar como RESUELTO (o eliminar)
        const id = flagMap.get(nombre)!;
        await fetch(`${apiBase}/api/seguridad-docentes/${id}`, {
          method: "DELETE", credentials: "include",
        });
        setFlags(p => p.filter(f => f.id !== id));
        toast({ title: "Flag eliminado" });
      } else {
        // Poner flag
        const r = await fetch(`${apiBase}/api/seguridad-docentes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            nombre,
            tipo: "RENUNCIO_CARGA",
            prioridad: "ALTA",
            registradoPor: user?.username ?? null,
          }),
        });
        if (!r.ok) throw new Error((await r.json()).error || `${r.status}`);
        const nuevo = await r.json();
        setFlags(p => [...p, nuevo]);
        toast({ title: "Docente marcado" });
      }
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setToggling(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return q ? allDocentes.filter(n => n.includes(q)) : allDocentes;
  }, [allDocentes, search]);

  const marcados = allDocentes.filter(n => flagMap.has(n)).length;

  return (
    <div className="flex flex-col gap-5 p-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}>
            <ShieldAlert className="w-6 h-6" /> Seguridad — Docentes 2026-I
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allDocentes.length} docentes en el sistema ·{" "}
            <span className="font-semibold text-red-600">{marcados} dejaron la carga lectiva</span>
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchFlags} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300 inline-block" />
          Docente activo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
          Dejó la carga lectiva
        </span>
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar docente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
        {search && (
          <button className="absolute right-2.5 top-2.5" onClick={() => setSearch("")}>
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Lista */}
      {loading && allDocentes.length === 0 ? (
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" /> Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">Sin coincidencias</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(nombre => {
            const flagged = flagMap.has(nombre);
            const busy = toggling === nombre;
            return (
              <Card
                key={nombre}
                className={`rounded-xl border-2 transition-all ${
                  flagged
                    ? "border-red-300 bg-red-50"
                    : "border-gray-100 bg-white hover:border-gray-200"
                }`}
              >
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Indicador */}
                    <div className={`w-3 h-3 rounded-full shrink-0 ${flagged ? "bg-red-500" : "bg-gray-200 border border-gray-300"}`} />

                    {/* Nombre */}
                    <p className={`flex-1 text-sm font-semibold ${flagged ? "text-red-700 line-through" : "text-gray-800"}`}>
                      {nombre}
                    </p>

                    {/* Badge si flagged */}
                    {flagged && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white uppercase tracking-wide shrink-0">
                        <UserX className="w-2.5 h-2.5" /> Dejó la carga
                      </span>
                    )}

                    {/* Botón */}
                    <Button
                      size="sm"
                      variant={flagged ? "outline" : "ghost"}
                      className={`h-7 text-xs shrink-0 ${
                        flagged
                          ? "border-red-300 text-red-600 hover:bg-red-100"
                          : "text-red-500 hover:bg-red-50 hover:text-red-700"
                      }`}
                      onClick={() => toggleFlag(nombre)}
                      disabled={busy}
                    >
                      {busy ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : flagged ? (
                        <><Undo2 className="w-3 h-3 mr-1" />Desmarcar</>
                      ) : (
                        <><UserX className="w-3 h-3 mr-1" />Dejó la carga lectiva</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Mostrando {filtered.length} de {allDocentes.length} docentes
        </p>
      )}
    </div>
  );
}
