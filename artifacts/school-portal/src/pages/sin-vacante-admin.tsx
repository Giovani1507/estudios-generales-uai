import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle, Plus, Trash2, Download, RefreshCw, Search, BarChart3, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import * as ExcelJS from "exceljs";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";
const GOLD = "#C9A84C";

const CARRERAS = [
  "ADMINISTRACIÓN DE EMPRESAS",
  "ADMINISTRACIÓN Y FINANZAS",
  "ARQUITECTURA",
  "CONTABILIDAD",
  "DERECHO",
  "ENFERMERÍA",
  "ESTOMATOLOGÍA",
  "FARMACIA Y BIOQUÍMICA",
  "INGENIERÍA CIVIL",
  "INGENIERÍA DE SISTEMAS",
  "INGENIERÍA INDUSTRIAL",
  "MEDICINA HUMANA",
  "OBSTETRICIA",
  "OPTOMETRÍA",
  "TERAPIA DEL LENGUAJE",
  "TERAPIA FÍSICA Y REHABILITACIÓN",
];

const TURNOS  = ["Mañana", "Tarde", "Noche"];
const LUGARES = ["Sede Ica", "Filial", "Huaura"];

type SinVacante = {
  id: number;
  codigo: string | null;
  apellidosNombres: string | null;
  carrera: string | null;
  turno: string | null;
  seccion: string | null;
  lugar: string | null;
  registradoEn: string;
  registradoPor: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "Etc/GMT+5",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function exportarExcel(rows: SinVacante[]) {
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet("Sin Vacante");
  const NAVY_A = "FF001F5F";
  const GOLD_A = "FFC9A84C";
  const WHITE  = "FFFFFFFF";

  ws.columns = [
    { width: 5 }, { width: 14 }, { width: 36 }, { width: 28 },
    { width: 10 }, { width: 10 }, { width: 14 }, { width: 18 },
  ];

  const sf  = (a: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: a } });
  const CTR = { horizontal: "center" as const, vertical: "middle" as const };
  const MID = { horizontal: "left"   as const, vertical: "middle" as const };
  const THIN: Partial<ExcelJS.Borders> = {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };

  ws.getRow(1).height = 28;
  ws.mergeCells("A1:H1");
  const title = ws.getCell("A1");
  title.value = "UNIVERSIDAD AUTÓNOMA DE ICA — ESTUDIANTES SIN VACANTE 2026-I";
  title.font  = { bold: true, size: 13, color: { argb: WHITE } };
  title.fill  = sf(NAVY_A); title.alignment = CTR; title.border = THIN;

  ws.getRow(2).height = 6;

  const headers = ["N°", "Código", "Apellidos y Nombres", "Carrera", "Turno", "Sección", "Lugar", "Registrado"];
  ws.getRow(3).height = 20;
  headers.forEach((h, i) => {
    const c = ws.getRow(3).getCell(i + 1);
    c.value = h; c.font = { bold: true, size: 10, color: { argb: WHITE } };
    c.fill  = sf(GOLD_A); c.alignment = CTR; c.border = THIN;
  });

  rows.forEach((r, i) => {
    const row = ws.getRow(4 + i); row.height = 17;
    const vals = [
      i + 1, r.codigo || "—", r.apellidosNombres || "—", r.carrera || "—",
      r.turno || "—", r.seccion || "—", r.lugar || "—", fmtDate(r.registradoEn),
    ];
    vals.forEach((v, ci) => {
      const c = row.getCell(ci + 1);
      c.value = v; c.font = { size: 9 };
      c.fill  = sf(i % 2 === 0 ? "FFE9EEF8" : WHITE);
      c.alignment = ci === 0 ? CTR : MID; c.border = THIN;
    });
  });

  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `Sin_Vacante_UAI_2026-1.xlsx`; a.click();
  URL.revokeObjectURL(a.href);
}

