import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserX, Plus, Trash2, Download, RefreshCw, Search,
  X, QrCode, Printer, CheckCircle2, Monitor, Smartphone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { QRCodeSVG } from "qrcode.react";
import * as ExcelJS from "exceljs";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";
const GOLD = "#C9A84C";

type EstudianteSinMatricula = {
  id: number;
  apellidosNombres: string;
  dni: string | null;
  codigo: string | null;
  carrera: string | null;
  registradoEn: string;
  registradoPor: string | null;
  registradoVia: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "Etc/GMT+5",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function exportarExcel(rows: EstudianteSinMatricula[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sin Matrícula");

  const NAVY_A = "FF001F5F";
  const GOLD_A = "FFC9A84C";
  const WHITE  = "FFFFFFFF";

  const COLS = [
    { width: 5  },
    { width: 36 },
    { width: 12 },
    { width: 16 },
    { width: 30 },
    { width: 18 },
    { width: 14 },
    { width: 10 },
  ];
  ws.columns = COLS;

  // Row 1 — UAI
  ws.getRow(1).height = 28;
  ws.mergeCells("C1:H1");
  const r1 = ws.getCell("C1");
  r1.value = "UNIVERSIDAD AUTÓNOMA DE ICA";
  r1.font = { bold: true, size: 14, color: { argb: NAVY_A }, name: "Calibri" };
  r1.alignment = { horizontal: "center", vertical: "middle" };

  // Row 2 — Subtítulo
  ws.getRow(2).height = 20;
  ws.mergeCells("C2:H2");
  const r2 = ws.getCell("C2");
  r2.value = "Portal Académico 2026-I — Estudiantes Sin Matrícula";
  r2.font = { bold: true, size: 11, color: { argb: GOLD_A }, name: "Calibri" };
  r2.alignment = { horizontal: "center", vertical: "middle" };

  // Row 3 — Metadatos
  ws.getRow(3).height = 13;
  ws.mergeCells("C3:H3");
  const r3 = ws.getCell("C3");
  r3.value = `Total: ${rows.length} · Admin: ${rows.filter(r => r.registradoVia === "admin").length} · QR: ${rows.filter(r => r.registradoVia === "qr").length} · Generado: ${new Date().toLocaleString("es-PE", { timeZone: "Etc/GMT+5" })}`;
  r3.font = { size: 8, italic: true, color: { argb: "FF888888" }, name: "Calibri" };
  r3.alignment = { horizontal: "center" };

  // Row 4 — Separador
  ws.getRow(4).height = 5;
  ws.mergeCells("A4:H4");
  ws.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_A } };

  // Row 5 — Encabezados
  ws.getRow(5).height = 22;
  const headers = ["N°", "Apellidos y Nombres", "DNI", "Código", "Carrera", "Registrado en", "Registrado por", "Vía"];
  headers.forEach((h, i) => {
    const cell = ws.getRow(5).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9.5, color: { argb: WHITE }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_A } };
    cell.alignment = { horizontal: i <= 1 ? "left" : "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: GOLD_A } } };
  });

  // Datos
  rows.forEach((r, i) => {
    const rn = 6 + i;
    ws.getRow(rn).height = 16;
    const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF8F9FB";
    const vals = [
      i + 1, r.apellidosNombres, r.dni ?? "—", r.codigo ?? "—",
      r.carrera ?? "—", fmtDate(r.registradoEn), r.registradoPor ?? "—",
      r.registradoVia === "qr" ? "QR" : "Admin",
    ];
    vals.forEach((v, ci) => {
      const cell = ws.getRow(rn).getCell(ci + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { size: 9, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { horizontal: ci <= 1 ? "left" : "center", vertical: "middle" };
    });
  });

  // Footer
  const lastRow = ws.rowCount + 2;
  ws.mergeCells(`A${lastRow}:H${lastRow}`);
  const foot = ws.getCell(`A${lastRow}`);
  foot.value = "Universidad Autónoma de Ica · Portal Académico 2026-I";
  foot.font = { size: 8, italic: true, color: { argb: "FF9CA3AF" }, name: "Calibri" };
  foot.alignment = { horizontal: "center" };
  foot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

  ws.views = [{ state: "frozen", ySplit: 5 }];
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: 8 } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sin-matricula-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function SinMatriculaAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<EstudianteSinMatricula[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Form state (admin: solo nombre + código)
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");

  // QR panel
  const [showQr, setShowQr] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // URL pública de autoregistro QR
  const qrUrl = useMemo(() => {
    const origin = window.location.origin;
    const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
    return `${origin}${base}/registro-sin-matricula`;
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/sin-matricula`, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      setRows(await r.json());
    } catch (e) {
      toast({ title: "Error al cargar", description: String(e), variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  async function handleSave() {
    if (!nombre.trim()) { toast({ title: "El nombre es requerido", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`${apiBase}/api/sin-matricula`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apellidosNombres: nombre.trim(),
          codigo: codigo.trim() || null,
          registradoPor: user?.username ?? null,
          registradoVia: "admin",
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `${r.status}`);
      const nuevo = await r.json();
      setRows(p => [nuevo, ...p]);
      setNombre(""); setCodigo(""); setShowForm(false);
      toast({ title: "Estudiante registrado" });
    } catch (e) {
      toast({ title: "Error al guardar", description: String(e), variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este registro?")) return;
    setDeleting(id);
    try {
      await fetch(`${apiBase}/api/sin-matricula/${id}`, { method: "DELETE", credentials: "include" });
      setRows(p => p.filter(x => x.id !== id));
      toast({ title: "Eliminado" });
    } catch { toast({ title: "Error al eliminar", variant: "destructive" }); }
    finally { setDeleting(null); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return q ? rows.filter(r =>
      r.apellidosNombres.toUpperCase().includes(q) ||
      (r.codigo ?? "").toUpperCase().includes(q) ||
      (r.carrera ?? "").toUpperCase().includes(q) ||
      (r.dni ?? "").includes(q)
    ) : rows;
  }, [rows, search]);

  const porQr    = rows.filter(r => r.registradoVia === "qr").length;
  const porAdmin = rows.filter(r => r.registradoVia === "admin").length;

  function printQr() {
    const el = qrRef.current;
    if (!el) return;
    const svgEl = el.querySelector("svg");
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const w = window.open("", "_blank", "width=500,height=680");
    if (!w) return;
    w.document.write(`
      <html><head><title>QR Estudiantes sin Matrícula — UAI</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: Calibri, sans-serif; background: #fff; }
        .header { text-align: center; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: 900; color: #001F5F; }
        .sub { font-size: 13px; color: #C9A84C; font-weight: 700; margin-top: 4px; }
        .desc { font-size: 11px; color: #666; margin-top: 12px; max-width: 300px; text-align: center; line-height: 1.5; }
        .qr-box { border: 3px solid #001F5F; border-radius: 16px; padding: 20px; background: #f8fafc; }
        .url { font-size: 10px; color: #444; margin-top: 14px; font-family: monospace; word-break: break-all; max-width: 320px; text-align: center; }
        .footer { margin-top: 20px; font-size: 9px; color: #aaa; }
      </style></head><body>
      <div class="header">
        <div class="title">UNIVERSIDAD AUTÓNOMA DE ICA</div>
        <div class="sub">Portal Académico 2026-I</div>
      </div>
      <div class="qr-box">${svgData}</div>
      <div class="desc">Escanea este código QR para registrarte como<br><strong>Estudiante sin Matrícula</strong>.<br>Necesitarás: Apellidos y Nombres, DNI y Carrera.</div>
      <div class="url">${qrUrl}</div>
      <div class="footer">Universidad Autónoma de Ica · Matrícula 2026-I</div>
      <script>window.onload = function() { window.print(); }<\/script>
      </body></html>
    `);
    w.document.close();
  }

  return (
    <div className="flex flex-col gap-5 p-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}>
            <UserX className="w-6 h-6" /> Estudiantes sin Matrícula
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro de estudiantes que no completaron su matrícula — 2026-I
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={fetchRows} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowQr(v => !v)}>
            <QrCode className="w-4 h-4 mr-1.5" /> {showQr ? "Ocultar QR" : "Ver QR"}
          </Button>
          <Button size="sm" variant="outline" disabled={rows.length === 0 || exporting}
            onClick={async () => {
              setExporting(true);
              try { await exportarExcel(rows); }
              catch { toast({ title: "Error al exportar", variant: "destructive" }); }
              finally { setExporting(false); }
            }}>
            <Download className={`w-4 h-4 mr-1.5 ${exporting ? "animate-spin" : ""}`} />
            {exporting ? "Exportando…" : "Excel"}
          </Button>
          <Button size="sm" onClick={() => setShowForm(v => !v)} style={{ background: NAVY, color: "#fff" }}>
            <Plus className="w-4 h-4 mr-1.5" /> {showForm ? "Cancelar" : "Agregar Estudiante"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
          <p className="text-2xl font-black text-blue-700">{rows.length}</p>
          <p className="text-xs font-bold text-blue-600/70 uppercase tracking-wide mt-0.5">Total registrados</p>
        </div>
        <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-4">
          <p className="text-2xl font-black text-purple-700">{porAdmin}</p>
          <p className="text-xs font-bold text-purple-600/70 uppercase tracking-wide mt-0.5 flex items-center gap-1"><Monitor className="w-3 h-3" />Registrados por Admin</p>
        </div>
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
          <p className="text-2xl font-black text-amber-700">{porQr}</p>
          <p className="text-xs font-bold text-amber-600/70 uppercase tracking-wide mt-0.5 flex items-center gap-1"><Smartphone className="w-3 h-3" />Registrados por QR</p>
        </div>
      </div>

      {/* Panel QR */}
      {showQr && (
        <Card className="rounded-2xl border-2" style={{ borderColor: NAVY + "30" }}>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex flex-col items-center gap-3">
                <div ref={qrRef} className="p-4 bg-white border-2 rounded-xl" style={{ borderColor: NAVY }}>
                  <QRCodeSVG
                    value={qrUrl}
                    size={180}
                    fgColor={NAVY}
                    bgColor="#ffffff"
                    level="H"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={printQr} className="gap-1.5">
                  <Printer className="w-4 h-4" /> Imprimir QR
                </Button>
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="font-bold text-base" style={{ color: NAVY }}>Código QR de Autoregistro</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Los estudiantes pueden escanear este código QR con su celular para registrarse
                  como <strong>"Estudiante sin Matrícula"</strong> sin necesidad de iniciar sesión.
                </p>
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">El estudiante ingresará:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Apellidos y Nombres</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />DNI</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Carrera</li>
                  </ul>
                </div>
                <div className="bg-gray-50 border rounded-lg px-3 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold mb-0.5">URL del formulario</p>
                  <p className="text-xs font-mono text-gray-600 break-all">{qrUrl}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulario admin (solo nombre + código) */}
      {showForm && (
        <Card className="rounded-2xl border-2" style={{ borderColor: NAVY + "30" }}>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-bold" style={{ color: NAVY }}>Registrar Estudiante Manualmente</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Apellidos y Nombres <span className="text-red-500">*</span></Label>
                <Input placeholder="APELLIDOS NOMBRES (mayúsculas)"
                  value={nombre} onChange={e => setNombre(e.target.value.toUpperCase())} />
              </div>
              <div className="col-span-2 md:col-span-1 space-y-1.5">
                <Label>Código de Estudiante</Label>
                <Input placeholder="Ej: A261003746"
                  value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setNombre(""); setCodigo(""); }}>
                <X className="w-3.5 h-3.5 mr-1" />Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} style={{ background: NAVY, color: "#fff" }}>
                {saving ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b bg-gray-50/50">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar nombre, código, carrera…"
                value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="h-8 text-xs">
                <X className="w-3 h-3 mr-1" />Limpiar
              </Button>
            )}
            <p className="text-xs text-muted-foreground ml-auto">
              {filtered.length} de {rows.length} registros
            </p>
          </div>
        </CardHeader>

        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <UserX className="w-10 h-10 opacity-20" />
            <p className="text-sm">{rows.length === 0 ? "Sin registros aún." : "Sin coincidencias."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: NAVY }} className="text-white text-xs">
                  <th className="px-4 py-3 text-left font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Apellidos y Nombres</th>
                  <th className="px-4 py-3 text-center font-semibold">DNI</th>
                  <th className="px-4 py-3 text-center font-semibold">Código</th>
                  <th className="px-4 py-3 text-left font-semibold">Carrera</th>
                  <th className="px-4 py-3 text-center font-semibold">Vía</th>
                  <th className="px-4 py-3 text-center font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-center font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-xs" style={{ color: NAVY }}>{r.apellidosNombres}</td>
                    <td className="px-4 py-3 text-xs text-center font-mono">{r.dni ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-center font-mono">{r.codigo ?? "—"}</td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate">{r.carrera ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.registradoVia === "qr" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                        {r.registradoVia === "qr" ? <><Smartphone className="w-2.5 h-2.5" />QR</> : <><Monitor className="w-2.5 h-2.5" />Admin</>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-center text-muted-foreground whitespace-nowrap">{fmtDate(r.registradoEn)}</td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(r.id)} disabled={deleting === r.id}>
                        {deleting === r.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
