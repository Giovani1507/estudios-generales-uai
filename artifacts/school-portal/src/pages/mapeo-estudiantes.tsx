import React, { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  PlusCircle,
  Trash2,
  Download,
  RefreshCw,
  Search,
  ClipboardEdit,
  X,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";
const GOLD = "#C9A84C";

const TIPOS_CAMBIO = [
  "Cambio de sede/local",
  "Cambio de carrera",
  "Cambio de turno",
  "Cambio de sección",
  "Cambio de modalidad",
  "Cambio de matrícula",
  "Corrección de datos",
  "Otro",
];

type MapeoCambio = {
  id: number;
  codigoEstudiante: string;
  apellidosNombres: string | null;
  dni: string | null;
  tipoCambio: string;
  campoModificado: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  matriculadoPor: string | null;
  observaciones: string | null;
  registradoPor: string | null;
  registradoEn: string;
};

type IngresanteSnap = {
  apellidos_nombres: string;
  dni: string;
  carrera: string | null;
  sede: string | null;
  turno: string | null;
};

const EMPTY_FORM = {
  codigoEstudiante: "",
  apellidosNombres: "",
  dni: "",
  tipoCambio: "",
  campoModificado: "",
  valorAnterior: "",
  valorNuevo: "",
  matriculadoPor: "",
  observaciones: "",
};

export default function MapeoEstudiantes() {
  const { toast } = useToast();
  const [rows, setRows]         = useState<MapeoCambio[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [open, setOpen]         = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [search, setSearch]     = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const lookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchRows() {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/students/mapeo-cambios`, { credentials: "include" });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      setRows(await r.json());
    } catch {
      toast({ title: "Error al cargar cambios", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRows(); }, []);

  // Auto-lookup student name when code is entered
  useEffect(() => {
    const code = form.codigoEstudiante.trim().toUpperCase();
    if (code.length < 5) return;
    if (lookupRef.current) clearTimeout(lookupRef.current);
    lookupRef.current = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const r = await fetch(
          `${apiBase}/api/students/lookup-codes`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigos: [code] }),
          }
        );
        if (!r.ok) return;
        const data = await r.json();
        const found: IngresanteSnap[] = data.found ?? [];
        if (found.length > 0) {
          const s = found[0];
          setForm(f => ({
            ...f,
            apellidosNombres: f.apellidosNombres || s.apellidos_nombres,
            dni:              f.dni              || s.dni,
          }));
        }
      } finally {
        setLookupLoading(false);
      }
    }, 500);
  }, [form.codigoEstudiante]);

  function field(key: keyof typeof EMPTY_FORM, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.codigoEstudiante.trim()) {
      toast({ title: "El código de estudiante es requerido", variant: "destructive" });
      return;
    }
    if (!form.tipoCambio.trim()) {
      toast({ title: "El tipo de cambio es requerido", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${apiBase}/api/students/mapeo-cambios`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Cambio registrado correctamente" });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      await fetchRows();
    } catch (e) {
      toast({ title: "Error al guardar", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este registro de cambio?")) return;
    try {
      const r = await fetch(`${apiBase}/api/students/mapeo-cambios/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error();
      setRows(prev => prev.filter(x => x.id !== id));
      toast({ title: "Registro eliminado" });
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  }

  function exportExcel() {
    const header = [
      "Código", "Apellidos y Nombres", "DNI", "Tipo de Cambio",
      "Campo Modificado", "Valor Anterior", "Valor Nuevo",
      "Matriculado por", "Observaciones", "Registrado por", "Fecha y Hora",
    ];
    const tsv = [header, ...filtered.map(r => [
      r.codigoEstudiante,
      r.apellidosNombres ?? "",
      r.dni ?? "",
      r.tipoCambio,
      r.campoModificado ?? "",
      r.valorAnterior ?? "",
      r.valorNuevo ?? "",
      r.matriculadoPor ?? "",
      r.observaciones ?? "",
      r.registradoPor ?? "",
      new Date(r.registradoEn).toLocaleString("es-PE"),
    ])].map(row => row.join("\t")).join("\n");
    const blob = new Blob(["\uFEFF" + tsv], { type: "text/tab-separated-values;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mapeo-cambios-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.codigoEstudiante.toLowerCase().includes(q) ||
      (r.apellidosNombres ?? "").toLowerCase().includes(q) ||
      (r.dni ?? "").includes(q) ||
      r.tipoCambio.toLowerCase().includes(q) ||
      (r.matriculadoPor ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const TIPO_COLORS: Record<string, string> = {
    "Cambio de sede/local": "bg-blue-100 text-blue-700 border-blue-200",
    "Cambio de carrera":    "bg-purple-100 text-purple-700 border-purple-200",
    "Cambio de turno":      "bg-amber-100 text-amber-700 border-amber-200",
    "Cambio de sección":    "bg-teal-100 text-teal-700 border-teal-200",
    "Cambio de modalidad":  "bg-indigo-100 text-indigo-700 border-indigo-200",
    "Cambio de matrícula":  "bg-rose-100 text-rose-700 border-rose-200",
    "Corrección de datos":  "bg-green-100 text-green-700 border-green-200",
    "Otro":                 "bg-gray-100 text-gray-600 border-gray-200",
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Mapeo Estudiantes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro de cambios realizados a estudiantes — 2026-I
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button size="sm" onClick={exportExcel} disabled={filtered.length === 0} variant="outline">
            <Download className="w-4 h-4 mr-1.5" />
            Exportar Excel
          </Button>

          {/* New Change Dialog */}
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setForm({ ...EMPTY_FORM }); }}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ background: NAVY, color: "#fff" }}>
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Registrar cambio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2" style={{ color: NAVY }}>
                  <ClipboardEdit className="w-5 h-5" />
                  Registrar Cambio de Estudiante
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 mt-2">
                {/* Código */}
                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>Código de estudiante <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input
                      placeholder="Ej: A261003746"
                      value={form.codigoEstudiante}
                      onChange={e => field("codigoEstudiante", e.target.value)}
                      className="uppercase"
                    />
                    {lookupLoading && (
                      <RefreshCw className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Se autocompleta el nombre al ingresar el código</p>
                </div>

                {/* DNI */}
                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>DNI</Label>
                  <Input
                    placeholder="00000000"
                    value={form.dni}
                    onChange={e => field("dni", e.target.value)}
                  />
                </div>

                {/* Apellidos y nombres */}
                <div className="col-span-2 space-y-1.5">
                  <Label>Apellidos y Nombres</Label>
                  <Input
                    placeholder="Apellidos y nombres del estudiante"
                    value={form.apellidosNombres}
                    onChange={e => field("apellidosNombres", e.target.value)}
                  />
                </div>

                {/* Tipo de cambio */}
                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>Tipo de cambio <span className="text-red-500">*</span></Label>
                  <Select value={form.tipoCambio} onValueChange={v => field("tipoCambio", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CAMBIO.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Campo modificado */}
                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>Campo modificado</Label>
                  <Input
                    placeholder="Ej: Local / Sede"
                    value={form.campoModificado}
                    onChange={e => field("campoModificado", e.target.value)}
                  />
                </div>

                {/* Valor anterior */}
                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>Valor anterior</Label>
                  <Input
                    placeholder="Ej: ICA"
                    value={form.valorAnterior}
                    onChange={e => field("valorAnterior", e.target.value)}
                  />
                </div>

                {/* Valor nuevo */}
                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>Valor nuevo</Label>
                  <Input
                    placeholder="Ej: CHINCHA"
                    value={form.valorNuevo}
                    onChange={e => field("valorNuevo", e.target.value)}
                  />
                </div>

                {/* Matriculado por */}
                <div className="col-span-2 space-y-1.5">
                  <Label>Matriculado por</Label>
                  <Input
                    placeholder="Nombre del personal que realizó la matrícula"
                    value={form.matriculadoPor}
                    onChange={e => field("matriculadoPor", e.target.value)}
                  />
                </div>

                {/* Observaciones */}
                <div className="col-span-2 space-y-1.5">
                  <Label>Observaciones</Label>
                  <Textarea
                    placeholder="Detalles adicionales del cambio realizado..."
                    value={form.observaciones}
                    onChange={e => field("observaciones", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                <Button variant="outline" onClick={() => { setOpen(false); setForm({ ...EMPTY_FORM }); }}>
                  <X className="w-4 h-4 mr-1.5" /> Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}
                  style={{ background: NAVY, color: "#fff" }}>
                  {saving
                    ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                    : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Guardar cambio
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full p-3" style={{ background: NAVY + "15" }}>
              <ClipboardEdit className="w-5 h-5" style={{ color: NAVY }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: NAVY }}>{rows.length}</p>
              <p className="text-sm text-muted-foreground">Total cambios registrados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full p-3 bg-blue-50">
              <ClipboardEdit className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {new Set(rows.map(r => r.tipoCambio)).size}
              </p>
              <p className="text-sm text-muted-foreground">Tipos de cambio distintos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full p-3" style={{ background: GOLD + "20" }}>
              <ClipboardEdit className="w-5 h-5" style={{ color: GOLD }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: GOLD }}>
                {new Set(rows.map(r => r.codigoEstudiante)).size}
              </p>
              <p className="text-sm text-muted-foreground">Estudiantes con cambios</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Table */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, nombre, DNI o tipo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="h-8 text-xs">
                <X className="w-3 h-3 mr-1" /> Limpiar
              </Button>
            )}
            <p className="text-xs text-muted-foreground ml-auto">
              {filtered.length} de {rows.length} registros
            </p>
          </div>
        </CardHeader>

        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Cargando registros...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <ClipboardEdit className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              {rows.length === 0
                ? "Aún no hay cambios registrados. Haz clic en \"Registrar cambio\" para comenzar."
                : "No se encontraron registros con ese criterio de búsqueda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: NAVY }} className="text-white text-xs">
                  <th className="px-4 py-3 text-left font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Código</th>
                  <th className="px-4 py-3 text-left font-semibold">Apellidos y Nombres</th>
                  <th className="px-4 py-3 text-left font-semibold">Tipo de Cambio</th>
                  <th className="px-4 py-3 text-left font-semibold">Detalle del Cambio</th>
                  <th className="px-4 py-3 text-left font-semibold">Matriculado por</th>
                  <th className="px-4 py-3 text-left font-semibold">Registrado por</th>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-center font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: NAVY }}>
                      {r.codigoEstudiante}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="font-medium text-xs truncate" title={r.apellidosNombres ?? ""}>{r.apellidosNombres ?? "—"}</p>
                      {r.dni && <p className="text-[11px] text-muted-foreground font-mono">{r.dni}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[11px] px-2 py-0.5 border ${TIPO_COLORS[r.tipoCambio] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {r.tipoCambio}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px]">
                      {r.campoModificado && (
                        <p className="text-muted-foreground mb-0.5">Campo: <span className="font-medium text-foreground">{r.campoModificado}</span></p>
                      )}
                      {(r.valorAnterior || r.valorNuevo) && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {r.valorAnterior && (
                            <span className="bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5 text-[11px]">
                              {r.valorAnterior}
                            </span>
                          )}
                          {r.valorAnterior && r.valorNuevo && <span className="text-muted-foreground">→</span>}
                          {r.valorNuevo && (
                            <span className="bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5 text-[11px]">
                              {r.valorNuevo}
                            </span>
                          )}
                        </div>
                      )}
                      {r.observaciones && (
                        <p className="text-muted-foreground mt-0.5 italic truncate" title={r.observaciones}>{r.observaciones}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{r.matriculadoPor ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.registradoPor ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.registradoEn).toLocaleString("es-PE", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
