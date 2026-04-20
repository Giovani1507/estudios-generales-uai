import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Trash2, Download, RefreshCw, Search, QrCode, X, Copy, CheckCircle2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import * as ExcelJS from "exceljs";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";
const GOLD = "#C9A84C";

const QR_URL = (() => {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${window.location.origin}${base}/registro-delegado`;
})();

type Delegado = {
  id: number;
  tipo: string;
  apellidosNombres: string;
  carrera: string;
  ciclo: string;
  seccion: string;
  numero: string | null;
  correo: string | null;
  sede: string | null;
  registradoEn: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "Etc/GMT+5",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function exportarExcel(rows: Delegado[]) {
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet("Delegados");
  const NAVY_A = "FF001F5F";
  const GOLD_A = "FFC9A84C";
  const WHITE  = "FFFFFFFF";

  ws.columns = [
    { width: 4 }, { width: 14 }, { width: 36 }, { width: 30 }, { width: 8 },
    { width: 10 }, { width: 16 }, { width: 15 }, { width: 28 }, { width: 18 },
  ];

  const sf  = (a: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: a } });
  const CTR = { horizontal: "center" as const, vertical: "middle" as const };
  const MID = { horizontal: "left"   as const, vertical: "middle" as const };
  const THIN: Partial<ExcelJS.Borders> = {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };

  ws.getRow(1).height = 28;
  ws.mergeCells("A1:J1");
  const t = ws.getCell("A1");
  t.value = "UNIVERSIDAD AUTÓNOMA DE ICA — REGISTRO DE DELEGADOS 2026-I";
  t.font  = { bold: true, size: 13, color: { argb: WHITE } };
  t.fill  = sf(NAVY_A); t.alignment = CTR; t.border = THIN;

  ws.getRow(2).height = 6;
  const headers = ["N°", "Tipo", "Apellidos y Nombres", "Carrera", "Ciclo", "Sección", "Sede", "Celular", "Correo", "Registrado"];
  ws.getRow(3).height = 20;
  headers.forEach((h, i) => {
    const c = ws.getRow(3).getCell(i + 1);
    c.value = h; c.font = { bold: true, size: 10, color: { argb: WHITE } };
    c.fill  = sf(GOLD_A); c.alignment = CTR; c.border = THIN;
  });

  rows.forEach((r, i) => {
    const row = ws.getRow(4 + i); row.height = 17;
    const vals = [
      i + 1, r.tipo || "DELEGADO", r.apellidosNombres, r.carrera, r.ciclo, r.seccion,
      r.sede || "—", r.numero || "—", r.correo || "—", fmtDate(r.registradoEn),
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
  a.download = `Delegados_UAI_2026-1.xlsx`; a.click();
  URL.revokeObjectURL(a.href);
}

export default function DelegadosAdmin() {
  const { toast } = useToast();
  const [rows,    setRows]    = useState<Delegado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [copied,  setCopied]  = useState(false);
  const [filterCiclo, setFilterCiclo] = useState<"" | "1" | "2">("");
  const [filterTipo,  setFilterTipo]  = useState<"" | "DELEGADO" | "SUB DELEGADO">("");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/delegados`, { credentials: "include" });
      setRows(await res.json());
    } catch {
      toast({ title: "Error", description: "No se pudo cargar la lista", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este delegado?")) return;
    try {
      await fetch(`${apiBase}/api/delegados/${id}`, { method: "DELETE", credentials: "include" });
      setRows(prev => prev.filter(r => r.id !== id));
      toast({ title: "Eliminado" });
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(QR_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const printQR = () => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const logoUrl = `${window.location.origin}${base}/logo-uai.png`;
    const encoded = encodeURIComponent(QR_URL);
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encoded}&color=001F5F&bgcolor=ffffff&margin=10`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>QR Delegados UAI</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#f0f4ff; }
    .card {
      background:white;
      width:380px;
      padding:36px 30px 28px;
      border-radius:20px;
      box-shadow:0 8px 40px rgba(0,31,95,0.18);
      text-align:center;
    }
    .logo { height:64px; margin-bottom:18px; object-fit:contain; }
    .header {
      background:#001F5F;
      border-radius:12px;
      padding:14px 20px;
      margin-bottom:20px;
    }
    .header .badge {
      font-size:10px; font-weight:700; letter-spacing:2px;
      color:#C9A84C; text-transform:uppercase; margin-bottom:4px;
    }
    .header .title { font-size:26px; font-weight:900; color:white; line-height:1.1; }
    .subtitle { font-size:13px; color:#555; margin-bottom:18px; line-height:1.5; }
    .qr-wrap {
      display:inline-block;
      border:6px solid #001F5F;
      border-radius:16px;
      padding:10px;
      background:white;
      margin-bottom:18px;
    }
    .qr-wrap img { width:240px; height:240px; display:block; }
    .instruction {
      background:#f8f9fa;
      border-radius:10px;
      padding:12px 16px;
      margin-bottom:16px;
    }
    .instruction p { font-size:11px; color:#666; }
    .instruction .url { font-size:8px; color:#001F5F; word-break:break-all; margin-top:4px; font-weight:600; }
    .ciclos { display:flex; justify-content:center; gap:10px; margin-bottom:16px; }
    .ciclo-badge {
      padding:4px 16px; border-radius:20px;
      font-size:11px; font-weight:700;
    }
    .footer { font-size:10px; color:#aaa; }
    @media print {
      body { background:white; }
      .card { box-shadow:none; }
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="${logoUrl}" class="logo" alt="UAI" />
    <div class="header">
      <div class="badge">EE.GG · Estudios Generales · UAI</div>
      <div class="title">REGÍSTRATE<br/>DELEGADO</div>
    </div>
    <p class="subtitle">Escanea el código QR con tu celular<br/>y regístrate como delegado de tu sección</p>
    <div class="qr-wrap">
      <img src="${qrImgUrl}" alt="QR Registro Delegados" />
    </div>
    <div class="instruction">
      <p>¿Sin cámara? Ingresa al enlace:</p>
      <p class="url">${QR_URL}</p>
    </div>
    <div class="ciclos">
      <span class="ciclo-badge" style="background:#C9A84C;color:#001F5F;">CICLO 1</span>
      <span class="ciclo-badge" style="background:#001F5F;color:white;">CICLO 2</span>
    </div>
    <p class="footer">Universidad Autónoma de Ica · 2026-I</p>
  </div>
  <script>
    document.querySelector('.qr-wrap img').onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  <\/script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=500,height=700");
    if (win) { win.document.write(html); win.document.close(); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r =>
      (!filterCiclo || r.ciclo === filterCiclo) &&
      (!filterTipo  || (r.tipo || "DELEGADO") === filterTipo) &&
      (!q || r.apellidosNombres.toLowerCase().includes(q) ||
             r.carrera.toLowerCase().includes(q) ||
             r.seccion.toLowerCase().includes(q) ||
             (r.numero || "").includes(q) ||
             (r.correo || "").toLowerCase().includes(q))
    );
  }, [rows, search, filterCiclo, filterTipo]);

  const stats = useMemo(() => {
    const c1 = rows.filter(r => r.ciclo === "1").length;
    const c2 = rows.filter(r => r.ciclo === "2").length;
    const carreras = new Set(rows.map(r => r.carrera)).size;
    return { c1, c2, total: rows.length, carreras };
  }, [rows]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: NAVY }}>
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: NAVY }}>Delegados</h1>
          <p className="text-xs text-muted-foreground">Registro de delegados ciclos 1 y 2 · 2026-I</p>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total,    color: NAVY },
          { label: "Ciclo 1", value: stats.c1,     color: "#1d4ed8" },
          { label: "Ciclo 2", value: stats.c2,     color: "#7c3aed" },
          { label: "Carreras", value: stats.carreras, color: "#059669" },
        ].map(s => (
          <Card key={s.label} className="shadow-sm">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="shadow-sm border-blue-100">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4" style={{ color: NAVY }} />
              <span className="font-semibold text-sm" style={{ color: NAVY }}>QR de Registro</span>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-2xl shadow-inner border-2" style={{ borderColor: NAVY }}>
              <QRCodeSVG
                value={QR_URL}
                size={200}
                fgColor={NAVY}
                bgColor="#ffffff"
                level="H"
              />
            </div>
            <p className="text-xs text-center text-muted-foreground break-all px-2">{QR_URL}</p>
            <div className="flex gap-2 w-full">
              <Button
                size="sm"
                className="flex-1 text-white"
                style={{ background: NAVY }}
                onClick={copyUrl}
              >
                {copied ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "Copiado" : "Copiar enlace"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(QR_URL, "_blank")}
              >
                Abrir
              </Button>
            </div>
            <Button
              size="sm"
              className="w-full font-semibold text-white"
              style={{ background: GOLD, color: NAVY }}
              onClick={printQR}
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir QR
            </Button>
            <div className="w-full text-center">
              <p className="text-xs text-muted-foreground">Comparte este QR con los estudiantes para que se registren como delegados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 shadow-sm">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm" style={{ color: NAVY }}>
                Delegados registrados
                <span className="ml-2 px-2 py-0.5 rounded-full text-white text-xs" style={{ background: GOLD }}>
                  {filtered.length}
                </span>
              </span>
              <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                <select
                  value={filterTipo}
                  onChange={e => setFilterTipo(e.target.value as "" | "DELEGADO" | "SUB DELEGADO")}
                  className="h-8 text-xs border rounded-md px-2 bg-white"
                >
                  <option value="">Todos los tipos</option>
                  <option value="DELEGADO">Delegado</option>
                  <option value="SUB DELEGADO">Sub Delegado</option>
                </select>
                <select
                  value={filterCiclo}
                  onChange={e => setFilterCiclo(e.target.value as "" | "1" | "2")}
                  className="h-8 text-xs border rounded-md px-2 bg-white"
                >
                  <option value="">Todos los ciclos</option>
                  <option value="1">Ciclo 1</option>
                  <option value="2">Ciclo 2</option>
                </select>
                <div className="flex items-center gap-1 border rounded-md px-2 py-1 bg-white">
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="text-sm outline-none w-28 bg-transparent"
                  />
                  {search && <X className="w-3.5 h-3.5 cursor-pointer text-muted-foreground" onClick={() => setSearch("")} />}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Cargando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {rows.length === 0 ? "Aún no hay delegados registrados" : "Sin resultados para la búsqueda"}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: NAVY }}>
                      {["#", "Tipo", "Apellidos y Nombres", "Carrera", "Ciclo", "Sección", "Sede", "Celular", "Correo", ""].map(h => (
                        <th key={h} className="px-3 py-2 text-white font-semibold text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={r.id} className={i % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                        <td className="px-3 py-2 text-center text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                            style={(r.tipo || "DELEGADO") === "SUB DELEGADO"
                              ? { background: "#fef9c3", color: "#854d0e" }
                              : { background: "#dbeafe", color: "#1e40af" }}
                          >
                            {r.tipo || "DELEGADO"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium" style={{ color: NAVY }}>{r.apellidosNombres}</td>
                        <td className="px-3 py-2 text-slate-600 max-w-[160px] truncate" title={r.carrera}>{r.carrera}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-bold ${r.ciclo === "1" ? "bg-blue-600" : "bg-purple-600"}`}>
                            Ciclo {r.ciclo}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-bold">{r.seccion}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.sede || "—"}</td>
                        <td className="px-3 py-2 font-mono">{r.numero || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{r.correo || "—"}</td>
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
    </div>
  );
}
