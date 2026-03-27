import { useEffect, useMemo, useState } from "react";
import { exportExcelWithLogo } from "@/lib/excel-export";
import {
  Search, Download, Users, Building2, Stethoscope, FileText, X, Printer,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DocenteReg {
  n: number;
  dni: number;
  nombre: string;
  condicion25: string;
  ingresoPor25: string;
  local25: string;
  programa25: string;
  dedicacion25: string;
  horas25: number;
  local26: string;
  condicion26: string;
  ingresoPor26: string;
  programa26: string;
  dedicacion26: string;
  horas26: number;
  observaciones: string;
  facultad: string;
}

const FICA_PROGS = [
  "INGENIERÍA DE SISTEMAS","INGENIERÍA INDUSTRIAL","INGENIERÍA CIVIL",
  "ARQUITECTURA","DERECHO","ADMINISTRACIÓN DE EMPRESAS","CONTABILIDAD",
  "ADMINISTRACIÓN Y FINANZAS",
];

const FCS_PROGS = [
  "ENFERMERÍA","OBSTETRICIA","PSICOLOGÍA","MEDICINA HUMANA","TECNOLOGÍA MÉDICA",
];

const PAGE_SIZE = 60;

type FacFilter = "FICA" | "FCS" | "TODOS";

export default function DocentesRegistro() {
  const [allData, setAllData] = useState<DocenteReg[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fFac, setFFac]         = useState<FacFilter>("FICA");
  const [fProg, setFProg]       = useState("all");
  const [fBusq, setFBusq]       = useState("");
  const [fHoras, setFHoras]     = useState<"all" | "2025" | "2026" | "menos12">("all");
  const [page, setPage]         = useState(1);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}docentes-registro-2026-1.json`)
      .then((r) => r.json())
      .then((d) => { setAllData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  /* Derived sets */
  const ficaDocentes = useMemo(() => allData.filter((d) => d.facultad === "FICA"), [allData]);
  const fcsDocentes  = useMemo(() => allData.filter((d) => d.facultad === "FCS"),  [allData]);

  const baseSet = useMemo(() => {
    if (fFac === "FICA") return ficaDocentes;
    if (fFac === "FCS")  return fcsDocentes;
    return allData;
  }, [fFac, allData, ficaDocentes, fcsDocentes]);

  const progs = useMemo(() => {
    const set = new Set(baseSet.map((d) => d.programa25).filter(Boolean));
    return Array.from(set).sort();
  }, [baseSet]);

  const filtered = useMemo(() => {
    let r = baseSet;
    if (fProg !== "all") r = r.filter((d) => d.programa25 === fProg);
    if (fHoras === "2026")    r = r.filter((d) => d.horas26 > 0);
    if (fHoras === "2025")    r = r.filter((d) => d.horas25 > 0);
    if (fHoras === "menos12") r = r.filter((d) => Number(d.horas26) > 0 && Number(d.horas26) < 12);
    if (fBusq) {
      const q = fBusq.toLowerCase();
      r = r.filter(
        (d) =>
          (d.nombre || "").toLowerCase().includes(q) ||
          (d.dni || "").toString().includes(q)
      );
    }
    return [...r].sort((a, b) => {
      if (fHoras === "menos12") return Number(a.horas26) - Number(b.horas26);
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }, [baseSet, fProg, fHoras, fBusq]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetPage = () => setPage(1);

  /* Export Excel */
  const exportExcel = () => {
    const periodo  = fHoras === "2025" ? "2025-2" : "2026-1";
    const show25   = fHoras === "2025" || fHoras === "all";
    const show26   = fHoras === "2026" || fHoras === "all" || fHoras === "menos12";

    const cols = [
      { header: "#",     key: "n",     width: 5,  align: "center" as const },
      { header: "DNI",   key: "dni",   width: 13, align: "center" as const },
      { header: "Nombre",key: "nombre",width: 44 },
      ...(show25 ? [
        { header: "Programa 2025-2",   key: "prog25",  width: 32 },
        { header: "Condición 2025-2",  key: "cond25",  width: 14 },
        { header: "Dedicación 2025-2", key: "ded25",   width: 14 },
        { header: "Horas 2025-2",      key: "h25",     width: 12, align: "center" as const },
      ] : []),
      ...(show26 ? [
        { header: "Programa 2026-1",   key: "prog26",  width: 32 },
        { header: "Condición 2026-1",  key: "cond26",  width: 14 },
        { header: "Dedicación 2026-1", key: "ded26",   width: 14 },
        { header: "Horas 2026-1",      key: "h26",     width: 12, align: "center" as const },
      ] : []),
      { header: "Observaciones", key: "obs", width: 40 },
    ];

    const rows = filtered.map((d, i) => ({
      n:      i + 1,
      dni:    d.dni ?? "SIN REGISTRO",
      nombre: d.nombre,
      prog25: d.programa25  || "—",
      cond25: d.condicion25  || "—",
      ded25:  d.dedicacion25 || "—",
      h25:    d.horas25  || 0,
      prog26: d.programa26  || "—",
      cond26: d.condicion26  || "—",
      ded26:  d.dedicacion26 || "—",
      h26:    d.horas26  || 0,
      obs:    d.observaciones || "",
    }));

    exportExcelWithLogo({
      sheetTitle:  `Docentes ${fFac} · ${periodo}`,
      institution: "Universidad Autónoma de Ica",
      subtitle:    `Registro oficial de docentes con carga académica · Semestre ${periodo}`,
      fileName:    `docentes_${fFac.toLowerCase()}_${periodo}`,
      columns:     cols,
      rows,
    });
  };

  /* Export CSV */
  const exportCSV = () => {
    const periodo = fHoras === "2025" ? "2025-2" : "2026-1";
    const show25 = fHoras === "2025" || fHoras === "all";
    const show26 = fHoras === "2026" || fHoras === "all" || fHoras === "menos12";
    const cols25 = show25 ? ",Programa 2025-2,Condición 2025-2,Dedicación 2025-2,Horas 2025-2" : "";
    const cols26 = show26 ? ",Programa 2026-1,Condición 2026-1,Dedicación 2026-1,Horas 2026-1" : "";
    const header = `#,DNI,Nombre${cols25}${cols26}`;
    const rows = filtered.map((d, i) => {
      const v25 = show25 ? `,"${d.programa25||""}","${d.condicion25||""}","${d.dedicacion25||""}",${d.horas25||0}` : "";
      const v26 = show26 ? `,"${d.programa26||""}","${d.condicion26||""}","${d.dedicacion26||""}",${d.horas26||0}` : "";
      return `${i+1},${d.dni ?? ""},"${d.nombre}"${v25}${v26}`;
    });
    const blob = new Blob([[header,...rows].join("\n")], {type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `docentes_${fFac.toLowerCase()}_${periodo}.csv`;
    a.click();
  };

  /* Export Print / PDF */
  const exportPrint = async () => {
    const today = new Date().toLocaleDateString("es-PE", { day:"2-digit", month:"long", year:"numeric" });
    const periodo = fHoras === "2025" ? "2025-2" : "2026-1";
    const facultadLabel = fFac === "FICA" ? "Facultad de Ingeniería, Ciencias y Administración (FICA)"
      : fFac === "FCS" ? "Facultad de Ciencias de la Salud (FCS)"
      : "Todas las Facultades";
    const filtroLabel = fHoras === "menos12" ? "Docentes con menos de 12 horas asignadas (2026-1)"
      : fHoras === "2026" ? "Docentes con horas en 2026-1"
      : fHoras === "2025" ? "Docentes con horas en 2025-2"
      : "Todos los docentes";

    // Logo → base64
    let logoSrc = "";
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}logo-uai.png`);
      const blob2 = await resp.blob();
      logoSrc = await new Promise<string>((res) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob2);
      });
    } catch { /* logo optional */ }

    const show25 = fHoras === "2025" || fHoras === "all";
    const show26 = fHoras === "2026" || fHoras === "all" || fHoras === "menos12";

    const theadCols = [
      `<th style="width:30px">#</th>`,
      `<th style="width:95px">DNI</th>`,
      `<th>Apellidos y Nombres</th>`,
      ...(show25 ? [`<th>Programa 2025-2</th>`,`<th style="width:75px">Cond. 2025</th>`,`<th style="width:50px;text-align:center">H.25</th>`] : []),
      ...(show26 ? [`<th>Programa 2026-1</th>`,`<th style="width:75px">Cond. 2026</th>`,`<th style="width:50px;text-align:center">H.26</th>`] : []),
      `<th>Observaciones</th>`,
    ].join("");

    const tbodyRows = filtered.map((d, i) => {
      const h26 = Number(d.horas26 || 0);
      const isLow = h26 > 0 && h26 < 12;
      const h26Cell = h26 > 0
        ? `<td style="text-align:center;font-weight:700;color:${isLow ? "#dc2626" : "#2f5aa6"}">${h26}${isLow ? " ⚠" : ""}</td>`
        : `<td style="text-align:center;color:#999">—</td>`;
      return `<tr style="${isLow ? "background:#fff5f5" : i%2===0?"":"background:#f8f9fb"}">
        <td style="text-align:center;color:#888">${i+1}</td>
        <td style="font-family:monospace">${d.dni || ""}</td>
        <td style="font-weight:500">${d.nombre || ""}</td>
        ${show25 ? `<td style="font-size:10px">${d.programa25||"—"}</td><td style="font-size:10px">${d.condicion25||"—"}</td><td style="text-align:center">${d.horas25||"—"}</td>` : ""}
        ${show26 ? `<td style="font-size:10px">${d.programa26||"—"}</td><td style="font-size:10px">${d.condicion26||"—"}</td>${h26Cell}` : ""}
        <td style="font-size:10px;color:#666">${d.observaciones||""}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"/>
<title>Registro Docentes ${periodo} – UAI</title>
<style>
  * { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a2e; padding: 20px; }
  .header { display:flex; align-items:center; gap:16px; border-bottom:3px solid #2f5aa6; padding-bottom:12px; margin-bottom:16px; }
  .logo { height:60px; }
  .header-text h1 { font-size:13px; font-weight:700; color:#2f5aa6; text-transform:uppercase; letter-spacing:.5px; }
  .header-text h2 { font-size:11px; color:#555; margin-top:2px; }
  .meta { display:flex; gap:24px; background:#f0f4ff; border:1px solid #dbe4ff; border-radius:6px; padding:10px 14px; margin-bottom:14px; font-size:10.5px; }
  .meta-item strong { display:block; font-size:9px; color:#888; text-transform:uppercase; letter-spacing:.5px; margin-bottom:2px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#2f5aa6; color:#fff; padding:6px 8px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.4px; }
  td { padding:5px 8px; border-bottom:1px solid #e8ecf0; font-size:11px; }
  .footer { margin-top:14px; font-size:9px; color:#aaa; text-align:center; border-top:1px solid #e0e0e0; padding-top:8px; }
  @media print {
    body { padding:12px; }
    .no-print { display:none; }
    tr { page-break-inside: avoid; }
  }
</style>
</head><body>
<div class="header">
  ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="UAI"/>` : ""}
  <div class="header-text">
    <h1>Universidad Autónoma de Ica</h1>
    <h2>Registro de Docentes · ${facultadLabel}</h2>
  </div>
</div>
<div class="meta">
  <div class="meta-item"><strong>Período</strong>${periodo}</div>
  <div class="meta-item"><strong>Filtro</strong>${filtroLabel}${fProg !== "all" ? ` · ${fProg}` : ""}</div>
  <div class="meta-item"><strong>Total docentes</strong>${filtered.length}</div>
  <div class="meta-item"><strong>Generado</strong>${today}</div>
</div>
<table>
  <thead><tr>${theadCols}</tr></thead>
  <tbody>${tbodyRows}</tbody>
</table>
<div class="footer">Sistema de Gestión Académica · Universidad Autónoma de Ica · 2026</div>
<script>window.onload=()=>{ window.print(); }</script>
</body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-2">
          <Users className="w-10 h-10 mx-auto opacity-30 animate-pulse" />
          <p className="text-sm">Cargando registro de docentes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Users className="w-7 h-7 text-primary" />
          Registro de Docentes 2026-1
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Datos oficiales de docentes con carga académica · Semestre 2026-1
        </p>
      </div>

      {/* Faculty tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["FICA","FCS","TODOS"] as FacFilter[]).map((f) => {
          const count = f==="FICA" ? ficaDocentes.length : f==="FCS" ? fcsDocentes.length : allData.length;
          const isActive = fFac === f;
          const Icon = f==="FICA" ? Building2 : f==="FCS" ? Stethoscope : Users;
          return (
            <button
              key={f}
              onClick={() => { setFFac(f); setFProg("all"); setFBusq(""); resetPage(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                isActive
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-muted-foreground border-border/50 hover:border-primary/40 hover:text-primary"
              }`}
            >
              <Icon className="w-4 h-4" />
              {f === "TODOS" ? "Todos" : f}
              <span className={`text-xs px-1.5 py-0.5 rounded-md font-mono ${isActive ? "bg-white/20" : "bg-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={fProg}
          onChange={(e) => { setFProg(e.target.value); resetPage(); }}
          className="h-9 rounded-lg border border-border/60 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-52"
        >
          <option value="all">Todos los programas</option>
          {progs.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Horas filter */}
        <div className="flex rounded-lg border border-border/60 overflow-hidden bg-white">
          {(["all", "2025", "2026", "menos12"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => { setFHoras(opt); resetPage(); }}
              className={`px-3 h-9 text-sm font-medium transition-colors border-r last:border-r-0 border-border/40 ${
                fHoras === opt
                  ? opt === "menos12"
                    ? "bg-red-600 text-white"
                    : "bg-primary text-white"
                  : opt === "menos12"
                  ? "text-red-600 hover:bg-red-50"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {opt === "all" ? "Todas" : opt === "menos12" ? "< 12 h" : `H. ${opt}`}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o DNI…"
            value={fBusq}
            onChange={(e) => { setFBusq(e.target.value); resetPage(); }}
            className="pl-9 h-9 text-sm"
          />
          {fBusq && (
            <button onClick={() => { setFBusq(""); resetPage(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2 ml-auto">
          <Button onClick={exportExcel} className="gap-2 h-9 text-sm bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button onClick={exportCSV} variant="outline" className="gap-2 h-9 text-sm">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button onClick={exportPrint} variant="outline" className="gap-2 h-9 text-sm border-purple-300 text-purple-700 hover:bg-purple-50">
            <Printer className="w-4 h-4" /> PDF / Imprimir
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="w-4 h-4" />
        <span>
          Mostrando <strong className="text-foreground">{filtered.length}</strong> docentes
          {fBusq && ` · búsqueda: "${fBusq}"`}
          {fProg !== "all" && ` · programa: ${fProg}`}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden bg-white shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-[44px_110px_1fr_200px_90px_80px_80px] bg-muted/60 border-b border-border/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>#</span>
          <span>DNI</span>
          <span>Nombre del Docente</span>
          <span>Programa 2025-2</span>
          <span>Condición</span>
          <span className="text-center">H. 2025</span>
          <span className="text-center">H. 2026</span>
        </div>

        {/* Body */}
        <div className="divide-y divide-border/40 max-h-[520px] overflow-y-auto">
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Search className="w-8 h-8 opacity-30" />
              <p className="text-sm">Sin resultados para los filtros seleccionados</p>
            </div>
          ) : (
            paginated.map((d, idx) => {
              const rowN = (page - 1) * PAGE_SIZE + idx + 1;
              return (
                <div
                  key={d.dni || d.nombre}
                  className={`grid grid-cols-[44px_110px_1fr_200px_90px_80px_80px] items-center px-4 py-2.5 hover:bg-primary/[0.03] transition-colors ${
                    Number(d.horas26) > 0 && Number(d.horas26) < 12 ? "bg-red-50/40" : ""
                  }`}
                >
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">{rowN}</span>
                  <span className="text-sm font-mono text-foreground tabular-nums">{d.dni}</span>
                  <span className="text-sm font-medium text-foreground pr-2 truncate" title={d.nombre}>
                    {d.nombre}
                  </span>
                  <span className="text-xs text-muted-foreground truncate pr-2" title={d.programa25}>
                    {d.programa25 || "—"}
                  </span>
                  <span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 font-medium ${
                        d.condicion25 === "DOCENTE"
                          ? "border-blue-200 text-blue-700 bg-blue-50"
                          : "border-amber-200 text-amber-700 bg-amber-50"
                      }`}
                    >
                      {d.condicion25 || "—"}
                    </Badge>
                  </span>
                  <span className="text-sm text-center text-muted-foreground tabular-nums">
                    {d.horas25 > 0 ? d.horas25 : "—"}
                  </span>
                  <span className={`text-sm text-center font-bold tabular-nums ${
                    Number(d.horas26) >= 12
                      ? "text-primary"
                      : Number(d.horas26) > 0
                      ? "text-red-600"
                      : "text-muted-foreground"
                  }`}>
                    {d.horas26 > 0 ? d.horas26 : "—"}
                    {Number(d.horas26) > 0 && Number(d.horas26) < 12 && (
                      <span className="ml-1 text-[9px] font-semibold bg-red-100 text-red-600 rounded px-0.5">!</span>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Pagination */}
        <div className="px-4 py-2.5 bg-muted/30 border-t border-border/40 flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            Pág. {page} de {totalPages} · {filtered.length} docentes en total
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}
              className="h-7 w-7 p-0 text-xs"
            >«</Button>
            <Button
              variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p-1))} disabled={page === 1}
              className="h-7 w-7 p-0 text-xs"
            >‹</Button>
            {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const pn = start + i;
              return (
                <Button
                  key={pn} variant={pn===page?"default":"outline"} size="sm"
                  onClick={() => setPage(pn)}
                  className={`h-7 w-7 p-0 text-xs ${pn===page ? "bg-primary text-white" : ""}`}
                >{pn}</Button>
              );
            })}
            <Button
              variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p+1))} disabled={page===totalPages}
              className="h-7 w-7 p-0 text-xs"
            >›</Button>
            <Button
              variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page===totalPages}
              className="h-7 w-7 p-0 text-xs"
            >»</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
