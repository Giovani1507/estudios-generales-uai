import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  ShieldCheck, Loader2, Search, CheckCircle2, RefreshCcw, Trash2, Filter,
  QrCode, Printer, Download as DownloadIcon, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

type Justificacion = {
  id: number;
  apellidoNombre: string;
  curso: string;
  ciclo: string;
  docente: string;
  dia: string;
  descripcion: string | null;
  justificado: boolean;
  justificadoAt: string | null;
  justificadoPor: string | null;
  createdByUsername: string | null;
  createdAt: string;
};

type Filtro = "TODOS" | "PENDIENTE" | "JUSTIFICADO";

export default function SoporteJustificacion() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<Justificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("TODOS");

  const [showQR, setShowQR] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const manualUrl = `${window.location.origin}${import.meta.env.BASE_URL || ""}manual-justificacion`.replace(/([^:]\/)\/+/g, "$1");

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "qr-manual-justificacion.png";
    a.click();
  };

  const printQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const qrDataUrl = canvas.toDataURL("image/png");
    const logoUrl = `${window.location.origin}${import.meta.env.BASE_URL || ""}logo.png`.replace(/([^:]\/)\/+/g, "$1");
    const w = window.open("", "_blank", "width=820,height=1100");
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" /><title>QR · Manual de Justificación · UAI</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; color: #001f5f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .card { max-width: 640px; margin: 0 auto; border: 3px solid #001f5f; border-radius: 18px; padding: 32px 28px; text-align: center; background: #fff; }
  .top { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 4px; }
  .top img { height: 70px; }
  .top .titles { text-align: left; }
  .top .titles h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; line-height: 1.1; }
  .top .titles p  { margin: 0; font-size: 12px; color: #475569; font-weight: 600; }
  .divider { height: 4px; background: linear-gradient(90deg,#001f5f,#2563eb); margin: 18px 0 22px; border-radius: 2px; }
  .heading { font-size: 26px; font-weight: 800; margin: 0 0 6px; }
  .sub { font-size: 14px; color: #334155; margin: 0 0 22px; }
  .qr-wrap { display: inline-block; padding: 14px; background: #fff; border: 2px solid #e2e8f0; border-radius: 14px; }
  .qr-wrap img { display: block; width: 320px; height: 320px; }
  .steps { margin-top: 22px; text-align: left; background: #f1f5f9; border-radius: 12px; padding: 14px 18px; font-size: 13px; color: #1e293b; line-height: 1.55; }
  .steps b { color: #001f5f; }
  .url { margin-top: 18px; font-size: 11px; color: #64748b; word-break: break-all; }
  .footer { margin-top: 22px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { .noprint { display: none; } }
  .actions { text-align: center; margin-top: 18px; }
  .actions button { background: #001f5f; color: #fff; border: 0; padding: 10px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 4px; }
  .actions button.alt { background: #475569; }
</style></head><body>
  <div class="card">
    <div class="top">
      <img src="${logoUrl}" alt="UAI" onerror="this.style.display='none'" />
      <div class="titles">
        <h1>UNIVERSIDAD AUTÓNOMA DE ICA</h1>
        <p>Estudios Generales · Portal Académico</p>
      </div>
    </div>
    <div class="divider"></div>
    <h2 class="heading">Manual de Justificación</h2>
    <p class="sub">Escanea el código QR con tu celular para abrir el manual paso a paso.</p>
    <div class="qr-wrap"><img src="${qrDataUrl}" alt="QR" /></div>
    <div class="steps">
      <b>¿Cómo enviar tu justificación?</b><br/>
      1. Ingresa al campus virtual con tu código y DNI.<br/>
      2. Ve a <b>Intranet → Información Académica → Inasistencias</b>.<br/>
      3. Selecciona el curso, llena el formulario y adjunta tu evidencia.<br/>
      4. Avisa al docente del curso que enviaste la solicitud.
    </div>
    <div class="url">${manualUrl}</div>
    <div class="footer">Universidad Autónoma de Ica · Portal Académico © ${new Date().getFullYear()}</div>
  </div>
  <div class="actions noprint">
    <button onclick="window.print()">Imprimir</button>
    <button class="alt" onclick="window.close()">Cerrar</button>
  </div>
  <script>
    const img = document.querySelector('.qr-wrap img');
    const logo = document.querySelector('.top img');
    Promise.all([img, logo].map(el => { if (!el || el.complete) return Promise.resolve(); return new Promise(r => { el.onload = r; el.onerror = r; }); })).then(() => setTimeout(() => window.print(), 300));
  <\/script>
</body></html>`);
    w.document.close();
  };

  const fetchAll = async () => {
    try {
      const r = await fetch(`${apiBase}/api/justificaciones`, { credentials: "include" });
      if (!r.ok) throw new Error("err");
      setItems(await r.json());
    } catch {
      toast({ title: "Error", description: "No se pudo cargar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    fetch(`${apiBase}/api/activity/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ type: "ingreso_apartado", detail: "Soporte Justificación" }),
    }).catch(() => {});
    const interval = setInterval(fetchAll, 8000);
    return () => clearInterval(interval);
  }, []);

  const toggleJustificado = async (j: Justificacion) => {
    const nuevo = !j.justificado;
    setItems(prev => prev.map(x => x.id === j.id ? { ...x, justificado: nuevo } : x));
    try {
      const r = await fetch(`${apiBase}/api/justificaciones/${j.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ justificado: nuevo }),
      });
      if (!r.ok) throw new Error();
      const updated = await r.json();
      setItems(prev => prev.map(x => x.id === j.id ? updated : x));
      toast({
        title: nuevo ? "Justificado" : "Desmarcado",
        description: `${j.apellidoNombre} ${nuevo ? "marcado como justificado" : "vuelto a pendiente"}.`,
      });
    } catch {
      // revertir
      setItems(prev => prev.map(x => x.id === j.id ? { ...x, justificado: !nuevo } : x));
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    }
  };

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      const r = await fetch(`${apiBase}/api/justificaciones/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!r.ok) throw new Error();
      setItems(prev => prev.filter(x => x.id !== id));
      toast({ title: "Eliminado" });
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    let res = items;
    if (filtro === "PENDIENTE") res = res.filter(x => !x.justificado);
    else if (filtro === "JUSTIFICADO") res = res.filter(x => x.justificado);
    const q = search.toLowerCase().trim();
    if (q) {
      res = res.filter(x =>
        x.apellidoNombre.toLowerCase().includes(q) ||
        x.curso.toLowerCase().includes(q) ||
        x.docente.toLowerCase().includes(q) ||
        (x.descripcion || "").toLowerCase().includes(q)
      );
    }
    return res;
  }, [items, search, filtro]);

  const stats = useMemo(() => ({
    total: items.length,
    justificados: items.filter(x => x.justificado).length,
    pendientes: items.filter(x => !x.justificado).length,
  }), [items]);

  const puedeEliminar = user?.role === "administrador" || user?.role === "coordinador";

  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#001f5f]">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            Soporte Justificación
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lista de estudiantes derivados desde <b>Justificación de Falta</b>. Marca con check cuando ya se justificó.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowQR(v => !v)} className="gap-2">
            <QrCode className="h-4 w-4" /> {showQR ? "Ocultar QR" : "QR del Manual"}
          </Button>
          <Button variant="outline" onClick={fetchAll} className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Actualizar
          </Button>
        </div>
      </div>

      {showQR && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div ref={qrRef} className="bg-white p-3 border border-slate-200 rounded-xl">
              <QRCodeCanvas value={manualUrl} size={220} includeMargin level="H" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-[#001f5f] mb-1 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> Manual de Justificación · Código QR
              </h3>
              <p className="text-sm text-slate-600 mb-2">
                Comparte o imprime este QR para que los estudiantes accedan al manual paso a paso, sin necesidad de iniciar sesión.
              </p>
              <p className="text-xs text-slate-500 break-all bg-slate-50 border border-slate-200 rounded p-2 mb-3">
                {manualUrl}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={printQR} className="gap-2 bg-[#001f5f] hover:bg-[#003a8c] text-white">
                  <Printer className="h-4 w-4" /> Imprimir QR
                </Button>
                <Button variant="outline" onClick={downloadQR} className="gap-2">
                  <DownloadIcon className="h-4 w-4" /> Descargar PNG
                </Button>
                <a
                  href={manualUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" /> Abrir manual
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <Badge className="bg-[#001f5f] text-white border-0">Total: {stats.total}</Badge>
        <Badge className="bg-amber-500 text-white border-0">Pendientes: {stats.pendientes}</Badge>
        <Badge className="bg-emerald-600 text-white border-0">Justificados: {stats.justificados}</Badge>

        <div className="ml-2 inline-flex rounded-md border border-slate-200 overflow-hidden bg-white">
          {(["TODOS", "PENDIENTE", "JUSTIFICADO"] as Filtro[]).map(f => (
            <button key={f} type="button" onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 text-xs font-semibold ${filtro === f
                ? (f === "JUSTIFICADO" ? "bg-emerald-600 text-white" : f === "PENDIENTE" ? "bg-amber-500 text-white" : "bg-[#001f5f] text-white")
                : "text-slate-600 hover:bg-slate-50"}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar estudiante, curso, docente…" className="pl-8 h-9" />
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="max-h-[640px] overflow-auto">
          {loading ? (
            <div className="p-8 flex justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Filter className="h-8 w-8 opacity-30 mx-auto mb-2" />
              No hay registros con estos filtros.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 sticky top-0">
                <tr>
                  <th className="px-2 py-2 w-12 text-center">✓</th>
                  <th className="px-2 py-2 text-left">Estudiante</th>
                  <th className="px-2 py-2 text-left">Curso · Ciclo</th>
                  <th className="px-2 py-2 text-left">Docente · Día</th>
                  <th className="px-2 py-2 text-left">Descripción</th>
                  <th className="px-2 py-2 text-left">Registrado</th>
                  <th className="px-2 py-2 text-left">Justificado</th>
                  {puedeEliminar && <th className="px-2 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map(j => (
                  <tr key={j.id} className={j.justificado ? "bg-emerald-50/60" : "hover:bg-slate-50/50"}>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => toggleJustificado(j)}
                        title={j.justificado ? "Desmarcar" : "Marcar como justificado"}
                        className={`h-6 w-6 rounded border-2 flex items-center justify-center transition-colors ${
                          j.justificado
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-white border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-300"
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className={`font-bold ${j.justificado ? "text-emerald-800 line-through decoration-emerald-400/60" : "text-[#001f5f]"}`}>
                        {j.apellidoNombre}
                      </div>
                      <div className="text-[10px] text-muted-foreground">por {j.createdByUsername || "—"}</div>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div>{j.curso}</div>
                      <div className="text-[10px] text-muted-foreground">Ciclo {j.ciclo}</div>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="text-[11px]">{j.docente}</div>
                      <div className="text-[10px] text-muted-foreground">{j.dia}</div>
                    </td>
                    <td className="px-2 py-2 align-top text-[11px] max-w-[260px]">
                      {j.descripcion || <span className="text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-2 py-2 align-top text-[10px] text-muted-foreground">{fmt(j.createdAt)}</td>
                    <td className="px-2 py-2 align-top text-[10px]">
                      {j.justificado ? (
                        <div>
                          <div className="font-semibold text-emerald-700">{fmt(j.justificadoAt)}</div>
                          <div className="text-muted-foreground">por {j.justificadoPor || "—"}</div>
                        </div>
                      ) : <span className="text-amber-700 font-semibold">PENDIENTE</span>}
                    </td>
                    {puedeEliminar && (
                      <td className="px-2 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => eliminar(j.id)} className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