export default function SinVacanteAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rows,    setRows]    = useState<SinVacante[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [search,  setSearch]  = useState("");
  const [tab,     setTab]     = useState<"registro" | "resumen">("registro");

  const [form, setForm] = useState({
    codigo: "", apellidosNombres: "", carrera: "",
    turno: "", seccion: "", lugar: "",
  });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/sin-vacante`, { credentials: "include" });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Error", description: "No se pudo cargar la lista", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleSave = async () => {
    if (!form.codigo.trim() && !form.apellidosNombres.trim()) {
      toast({ title: "Dato requerido", description: "Ingresa al menos el código o el nombre del estudiante", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/sin-vacante`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, registradoPor: user?.username || "admin" }),
      });
      if (!res.ok) throw new Error();
      const nuevo = await res.json();
      setRows(prev => [nuevo, ...prev]);
      setForm({ codigo: "", apellidosNombres: "", carrera: "", turno: "", seccion: "", lugar: "" });
      toast({ title: "Registrado", description: "Estudiante guardado correctamente." });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      await fetch(`${apiBase}/api/sin-vacante/${id}`, { method: "DELETE", credentials: "include" });
      setRows(prev => prev.filter(r => r.id !== id));
      toast({ title: "Eliminado" });
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.codigo || "").toLowerCase().includes(q) ||
      (r.apellidosNombres || "").toLowerCase().includes(q) ||
      (r.carrera || "").toLowerCase().includes(q) ||
      (r.turno || "").toLowerCase().includes(q) ||
      (r.seccion || "").toLowerCase().includes(q) ||
      (r.lugar || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const resumen = useMemo(() => {
    const byCarrera: Record<string, number> = {};
    const byLugar:   Record<string, number> = {};
    const byTurno:   Record<string, number> = {};
    rows.forEach(r => {
      if (r.carrera) byCarrera[r.carrera] = (byCarrera[r.carrera] || 0) + 1;
      if (r.lugar)   byLugar[r.lugar]     = (byLugar[r.lugar]     || 0) + 1;
      if (r.turno)   byTurno[r.turno]     = (byTurno[r.turno]     || 0) + 1;
    });
    return { byCarrera, byLugar, byTurno, total: rows.length };
  }, [rows]);

  const field = (id: keyof typeof form, label: string, type: "text" | "select", options?: string[]) => (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-slate-600">{label}</Label>
      {type === "select" ? (
        <select
          id={id}
          value={form[id]}
          onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
          className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Seleccionar —</option>
          {options!.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <Input
          id={id}
          value={form[id]}
          onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
          placeholder={label}
          className="h-9 text-sm"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: NAVY }}>
          <AlertTriangle className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: NAVY }}>Sin Vacante</h1>
          <p className="text-xs text-muted-foreground">Registro de estudiantes sin vacante disponible · 2026-I</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchRows} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportarExcel(rows)} disabled={rows.length === 0}>
            <Download className="w-4 h-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {(["registro", "resumen"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "registro" ? "Registro" : "Cuadro Resumen"}
          </button>
        ))}
      </div>

      {tab === "registro" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-1 shadow-sm border-blue-100">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" style={{ color: NAVY }} />
                <span className="font-semibold text-sm" style={{ color: NAVY }}>Nuevo Registro</span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {field("codigo",           "Código de Estudiante",  "text")}
              {field("apellidosNombres", "Apellidos y Nombres",   "text")}
              {field("carrera",          "Carrera Profesional",   "select", CARRERAS)}
              {field("turno",            "Turno",                 "select", TURNOS)}
              {field("seccion",          "Sección",               "text")}
              {field("lugar",            "Lugar",                 "select", LUGARES)}
              <Button
                className="w-full mt-2 text-white"
                style={{ background: NAVY }}
                onClick={handleSave}
                disabled={saving}
              >
                <Plus className="w-4 h-4 mr-1" />
                {saving ? "Guardando..." : "Registrar Estudiante"}
              </Button>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2 shadow-sm">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: NAVY }}>
                  Lista de Registros
                  <span className="ml-2 px-2 py-0.5 rounded-full text-white text-xs" style={{ background: GOLD }}>
                    {rows.length}
                  </span>
                </span>
                <div className="flex items-center gap-1 ml-auto border rounded-md px-2 py-1 bg-white">
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="text-sm outline-none w-36 bg-transparent"
                  />
                  {search && <X className="w-3.5 h-3.5 cursor-pointer text-muted-foreground" onClick={() => setSearch("")} />}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Cargando...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {search ? "Sin resultados" : "No hay registros aún"}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: NAVY }}>
                        {["#", "Código", "Apellidos y Nombres", "Carrera", "Turno", "Sección", "Lugar", "Fecha", ""].map(h => (
                          <th key={h} className="px-3 py-2 text-white font-semibold text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, i) => (
                        <tr key={r.id} className={i % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                          <td className="px-3 py-2 text-center text-slate-400">{i + 1}</td>
                          <td className="px-3 py-2 font-mono font-semibold" style={{ color: NAVY }}>{r.codigo || "—"}</td>
                          <td className="px-3 py-2 font-medium">{r.apellidosNombres || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{r.carrera || "—"}</td>
                          <td className="px-3 py-2 text-center">
                            {r.turno ? (
                              <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-semibold ${
                                r.turno === "Mañana" ? "bg-amber-500" : r.turno === "Tarde" ? "bg-blue-500" : "bg-indigo-700"
                              }`}>{r.turno}</span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2 text-center font-bold">{r.seccion || "—"}</td>
                          <td className="px-3 py-2">
                            {r.lugar ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-200">{r.lugar}</span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtDate(r.registradoEn)}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "resumen" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Total Registrados", value: resumen.total, color: NAVY },
              { label: "Carreras distintas", value: Object.keys(resumen.byCarrera).length, color: "#1d4ed8" },
              { label: "Lugares registrados", value: Object.keys(resumen.byLugar).length, color: "#7c3aed" },
            ].map(s => (
              <Card key={s.label} className="shadow-sm">
                <CardContent className="pt-5 pb-5 text-center">
                  <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ResumeTable
              title="Por Carrera"
              data={resumen.byCarrera}
              total={resumen.total}
              color={NAVY}
            />
            <ResumeTable
              title="Por Lugar"
              data={resumen.byLugar}
              total={resumen.total}
              color="#7c3aed"
            />
            <ResumeTable
              title="Por Turno"
              data={resumen.byTurno}
              total={resumen.total}
              color="#1d4ed8"
            />
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: NAVY }} />
                <span className="font-semibold text-sm" style={{ color: NAVY }}>Detalle Cruzado — Carrera × Lugar × Turno</span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {rows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Sin registros aún</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: NAVY }}>
                        {["Carrera", "Lugar", "Turno", "Sección", "Total"].map(h => (
                          <th key={h} className="px-3 py-2 text-white font-semibold text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {buildCruzado(rows).map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                          <td className="px-3 py-1.5 font-medium">{r.carrera}</td>
                          <td className="px-3 py-1.5">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">{r.lugar}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-semibold ${
                              r.turno === "Mañana" ? "bg-amber-500" : r.turno === "Tarde" ? "bg-blue-500" : r.turno === "Noche" ? "bg-indigo-700" : "bg-slate-400"
                            }`}>{r.turno || "—"}</span>
                          </td>
                          <td className="px-3 py-1.5 text-center font-bold">{r.seccion || "—"}</td>
                          <td className="px-3 py-1.5 text-center font-bold" style={{ color: NAVY }}>{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ResumeTable({ title, data, total, color }: {
  title: string; data: Record<string, number>; total: number; color: string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 pt-4 px-5">
        <span className="font-semibold text-sm" style={{ color }}>{title}</span>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Sin datos</p>
        ) : (
          <div className="space-y-2">
            {entries.map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="font-medium truncate max-w-[180px]" title={k}>{k}</span>
                  <span className="font-bold ml-2" style={{ color }}>{v}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${total ? (v / total) * 100 : 0}%`, background: color }}
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-2 border-t mt-2 font-bold">
              <span>Total</span>
              <span style={{ color }}>{total}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function buildCruzado(rows: SinVacante[]) {
  const map = new Map<string, number>();
  const meta = new Map<string, { carrera: string; lugar: string; turno: string; seccion: string }>();
  rows.forEach(r => {
    const k = `${r.carrera || "—"}|${r.lugar || "—"}|${r.turno || "—"}|${r.seccion || "—"}`;
    map.set(k, (map.get(k) || 0) + 1);
    if (!meta.has(k)) meta.set(k, {
      carrera: r.carrera || "—",
      lugar:   r.lugar   || "—",
      turno:   r.turno   || "—",
      seccion: r.seccion || "—",
    });
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, total]) => ({ ...meta.get(k)!, total }));
}
