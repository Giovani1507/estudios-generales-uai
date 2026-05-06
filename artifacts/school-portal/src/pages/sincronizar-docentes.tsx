import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Search,
  Users,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";

interface DocenteExterno {
  id: number;
  username: string;
  name: string;
  career: string | null;
  faculty: string | null;
  sections: number | null;
  syncedAt: string;
  updatedAt: string;
}

interface SyncResult {
  ok: boolean;
  message: string;
  total: number;
  nuevos: number;
  actualizados: number;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchDocentes(q: string): Promise<DocenteExterno[]> {
  const url = q ? `${BASE}/api/sincronizar-docentes?q=${encodeURIComponent(q)}` : `${BASE}/api/sincronizar-docentes`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Error al obtener docentes");
  return res.json();
}

async function postSync(cookie: string, termId: string): Promise<SyncResult> {
  const res = await fetch(`${BASE}/api/sincronizar-docentes`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { "x-intranet-cookie": cookie } : {}),
    },
    body: JSON.stringify({ termId: termId || undefined }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Error al sincronizar");
  }
  return data;
}

export default function SincronizarDocentes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [busqueda, setBusqueda] = useState("");
  const [query, setQuery] = useState("");

  const [cookie, setCookie] = useState("");
  const [termId, setTermId] = useState("08de1730-801b-4d3d-81a8-e840d74c49fa");
  const [showCookie, setShowCookie] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const [lastSync, setLastSync] = useState<SyncResult | null>(null);

  const { data: docentes = [], isLoading, isFetching } = useQuery<DocenteExterno[]>({
    queryKey: ["docentes-externos", query],
    queryFn: () => fetchDocentes(query),
    staleTime: 30_000,
  });

  const syncMutation = useMutation<SyncResult, Error>({
    mutationFn: () => postSync(cookie, termId),
    onSuccess: (result) => {
      setLastSync(result);
      queryClient.invalidateQueries({ queryKey: ["docentes-externos"] });
      toast({
        title: "Sincronización completada",
        description: `${result.total} docentes obtenidos · ${result.nuevos} nuevos · ${result.actualizados} actualizados`,
      });
    },
    onError: (err: any) => {
      if (err.message?.includes("Cookie") || err.message?.includes("cookie") || err.message?.includes("AUTH")) {
        setConfigOpen(true);
        toast({
          title: "Cookie requerida",
          description: "Configura la cookie de sesión de la intranet para sincronizar.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error al sincronizar",
          description: err.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setQuery(busqueda.trim());
  }, [busqueda]);

  const clearSearch = useCallback(() => {
    setBusqueda("");
    setQuery("");
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, DocenteExterno[]>();
    for (const d of docentes) {
      const fac = d.faculty || "Sin Facultad";
      if (!map.has(fac)) map.set(fac, []);
      map.get(fac)!.push(d);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [docentes]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sincronizar Docentes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importa docentes desde la intranet UAI hacia el sistema de asistencia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigOpen((o) => !o)}
            className="gap-2"
          >
            <Lock className="w-3.5 h-3.5" />
            Configurar cookie
          </Button>

          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Sincronizando..." : "Sincronizar docentes"}
          </Button>
        </div>
      </div>

      {/* Config panel */}
      {configOpen && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Copia la cookie de sesión desde las herramientas de desarrollo del navegador
              (DevTools → Application → Cookies → intranet.autonomadeica.edu.pe).
              La cookie no se almacena, solo se usa en esta sesión.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-amber-900">Cookie de sesión</label>
              <div className="relative">
                <Input
                  type={showCookie ? "text" : "password"}
                  placeholder="Pega aquí la cookie completa..."
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  className="pr-10 text-xs font-mono bg-white border-amber-300"
                />
                <button
                  type="button"
                  onClick={() => setShowCookie((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-600 hover:text-amber-800"
                >
                  {showCookie ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-amber-900">Term ID (ciclo académico)</label>
              <Input
                placeholder="UUID del ciclo académico"
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="text-xs font-mono bg-white border-amber-300"
              />
            </div>
          </div>
          <p className="text-xs text-amber-700">
            También puedes configurar <code className="bg-amber-100 px-1 rounded">INTRANET_COOKIE</code> e{" "}
            <code className="bg-amber-100 px-1 rounded">INTRANET_TERM_ID</code> como variables de entorno en el servidor.
          </p>
        </div>
      )}

      {/* Last sync result */}
      {lastSync && (
        <div className="flex items-center gap-3 border border-green-200 bg-green-50 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">Sincronización completada</p>
            <p className="text-xs text-green-700">
              {lastSync.total} docentes obtenidos · {lastSync.nuevos} nuevos · {lastSync.actualizados} actualizados
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4 bg-white space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-foreground">{docentes.length}</p>
          <p className="text-xs text-muted-foreground">docentes sincronizados</p>
        </div>
        <div className="border rounded-lg p-4 bg-white space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Facultades</p>
          <p className="text-2xl font-bold text-foreground">
            {new Set(docentes.map((d) => d.faculty).filter(Boolean)).size}
          </p>
          <p className="text-xs text-muted-foreground">distintas</p>
        </div>
        <div className="border rounded-lg p-4 bg-white space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Carreras</p>
          <p className="text-2xl font-bold text-foreground">
            {new Set(docentes.map((d) => d.career).filter(Boolean)).size}
          </p>
          <p className="text-xs text-muted-foreground">distintas</p>
        </div>
        <div className="border rounded-lg p-4 bg-white space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Secciones</p>
          <p className="text-2xl font-bold text-foreground">
            {docentes.reduce((s, d) => s + (d.sections ?? 0), 0)}
          </p>
          <p className="text-xs text-muted-foreground">totales asignadas</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">Buscar</Button>
        {query && (
          <Button type="button" variant="ghost" onClick={clearSearch}>
            Limpiar
          </Button>
        )}
      </form>

      {query && (
        <p className="text-sm text-muted-foreground">
          {docentes.length} resultado{docentes.length !== 1 ? "s" : ""} para "{query}"
        </p>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : docentes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 border rounded-lg bg-white">
          <Users className="w-12 h-12 text-muted-foreground/40" />
          {query ? (
            <>
              <p className="text-muted-foreground font-medium">Sin resultados para "{query}"</p>
              <Button variant="ghost" onClick={clearSearch}>Ver todos</Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground font-medium">No hay docentes sincronizados aún</p>
              <p className="text-sm text-muted-foreground">Haz clic en "Sincronizar docentes" para importar desde la intranet.</p>
            </>
          )}
        </div>
      ) : query ? (
        /* Flat table for search results */
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-32">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Carrera</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Facultad</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground w-28">Secciones</th>
              </tr>
            </thead>
            <tbody>
              {docentes.map((d, i) => (
                <tr key={d.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"} hover:bg-primary/5 transition-colors`}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.username}</td>
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{d.career || "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {d.faculty ? (
                      <Badge variant="secondary" className="text-xs font-normal">{d.faculty}</Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {d.sections ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grouped by faculty */
        <div className="space-y-4">
          {grouped.map(([faculty, list]) => (
            <div key={faculty} className="border rounded-lg overflow-hidden bg-white">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">{faculty}</span>
                </div>
                <Badge variant="outline" className="text-xs">{list.length} docentes</Badge>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/10">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs w-32">Código</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Nombre</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs hidden md:table-cell">Carrera</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground text-xs w-28">Secciones</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((d, i) => (
                    <tr key={d.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"} hover:bg-primary/5 transition-colors`}>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{d.username}</td>
                      <td className="px-4 py-2.5 font-medium text-sm">{d.name}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{d.career || "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {d.sections ?? 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {isFetching && !isLoading && (
        <p className="text-center text-xs text-muted-foreground animate-pulse">Actualizando...</p>
      )}
    </div>
  );
}
