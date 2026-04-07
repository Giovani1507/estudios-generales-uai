import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  CheckCircle2,
  XCircle,
  QrCode,
  CalendarCheck,
  Download,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

type MapeoRow = {
  id: number;
  dni: string;
  apellidos_nombres: string;
  codigo_estudiante: string | null;
  carrera: string | null;
  sede: string | null;
  modalidad_ingreso: string | null;
  modalidad_estudio: string | null;
  turno: string | null;
  seccion: string | null;
  celular: string | null;
  correo: string | null;
  cv_id: number | null;
  tiene_horario: boolean | null;
  cv_encontrado: boolean | null;
  verificado_en: string | null;
  sr_id: number | null;
  registrado_en: string | null;
};

const NAVY = "#001F5F";
const GOLD  = "#C9A84C";

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className="rounded-full p-3"
          style={{ background: color + "20" }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color }}>
            {value.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const ALL = "__ALL__";

export default function MapeoEstudiantes() {
  const [rows, setRows]       = useState<MapeoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const PAGE_SIZE = 50;

  // Filters
  const [fCarrera, setFCarrera]         = useState(ALL);
  const [fSede, setFSede]               = useState(ALL);
  const [fTurno, setFTurno]             = useState(ALL);
  const [fModalidad, setFModalidad]     = useState(ALL);
  const [fVerificado, setFVerificado]   = useState(ALL);
  const [fHorario, setFHorario]         = useState(ALL);
  const [fRegistrado, setFRegistrado]   = useState(ALL);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${apiBase}/api/students/mapeo`, { credentials: "include" });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      setRows(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  // Unique filter options
  const carreras   = useMemo(() => [...new Set(rows.map(r => r.carrera).filter(Boolean))].sort() as string[], [rows]);
  const sedes      = useMemo(() => [...new Set(rows.map(r => r.sede).filter(Boolean))].sort() as string[], [rows]);
  const turnos     = useMemo(() => [...new Set(rows.map(r => r.turno).filter(Boolean))].sort() as string[], [rows]);
  const modalidades = useMemo(() => [...new Set(rows.map(r => r.modalidad_estudio).filter(Boolean))].sort() as string[], [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !r.apellidos_nombres.toLowerCase().includes(q)
            && !(r.dni ?? "").includes(q)
            && !(r.codigo_estudiante ?? "").toLowerCase().includes(q)) return false;
      if (fCarrera   !== ALL && r.carrera            !== fCarrera)   return false;
      if (fSede      !== ALL && r.sede               !== fSede)      return false;
      if (fTurno     !== ALL && r.turno              !== fTurno)     return false;
      if (fModalidad !== ALL && r.modalidad_estudio  !== fModalidad) return false;
      if (fVerificado !== ALL) {
        const v = r.cv_id !== null;
        if (fVerificado === "si" && !v) return false;
        if (fVerificado === "no" && v)  return false;
      }
      if (fHorario !== ALL) {
        const h = !!r.tiene_horario;
        if (fHorario === "si" && !h) return false;
        if (fHorario === "no" && h)  return false;
      }
      if (fRegistrado !== ALL) {
        const reg = r.sr_id !== null;
        if (fRegistrado === "si" && !reg) return false;
        if (fRegistrado === "no" && reg)  return false;
      }
      return true;
    });
  }, [rows, search, fCarrera, fSede, fTurno, fModalidad, fVerificado, fHorario, fRegistrado]);

  // Totals (over all rows, not filtered)
  const totalAll       = rows.length;
  const totalVerif     = rows.filter(r => r.cv_id !== null).length;
  const totalHorario   = rows.filter(r => r.tiene_horario).length;
  const totalRegistr   = rows.filter(r => r.sr_id !== null).length;
  const totalSinVerif  = rows.filter(r => r.cv_id === null).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage() { setPage(1); }

  function exportExcel() {
    const header = [
      "DNI", "Apellidos y Nombres", "Código", "Carrera", "Sede",
      "Modalidad", "Turno", "Sección", "Celular", "Correo",
      "Verificado", "Con Horario", "Registrado QR", "Fecha Verificación", "Fecha Registro QR",
    ];
    const tsv = [header, ...filtered.map(r => [
      r.dni,
      r.apellidos_nombres,
      r.codigo_estudiante ?? "",
      r.carrera ?? "",
      r.sede ?? "",
      r.modalidad_estudio ?? "",
      r.turno ?? "",
      r.seccion ?? "",
      r.celular ?? "",
      r.correo ?? "",
      r.cv_id !== null ? "Sí" : "No",
      r.tiene_horario ? "Sí" : "No",
      r.sr_id !== null ? "Sí" : "No",
      r.verificado_en ? new Date(r.verificado_en).toLocaleString("es-PE") : "",
      r.registrado_en ? new Date(r.registrado_en).toLocaleString("es-PE") : "",
    ])].map(row => row.join("\t")).join("\n");

    const blob = new Blob(["\uFEFF" + tsv], { type: "text/tab-separated-values;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mapeo-estudiantes-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function clearFilters() {
    setSearch(""); setFCarrera(ALL); setFSede(ALL); setFTurno(ALL);
    setFModalidad(ALL); setFVerificado(ALL); setFHorario(ALL); setFRegistrado(ALL);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Mapeo Estudiantes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ingresantes 2026-I — cruce con verificación de códigos y registros QR
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button size="sm" onClick={exportExcel} disabled={loading || filtered.length === 0}
            style={{ background: NAVY, color: "#fff" }}>
            <Download className="w-4 h-4 mr-1.5" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total ingresantes"  value={totalAll}      color={NAVY}    icon={Users} />
        <StatCard label="Verificados"         value={totalVerif}    color="#2563eb" icon={CheckCircle2} />
        <StatCard label="Con horario ✓"       value={totalHorario}  color="#16a34a" icon={CalendarCheck} />
        <StatCard label="Registrados QR"      value={totalRegistr}  color={GOLD}    icon={QrCode} />
        <StatCard label="Sin verificar"       value={totalSinVerif} color="#dc2626" icon={XCircle} />
      </div>

      {/* Filters */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: NAVY }}>
            <Filter className="w-4 h-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="relative col-span-2 md:col-span-2">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nombre, DNI o código..."
                value={search}
                onChange={e => { setSearch(e.target.value); resetPage(); }}
                className="pl-8"
              />
            </div>
            <Select value={fCarrera} onValueChange={v => { setFCarrera(v); resetPage(); }}>
              <SelectTrigger><SelectValue placeholder="Carrera" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas las carreras</SelectItem>
                {carreras.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fSede} onValueChange={v => { setFSede(v); resetPage(); }}>
              <SelectTrigger><SelectValue placeholder="Sede" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas las sedes</SelectItem>
                {sedes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fTurno} onValueChange={v => { setFTurno(v); resetPage(); }}>
              <SelectTrigger><SelectValue placeholder="Turno" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los turnos</SelectItem>
                {turnos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fVerificado} onValueChange={v => { setFVerificado(v); resetPage(); }}>
              <SelectTrigger><SelectValue placeholder="Verificado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Cualquier estado</SelectItem>
                <SelectItem value="si">Verificado</SelectItem>
                <SelectItem value="no">Sin verificar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fHorario} onValueChange={v => { setFHorario(v); resetPage(); }}>
              <SelectTrigger><SelectValue placeholder="Horario" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Con y sin horario</SelectItem>
                <SelectItem value="si">Con horario</SelectItem>
                <SelectItem value="no">Sin horario</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">
              Mostrando <span className="font-semibold">{filtered.length.toLocaleString()}</span> de {totalAll.toLocaleString()} ingresantes
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        {error && (
          <div className="px-5 py-3 text-sm text-red-600 bg-red-50 border-b">
            Error al cargar datos: {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Cargando mapeo...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: NAVY }} className="text-white text-xs">
                    <th className="px-4 py-3 text-left font-semibold w-6">#</th>
                    <th className="px-4 py-3 text-left font-semibold">Apellidos y Nombres</th>
                    <th className="px-4 py-3 text-left font-semibold">DNI</th>
                    <th className="px-4 py-3 text-left font-semibold">Código</th>
                    <th className="px-4 py-3 text-left font-semibold">Carrera</th>
                    <th className="px-4 py-3 text-left font-semibold">Sede</th>
                    <th className="px-4 py-3 text-left font-semibold">Turno</th>
                    <th className="px-4 py-3 text-center font-semibold">Verificado</th>
                    <th className="px-4 py-3 text-center font-semibold">Horario ✓</th>
                    <th className="px-4 py-3 text-center font-semibold">Reg. QR</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-muted-foreground">
                        No se encontraron registros con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((r, i) => {
                      const verificado  = r.cv_id !== null;
                      const conHorario  = !!r.tiene_horario;
                      const registrado  = r.sr_id !== null;
                      const rowBg = conHorario
                        ? "bg-blue-50"
                        : verificado
                        ? "bg-green-50/40"
                        : "";
                      return (
                        <tr key={r.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${rowBg}`}>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {(page - 1) * PAGE_SIZE + i + 1}
                          </td>
                          <td className="px-4 py-2.5 font-medium max-w-[220px] truncate" title={r.apellidos_nombres}>
                            {r.apellidos_nombres}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">{r.dni}</td>
                          <td className="px-4 py-2.5 font-mono text-xs">{r.codigo_estudiante ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs max-w-[160px] truncate" title={r.carrera ?? ""}>{r.carrera ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs">{r.sede ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs">{r.turno ?? "—"}</td>
                          <td className="px-4 py-2.5 text-center">
                            {verificado ? (
                              <Badge className="text-[11px] px-2 py-0.5 bg-green-100 text-green-700 border-green-200 border">
                                Sí
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[11px] px-2 py-0.5 text-gray-400">
                                No
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {conHorario ? (
                              <Badge className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-700 border-blue-200 border">
                                ✓ Sí
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[11px] px-2 py-0.5 text-gray-400">
                                No
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {registrado ? (
                              <Badge className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-700 border-amber-200 border">
                                Sí
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[11px] px-2 py-0.5 text-gray-400">
                                No
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50/50 text-sm">
                <span className="text-xs text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    ‹ Anterior
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, k) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const n = start + k;
                    if (n > totalPages) return null;
                    return (
                      <Button key={n} size="sm"
                        variant={n === page ? "default" : "outline"}
                        style={n === page ? { background: NAVY } : {}}
                        onClick={() => setPage(n)}>
                        {n}
                      </Button>
                    );
                  })}
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Siguiente ›
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
