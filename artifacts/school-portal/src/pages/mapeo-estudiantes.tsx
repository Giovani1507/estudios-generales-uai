import React, { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  PlusCircle, Trash2, Download, RefreshCw, Search,
  ClipboardEdit, X, CheckCircle2, Circle, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLogPageEntry } from "@/hooks/use-activity-log";
import { useAuth } from "@/lib/auth";
import * as ExcelJS from "exceljs";

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
  resuelto: boolean;
  resueltaEn: string | null;
  resueltaPor: string | null;
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "Etc/GMT+5",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function exportarExcel(rows: MapeoCambio[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mapeo de Estudiantes");

  const NAVY_A  = "FF001F5F";
  const GOLD_A  = "FFC9A84C";
  const WHITE   = "FFFFFFFF";
  const COLS = [
    { key: "n",      header: "N°",                width: 5  },
    { key: "cod",    header: "Código",             width: 14 },
    { key: "nom",    header: "Apellidos y Nombres",width: 32 },
    { key: "dni",    header: "DNI",                width: 11 },
    { key: "tipo",   header: "Tipo de Cambio",     width: 22 },
    { key: "campo",  header: "Campo Modificado",   width: 18 },
    { key: "antes",  header: "Valor Anterior",     width: 16 },
    { key: "nuevo",  header: "Valor Nuevo",        width: 16 },
    { key: "matr",   header: "Matriculado por",    width: 20 },
    { key: "obs",    header: "Observaciones",      width: 28 },
    { key: "reg",    header: "Registrado por",     width: 16 },
    { key: "fecha",  header: "Fecha de registro",  width: 18 },
    { key: "est",    header: "Estado",             width: 12 },
    { key: "rfecha", header: "Resuelto en",        width: 18 },
    { key: "rpor",   header: "Resuelto por",       width: 16 },
  ];
  ws.columns = COLS.map(c => ({ key: c.key, width: c.width }));

  // ── Row 1: Logo placeholder + título institución ──────────────────────────
  ws.getRow(1).height = 28;
  ws.mergeCells("C1:O1");
  const r1c = ws.getCell("C1");
  r1c.value = "UNIVERSIDAD AUTÓNOMA DE ICA";
  r1c.font = { bold: true, size: 14, color: { argb: NAVY_A }, name: "Calibri" };
  r1c.alignment = { horizontal: "center", vertical: "middle" };

  // ── Row 2: Subtítulo ───────────────────────────────────────────────────────
  ws.getRow(2).height = 20;
  ws.mergeCells("C2:O2");
  const r2c = ws.getCell("C2");
  r2c.value = "Portal Académico 2026-I — Registro de Mapeo de Cambios de Estudiantes";
  r2c.font = { bold: true, size: 11, color: { argb: GOLD_A }, name: "Calibri" };
  r2c.alignment = { horizontal: "center", vertical: "middle" };

  // ── Row 3: Metadatos ───────────────────────────────────────────────────────
  ws.getRow(3).height = 14;
  ws.mergeCells("C3:O3");
  const r3c = ws.getCell("C3");
  r3c.value = `Total: ${rows.length} registros  ·  Pendientes: ${rows.filter(r => !r.resuelto).length}  ·  Resueltos: ${rows.filter(r => r.resuelto).length}  ·  Generado: ${new Date().toLocaleString("es-PE", { timeZone: "Etc/GMT+5" })}`;
  r3c.font = { size: 8, italic: true, color: { argb: "FF888888" }, name: "Calibri" };
  r3c.alignment = { horizontal: "center", vertical: "middle" };

  // ── Row 4: Separador ──────────────────────────────────────────────────────
  ws.getRow(4).height = 5;
  ws.mergeCells("A4:O4");
  ws.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_A } };

  // ── Row 5: Encabezados de columna ─────────────────────────────────────────
  ws.getRow(5).height = 22;
  COLS.forEach((col, i) => {
    const cell = ws.getRow(5).getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 9.5, color: { argb: WHITE }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_A } };
    cell.alignment = { horizontal: i <= 2 ? "left" : "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: GOLD_A } },
    };
  });

  // ── Datos ─────────────────────────────────────────────────────────────────
  rows.forEach((r, i) => {
    const rn = 6 + i;
    ws.getRow(rn).height = 16;
    const isEven = i % 2 === 0;
    const baseBg = r.resuelto
      ? (isEven ? "FFD1FAE5" : "FFE6FAF1")
      : (isEven ? "FFFFFFFF" : "FFF8F9FB");

    const vals = [
      i + 1,
      r.codigoEstudiante,
      r.apellidosNombres ?? "—",
      r.dni ?? "—",
      r.tipoCambio,
      r.campoModificado ?? "—",
      r.valorAnterior ?? "—",
      r.valorNuevo ?? "—",
      r.matriculadoPor ?? "—",
      r.observaciones ?? "—",
      r.registradoPor ?? "—",
      fmtDate(r.registradoEn),
      r.resuelto ? "RESUELTO" : "PENDIENTE",
      r.resueltaEn ? fmtDate(r.resueltaEn) : "—",
      r.resueltaPor ?? "—",
    ];

    vals.forEach((v, ci) => {
      const cell = ws.getRow(rn).getCell(ci + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { size: 9, name: "Calibri", color: { argb: r.resuelto ? "FF065F46" : "FF111827" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseBg } };
      cell.alignment = { horizontal: ci <= 2 ? "left" : "center", vertical: "middle" };

      // Estado column highlight
      if (ci === 12) {
        cell.font = { bold: true, size: 9, name: "Calibri", color: { argb: r.resuelto ? "FF065F46" : "FF991B1B" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: r.resuelto ? "FFD1FAE5" : "FFFEE2E2" } };
      }
    });
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const lastRow = ws.rowCount + 2;
  ws.mergeCells(`A${lastRow}:O${lastRow}`);
  const foot = ws.getCell(`A${lastRow}`);
  foot.value = "Universidad Autónoma de Ica · Portal Académico 2026-I · Documento generado automáticamente";
  foot.font = { size: 8, italic: true, color: { argb: "FF9CA3AF" }, name: "Calibri" };
  foot.alignment = { horizontal: "center" };
  foot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

  // Freeze pane after headers
  ws.views = [{ state: "frozen", ySplit: 5, xSplit: 0 }];

  // Autofilter on header row
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: COLS.length } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mapeo-estudiantes-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function MapeoEstudiantes() {
  useLogPageEntry("Mapeo de Estudiantes");
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows]         = useState<MapeoCambio[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [open, setOpen]         = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [search, setSearch]     = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "pendientes" | "resueltos">("todos");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
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

  useEffect(() => {
    const code = form.codigoEstudiante.trim().toUpperCase();
    if (code.length < 5) return;
    if (lookupRef.current) clearTimeout(lookupRef.current);
    lookupRef.current = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const r = await fetch(`${apiBase}/api/students/lookup-codes`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigos: [code] }),
        });
        if (!r.ok) return;
        const data = await r.json();
        const found: IngresanteSnap[] = data.found ?? [];
        if (found.length > 0) {
          const s = found[0];
          setForm(f => ({
            ...f,
            apellidosNombres: f.apellidosNombres || s.apellidos_nombres,
            dni: f.dni || s.dni,
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
      toast({ title: "El código de estudiante es requerido", variant: "destructive" }); return;
    }
    if (!form.tipoCambio.trim()) {
      toast({ title: "El tipo de cambio es requerido", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${apiBase}/api/students/mapeo-cambios`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Cambio registrado correctamente" });
      setOpen(false); setForm({ ...EMPTY_FORM });
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
        method: "DELETE", credentials: "include",
      });
      if (!r.ok) throw new Error();
      setRows(prev => prev.filter(x => x.id !== id));
      toast({ title: "Registro eliminado" });
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  }

  async function toggleResuelto(id: number, current: boolean) {
    setToggling(id);
    try {
      const r = await fetch(`${apiBase}/api/students/mapeo-cambios/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resuelto: !current }),
      });
      if (!r.ok) throw new Error();
      const updated: MapeoCambio = await r.json();
      setRows(prev => prev.map(x => x.id === id ? updated : x));
      toast({ title: current ? "Marcado como pendiente" : "Marcado como resuelto" });
    } catch {
      toast({ title: "Error al actualizar", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  }

  const filtered = useMemo(() => {
    let result = rows;
    if (filtroEstado === "pendientes") result = result.filter(r => !r.resuelto);
    if (filtroEstado === "resueltos")  result = result.filter(r => r.resuelto);
    const q = search.trim().toLowerCase();
    if (q) result = result.filter(r =>
      r.codigoEstudiante.toLowerCase().includes(q) ||
      (r.apellidosNombres ?? "").toLowerCase().includes(q) ||
      (r.dni ?? "").includes(q) ||
      r.tipoCambio.toLowerCase().includes(q) ||
      (r.matriculadoPor ?? "").toLowerCase().includes(q)
    );
    return result;
  }, [rows, search, filtroEstado]);

  const pendientes = rows.filter(r => !r.resuelto).length;
  const resueltos  = rows.filter(r => r.resuelto).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Mapeo de Estudiantes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro de cambios realizados a estudiantes — 2026-I
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button size="sm" variant="outline" disabled={rows.length === 0 || exporting}
            onClick={async () => {
              setExporting(true);
              try { await exportarExcel(rows); }
              catch { toast({ title: "Error al exportar", variant: "destructive" }); }
              finally { setExporting(false); }
            }}>
            <Download className={`w-4 h-4 mr-1.5 ${exporting ? "animate-spin" : ""}`} />
            {exporting ? "Exportando…" : "Exportar Excel"}
          </Button>

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
                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>Código de estudiante <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input placeholder="Ej: A261003746" value={form.codigoEstudiante}
                      onChange={e => field("codigoEstudiante", e.target.value)} className="uppercase" />
                    {lookupLoading && <RefreshCw className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Se autocompleta el nombre al ingresar el código</p>
                </div>

                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>DNI</Label>
                  <Input placeholder="00000000" value={form.dni} onChange={e => field("dni", e.target.value)} />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label>Apellidos y Nombres</Label>
                  <Input placeholder="Apellidos y nombres del estudiante"
                    value={form.apellidosNombres} onChange={e => field("apellidosNombres", e.target.value)} />
                </div>

                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>Tipo de cambio <span className="text-red-500">*</span></Label>
                  <Select value={form.tipoCambio} onValueChange={v => field("tipoCambio", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_CAMBIO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>Campo modificado</Label>
                  <Input placeholder="Ej: Local / Sede" value={form.campoModificado}
                    onChange={e => field("campoModificado", e.target.value)} />
                </div>

                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>Valor anterior</Label>
                  <Input placeholder="Ej: ICA" value={form.valorAnterior}
                    onChange={e => field("valorAnterior", e.target.value)} />
                </div>

                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <Label>Valor nuevo</Label>
                  <Input placeholder="Ej: CHINCHA" value={form.valorNuevo}
                    onChange={e => field("valorNuevo", e.target.value)} />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label>Matriculado por</Label>
                  <Input placeholder="Nombre del personal que realizó la matrícula"
                    value={form.matriculadoPor} onChange={e => field("matriculadoPor", e.target.value)} />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label>Observaciones</Label>
                  <Textarea placeholder="Detalles adicionales del cambio realizado..."
                    value={form.observaciones} onChange={e => field("observaciones", e.target.value)} rows={3} />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                <Button variant="outline" onClick={() => { setOpen(false); setForm({ ...EMPTY_FORM }); }}>
                  <X className="w-4 h-4 mr-1.5" /> Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving} style={{ background: NAVY, color: "#fff" }}>
                  {saving ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Guardar cambio
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full p-3" style={{ background: NAVY + "15" }}>
              <ClipboardEdit className="w-5 h-5" style={{ color: NAVY }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: NAVY }}>{rows.length}</p>
              <p className="text-sm text-muted-foreground">Total registrados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-amber-200 bg-amber-50/30">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full p-3 bg-amber-100">
              <Circle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{pendientes}</p>
              <p className="text-sm text-muted-foreground">Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-emerald-200 bg-emerald-50/30">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full p-3 bg-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{resueltos}</p>
              <p className="text-sm text-muted-foreground">Resueltos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b bg-gray-50/50">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Filtros estado */}
            <div className="flex gap-1">
              {[
                { key: "todos",      label: `Todos (${rows.length})` },
                { key: "pendientes", label: `Pendientes (${pendientes})` },
                { key: "resueltos",  label: `Resueltos (${resueltos})` },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setFiltroEstado(key as typeof filtroEstado)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${filtroEstado === key ? "text-white border-transparent" : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"}`}
                  style={filtroEstado === key ? { background: NAVY } : {}}>
                  {label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por código, nombre, DNI…"
                value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
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
            <RefreshCw className="w-5 h-5 animate-spin" /> Cargando registros...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <ClipboardEdit className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              {rows.length === 0
                ? "Aún no hay cambios registrados."
                : "No se encontraron registros con ese criterio."}
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
                  <th className="px-4 py-3 text-left font-semibold">Detalle</th>
                  <th className="px-4 py-3 text-left font-semibold">Matriculado por</th>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id}
                    className={`border-b border-gray-100 transition-colors ${r.resuelto ? "bg-emerald-50/50 hover:bg-emerald-50" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: NAVY }}>
                      {r.codigoEstudiante}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className={`font-medium text-xs truncate ${r.resuelto ? "line-through text-emerald-700" : ""}`}
                        title={r.apellidosNombres ?? ""}>{r.apellidosNombres ?? "—"}</p>
                      {r.dni && <p className="text-[11px] text-muted-foreground font-mono">{r.dni}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[11px] px-2 py-0.5 border ${TIPO_COLORS[r.tipoCambio] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {r.tipoCambio}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px]">
                      {r.campoModificado && (
                        <p className="text-muted-foreground mb-0.5">
                          Campo: <span className="font-medium text-foreground">{r.campoModificado}</span>
                        </p>
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
                        <p className="text-muted-foreground mt-0.5 italic truncate" title={r.observaciones}>
                          {r.observaciones}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{r.matriculadoPor ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(r.registradoEn)}
                    </td>
                    {/* Estado */}
                    <td className="px-4 py-3 text-center">
                      {r.resuelto ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Resuelto
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          <Circle className="w-2.5 h-2.5" /> Pendiente
                        </span>
                      )}
                      {r.resuelto && r.resueltaEn && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">{fmtDate(r.resueltaEn)}</p>
                      )}
                    </td>
                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm"
                          className={`h-7 w-7 p-0 transition-colors ${r.resuelto ? "text-emerald-500 hover:text-amber-600 hover:bg-amber-50" : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"}`}
                          title={r.resuelto ? "Marcar como pendiente" : "Marcar como resuelto"}
                          onClick={() => toggleResuelto(r.id, r.resuelto)}
                          disabled={toggling === r.id}>
                          {toggling === r.id
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : r.resuelto
                              ? <RotateCcw className="w-3.5 h-3.5" />
                              : <CheckCircle2 className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(r.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
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
