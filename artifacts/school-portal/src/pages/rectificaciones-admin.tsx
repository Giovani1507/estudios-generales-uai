import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ClipboardList, Download, RefreshCw, Search, X, Trash2,
  Eye, CheckCircle2, Users, User, QrCode, Link2, Copy, Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";
const GOLD = "#C9A84C";

type Rectificacion = {
  id: number;
  apellidosNombres: string;
  celular: string;
  atendidoPor: string;
  fotoPago: string | null;
  observaciones: string | null;
  registradoEn: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "Etc/GMT+5",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const REGISTRO_URL = `${window.location.origin}${(import.meta.env.BASE_URL || "").replace(/\/$/, "")}/registro-rectificacion`;

export default function RectificacionesAdmin() {
  const { toast } = useToast();
  const [data, setData]       = useState<Rectificacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState("");
  const [filterAt, setFilterAt] = useState<string>("Todos");
  const [fotoModal, setFotoModal] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<number | null>(null);
  const [copied, setCopied]       = useState(false);
  const qrRef = useRef<SVGSVGElement>(null);

  function copyLink() {
    navigator.clipboard.writeText(REGISTRO_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadQR() {
    const svg = qrRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const canvas = document.createElement("canvas");
    const img = new Image();
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      canvas.width = 600; canvas.height = 600;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 600, 600);
      ctx.drawImage(img, 0, 0, 600, 600);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = "qr-rectificacion-matricula.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/rectificaciones`, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      setData(await r.json());
    } catch (err) {
      toast({ title: "Error al cargar registros", description: String(err), variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este registro?")) return;
    setDeleting(id);
    try {
      const r = await fetch(`${apiBase}/api/rectificaciones/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      setData(prev => prev.filter(x => x.id !== id));
      toast({ title: "Registro eliminado" });
    } catch (err) {
      toast({ title: "Error al eliminar", description: String(err), variant: "destructive" });
    } finally { setDeleting(null); }
  }

  const atendidos = [...new Set(data.map(r => r.atendidoPor))].sort();

  const filtered = data.filter(r => {
    if (filterAt !== "Todos" && r.atendidoPor !== filterAt) return false;
    const q = search.trim().toUpperCase();
    return !q || r.apellidosNombres.toUpperCase().includes(q) || r.celular.includes(q) || r.atendidoPor.toUpperCase().includes(q);
  });

  const stats = {
    total: data.length,
    conFoto: data.filter(r => r.fotoPago).length,
    giovanni: data.filter(r => r.atendidoPor === "GIOVANNI").length,
    valery:   data.filter(r => r.atendidoPor === "VALERY").length,
  };

  function exportXlsx() {
    const hdr = ["#", "Apellidos y Nombres", "Celular", "Atendido Por", "Tiene Foto", "Fecha y Hora"];
    const rows = filtered.map((r, i) => [
      i + 1, r.apellidosNombres, r.celular, r.atendidoPor,
      r.fotoPago ? "SÍ" : "NO", formatDate(r.registradoEn),
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
    ws["!cols"] = [{ wch: 4 }, { wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, "Rectificaciones");
    XLSX.writeFile(wb, `rectificaciones-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-5 p-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}>
            <ClipboardList className="w-6 h-6" /> Registros de Rectificaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registros de estudiantes que solicitaron rectificación de matrícula
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button size="sm" onClick={exportXlsx} style={{ background: NAVY, color: "#fff" }}>
            <Download className="w-4 h-4 mr-1.5" /> Exportar Excel
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total registros",  value: stats.total,    color: NAVY,      bg: "bg-blue-50/40",   Icon: Users },
          { label: "Giovanni",         value: stats.giovanni, color: "#7c3aed", bg: "bg-purple-50",    Icon: User },
          { label: "Valery",           value: stats.valery,   color: "#0891b2", bg: "bg-cyan-50",      Icon: User },
          { label: "Con foto de pago", value: stats.conFoto,  color: "#16a34a", bg: "bg-green-50",     Icon: CheckCircle2 },
        ].map(({ label, value, color, bg, Icon }) => (
          <Card key={label} className="rounded-xl shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-full p-2.5 ${bg}`}><Icon className="w-5 h-5" style={{ color }} /></div>
              <div>
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {["Todos", ...atendidos].map(op => (
            <button key={op} onClick={() => setFilterAt(op)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filterAt === op ? "text-white border-transparent" : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
              }`}
              style={filterAt === op ? { background: NAVY } : {}}
            >
              {op} {op !== "Todos" && <span className="opacity-70">({data.filter(r => r.atendidoPor === op).length})</span>}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar nombre, celular…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm" />
          {search && <button className="absolute right-2 top-2" onClick={() => setSearch("")}><X className="w-4 h-4 text-gray-400" /></button>}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
      </div>

      {/* Table */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        {loading && data.length === 0 ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" /> Cargando registros...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: NAVY }} className="text-white text-left">
                  {["#", "Apellidos y Nombres", "Celular", "Atendido por", "Foto de Pago", "Fecha y Hora", ""].map((h, i) => (
                    <th key={i} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Sin registros</td></tr>
                ) : filtered.map((r, i) => (
                  <tr key={r.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-gray-50/40" : "bg-white"} hover:bg-blue-50/20`}>
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold max-w-[220px]" style={{ color: NAVY }} title={r.apellidosNombres}>
                      {r.apellidosNombres}
                    </td>
                    <td className="px-4 py-3 font-mono">{r.celular}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] px-2 font-bold ${
                        r.atendidoPor === "GIOVANNI" ? "bg-purple-100 text-purple-700 border border-purple-200"
                        : r.atendidoPor === "VALERY" ? "bg-cyan-100 text-cyan-700 border border-cyan-200"
                        : "bg-gray-100 text-gray-600"
                      }`}>
                        <User className="w-2.5 h-2.5 mr-0.5 inline" /> {r.atendidoPor}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.fotoPago ? (
                        <button
                          onClick={() => setFotoModal(r.fotoPago!)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 text-green-700 text-[10px] font-semibold hover:bg-green-200 transition-colors"
                        >
                          <Eye className="w-3 h-3" /> Ver foto
                        </button>
                      ) : (
                        <span className="text-gray-300 text-[10px]">Sin foto</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(r.registradoEn)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deleting === r.id}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                      >
                        {deleting === r.id
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Photo modal */}
      {fotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setFotoModal(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setFotoModal(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white flex items-center gap-1.5 text-sm"
            >
              <X className="w-5 h-5" /> Cerrar
            </button>
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ background: NAVY }}>
                <Eye className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-semibold">Comprobante de Pago</span>
              </div>
              <img src={fotoModal} alt="Comprobante" className="w-full max-h-[70vh] object-contain bg-gray-50" />
            </div>
          </div>
        </div>
      )}

      {/* QR Card */}
      <Card className="rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ background: NAVY }}>
          <QrCode className="w-5 h-5 text-white" />
          <span className="text-white font-bold text-sm">QR y Enlace — Registro de Rectificación de Matrícula</span>
        </div>
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row items-center gap-6">

            {/* QR code */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <div className="p-3 bg-white rounded-2xl border-2 shadow-md" style={{ borderColor: GOLD + "50" }}>
                <QRCodeSVG
                  ref={qrRef as any}
                  value={REGISTRO_URL}
                  size={180}
                  fgColor={NAVY}
                  bgColor="#FFFFFF"
                  level="H"
                  includeMargin={false}
                />
              </div>
              <button
                onClick={downloadQR}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors"
                style={{ borderColor: NAVY + "40", color: NAVY }}
              >
                <Download className="w-3.5 h-3.5" /> Descargar QR
              </button>
            </div>

            {/* Link + info */}
            <div className="flex-1 w-full space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: NAVY }}>
                  Enlace directo para compartir
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 min-w-0">
                    <Link2 className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-xs font-mono text-gray-700 truncate">{REGISTRO_URL}</span>
                  </div>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-1.5 shrink-0 px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: copied ? "#16a34a" : NAVY,
                      color: "#fff",
                    }}
                  >
                    {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50/60 rounded-xl p-3.5 space-y-1.5">
                <p className="text-xs font-semibold" style={{ color: NAVY }}>¿Cómo funciona?</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li className="flex items-start gap-1.5"><span style={{ color: GOLD }}>▸</span> El estudiante escanea el QR con su celular o abre el enlace.</li>
                  <li className="flex items-start gap-1.5"><span style={{ color: GOLD }}>▸</span> Llena su nombre, celular, quien lo atendió y adjunta foto del pago.</li>
                  <li className="flex items-start gap-1.5"><span style={{ color: GOLD }}>▸</span> El registro aparece aquí automáticamente en tiempo real.</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
