import { useEffect, useMemo, useState, useCallback } from "react";
import * as ExcelJS from "exceljs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Search, Download, Loader2, MapPin, Layers, UserX,
} from "lucide-react";

type PlanRow = {
  docente: string;
  local: string;
  carrera: string;
  carreraFull: string;
  ciclo: string;
  seccion: string;
  codigo: string;
  curso: string;
  horasAcad: number;
};

type DocenteEntry = {
  nombre: string;
  locales: string[];
  carreras: string[];
  ciclos: string[];
  horasAcad: number;
};

function buildDocentes(data: PlanRow[]): DocenteEntry[] {
  const map = new Map<string, {
    locales: Set<string>;
    carreras: Set<string>;
    ciclos: Set<string>;
    seenHoras: Set<string>;
    horasAcad: number;
  }>();

  data.forEach(r => {
    const nombre = r.docente?.trim();
    if (!nombre) return;
    if (!map.has(nombre)) {
      map.set(nombre, {
        locales: new Set(), carreras: new Set(),
        ciclos: new Set(), seenHoras: new Set(), horasAcad: 0,
      });
    }
    const e = map.get(nombre)!;
    if (r.local)   e.locales.add(r.local);
    if (r.carrera) e.carreras.add(r.carrera);
    if (r.ciclo)   e.ciclos.add(r.ciclo);

    const key = `${r.carrera}|${r.ciclo}|${r.seccion}|${r.codigo}`;
    if (!e.seenHoras.has(key)) {
      e.seenHoras.add(key);
      e.horasAcad += Math.round(Number(r.horasAcad) || 0);
    }
  });

  return Array.from(map.entries())
    .map(([nombre, e]) => ({
      nombre,
      locales:  [...e.locales].sort(),
      carreras: [...e.carreras].sort(),
      ciclos:   [...e.ciclos].sort((a, b) => Number(a) - Number(b)),
      horasAcad: e.horasAcad,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

async function fetchLogoBase64(baseUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(`${baseUrl}logo-uai.png`);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise(res => {
      const rd = new FileReader();
      rd.onload = () => res((rd.result as string).split(",")[1]);
      rd.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function exportExcel(
  docentes: DocenteEntry[],
  facultad: "FICA" | "FCS",
  baseUrl: string,
  flagMap?: Map<string, SeguridadFlag>,
) {
  type Fill = ExcelJS.Fill;
  const NAVY = "FF001F5F";
  const WHITE = "FFFFFFFF";
  const LGRAY = "FFD9E0F1";
  const DGRAY = "FF333333";
  const sf = (a: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: a } });
  const CTR = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
  const LEFT = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };
  const MED: Partial<ExcelJS.Borders> = {
    top: { style: "medium", color: { argb: NAVY } },
    bottom: { style: "medium", color: { argb: NAVY } },
    left: { style: "medium", color: { argb: NAVY } },
    right: { style: "medium", color: { argb: NAVY } },
  };
  const THIN: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFB0B8CC" } },
    bottom: { style: "thin", color: { argb: "FFB0B8CC" } },
    left: { style: "thin", color: { argb: "FFB0B8CC" } },
    right: { style: "thin", color: { argb: "FFB0B8CC" } },
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = "UAI Portal Académico";
  wb.created = new Date();

  const ws = wb.addWorksheet("Lista de Docentes", {
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
  });

  ws.columns = [
    { width: 6 },
    { width: 40 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
    { width: 13 },
  ];

  const logo64 = await fetchLogoBase64(baseUrl);

  ws.getRow(1).height = 58;
  ws.mergeCells("A1:B1");
  ws.mergeCells("C1:F1");
  const logoCell = ws.getCell("A1");
  logoCell.fill = sf(NAVY);
  logoCell.alignment = CTR;
  const titleCell = ws.getCell("C1");
  const subtitleLine = facultad === "FICA"
    ? "Facultad de Ing., Ciencias y Administración"
    : "Facultad de Ciencias de la Salud";
  titleCell.value = `LISTA DE DOCENTES 2026-I\n${subtitleLine}`;
  titleCell.font = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
  titleCell.fill = sf(NAVY);
  titleCell.alignment = CTR;
  titleCell.border = MED;

  if (logo64) {
    const imgId = wb.addImage({ base64: logo64, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 50, height: 58 }, editAs: "absolute" });
  }

  const setInfoRow = (row: number, label: string, value: string) => {
    ws.getRow(row).height = 18;
    ws.mergeCells(`C${row}:F${row}`);
    const la = ws.getCell(`A${row}`);
    la.value = label;
    la.font = { bold: true, size: 10, color: { argb: NAVY } };
    la.fill = sf(LGRAY); la.border = THIN; la.alignment = LEFT;
    ws.mergeCells(`B${row}:B${row}`);
    const lc = ws.getCell(`C${row}`);
    lc.value = value;
    lc.font = { bold: true, size: 10, color: { argb: DGRAY } };
    lc.fill = sf(LGRAY); lc.border = THIN; lc.alignment = LEFT;
  };

  ws.getRow(2).height = 4;
  setInfoRow(3, "UNIVERSIDAD", "Universidad Autónoma de Ica — UAI");
  setInfoRow(4, "FACULTAD",
    facultad === "FICA" ? "Ing., Ciencias y Administración" : "Ciencias de la Salud");
  setInfoRow(5, "PERÍODO", "2026-I");
  setInfoRow(6, "TOTAL DOCENTES", String(docentes.length));
  setInfoRow(7, "FECHA EMISIÓN", new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" }));
  ws.getRow(8).height = 6;

  const hdrRow = ws.getRow(9);
  hdrRow.height = 22;
  const headers = ["N°", "APELLIDOS Y NOMBRES", "LOCAL(ES)", "CARRERA(S)", "CICLO(S)", "HORAS ACAD."];
  headers.forEach((h, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    cell.fill = sf(NAVY);
    cell.alignment = CTR;
    cell.border = MED;
  });

  const RED_BG    = "FFFFF0F0";
  const AMBER_BG  = "FFFFF8E8";
  const RED_TXT   = "FFC0392B";
  const AMBER_TXT = "FF92600A";
  const RED_BDR: Partial<ExcelJS.Borders> = {
    top:    { style: "thin", color: { argb: "FFFFC0C0" } },
    bottom: { style: "thin", color: { argb: "FFFFC0C0" } },
    left:   { style: "thin", color: { argb: "FFFFC0C0" } },
    right:  { style: "thin", color: { argb: "FFFFC0C0" } },
  };
  const AMBER_BDR: Partial<ExcelJS.Borders> = {
    top:    { style: "thin", color: { argb: "FFFFDDAA" } },
    bottom: { style: "thin", color: { argb: "FFFFDDAA" } },
    left:   { style: "thin", color: { argb: "FFFFDDAA" } },
    right:  { style: "thin", color: { argb: "FFFFDDAA" } },
  };

  docentes.forEach((d, idx) => {
    const rowNum = 10 + idx;
    ws.getRow(rowNum).height = 18;
    const flag = flagMap?.get(d.nombre.trim().toUpperCase()) ?? null;
    const esRojo = flag?.tipo === "RENUNCIO_CARGA" || flag?.tipo === "NO_REGRESA";
    const esAmbar = flag && !esRojo;
    const bg = esRojo ? RED_BG : esAmbar ? AMBER_BG : (idx % 2 === 0 ? "FFFFFFFF" : "FFF5F7FF");
    const flagLabel = flag ? (TIPO_LABEL[flag.tipo] ?? flag.tipo) : null;
    const vals: (string | number)[] = [
      idx + 1,
      flag ? `${d.nombre}  ⚠ ${flagLabel}` : d.nombre,
      d.locales.join(" / "),
      d.carreras.join(", "),
      d.ciclos.join(", "),
      flag ? (esRojo ? flagLabel! : `${d.horasAcad}h — ${flagLabel}`) : d.horasAcad,
    ];
    vals.forEach((v, i) => {
      const cell = ws.getRow(rowNum).getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      const txtColor = esRojo ? RED_TXT : esAmbar ? AMBER_TXT : DGRAY;
      cell.font = {
        size: 9.5, color: { argb: txtColor },
        bold: !!flag,
        italic: !!flag && i === 5,
        name: "Calibri",
      };
      cell.fill = sf(bg);
      cell.border = esRojo ? RED_BDR : esAmbar ? AMBER_BDR : THIN;
      cell.alignment = i === 1 ? LEFT : CTR;
    });
  });

  const footRow = 10 + docentes.length;
  ws.getRow(footRow).height = 20;
  ws.mergeCells(`A${footRow}:E${footRow}`);
  const totalCell = ws.getCell(`A${footRow}`);
  totalCell.value = `TOTAL DOCENTES: ${docentes.length}`;
  totalCell.font = { bold: true, size: 10, color: { argb: NAVY }, name: "Calibri" };
  totalCell.fill = sf(LGRAY); totalCell.alignment = CTR; totalCell.border = MED;
  const totalHorasCell = ws.getCell(`F${footRow}`);
  totalHorasCell.value = docentes.reduce((s, d) => s + d.horasAcad, 0);
  totalHorasCell.font = { bold: true, size: 10, color: { argb: NAVY }, name: "Calibri" };
  totalHorasCell.fill = sf(LGRAY); totalHorasCell.alignment = CTR; totalHorasCell.border = MED;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Lista_Docentes_${facultad}_UAI_2026-1.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

type SeguridadFlag = { id: number; nombre: string; tipo: string; observacion: string | null };

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

const TIPO_LABEL: Record<string, string> = {
  RENUNCIO_CARGA:      "Renunció a su carga lectiva",
  NO_REGRESA:          "No regresa este semestre",
  CAMBIO_PLANIFICACION:"Cambio en la planificación",
  BAJA_TEMPORAL:       "Baja temporal",
  OTRO:                "Otro",
};

const LOCAL_COLOR: Record<string, string> = {
  PRINCIPAL: "bg-blue-100 text-blue-800 border-blue-200",
  FILIAL:    "bg-orange-100 text-orange-800 border-orange-200",
  SUNAMPE:   "bg-teal-100 text-teal-800 border-teal-200",
  HUAURA:    "bg-purple-100 text-purple-800 border-purple-200",
  PORUMA:    "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export default function ListaDocentes({ initialFacultad = "FICA" }: { initialFacultad?: "FICA" | "FCS" }) {
  const [facultad, setFacultad] = useState<"FICA" | "FCS">(initialFacultad);
  const [ficaData, setFicaData] = useState<PlanRow[]>([]);
  const [fcsData,  setFcsData]  = useState<PlanRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [localFiltro, setLocalFiltro] = useState("TODOS");
  const [exporting, setExporting] = useState(false);
  const [flags, setFlags] = useState<SeguridadFlag[]>([]);

  const flagMap = useMemo(() => {
    const m = new Map<string, SeguridadFlag>();
    flags.forEach(f => m.set(f.nombre.trim().toUpperCase(), f));
    return m;
  }, [flags]);

  const getFlag = useCallback((nombre: string) => flagMap.get(nombre.trim().toUpperCase()) ?? null, [flagMap]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}planificacion-fica-2026-1.json`).then(r => r.json()),
      fetch(`${base}planificacion-fcs-2026-1.json`).then(r => r.json()),
      fetch(`${apiBase}/api/seguridad-docentes`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([fica, fcs, segs]) => {
      setFicaData(fica);
      setFcsData(fcs);
      setFlags(segs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const activeData = facultad === "FICA" ? ficaData : fcsData;

  const localesDisponibles = useMemo(
    () => [...new Set(activeData.map(r => r.local).filter(Boolean))].sort(),
    [activeData],
  );

  const todosDocentes = useMemo(() => {
    const src = (localFiltro === "TODOS" ? activeData : activeData.filter(r => r.local === localFiltro))
      .filter(r => ["1", "2"].includes(r.ciclo));
    return buildDocentes(src);
  }, [activeData, localFiltro]);

  const docentes = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return todosDocentes;
    return todosDocentes.filter(d =>
      d.nombre.toLowerCase().includes(q) ||
      d.carreras.some(c => c.toLowerCase().includes(q)) ||
      d.locales.some(l => l.toLowerCase().includes(q))
    );
  }, [todosDocentes, search]);

  const totalHoras = useMemo(() => docentes.reduce((s, d) => s + d.horasAcad, 0), [docentes]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportExcel(docentes, facultad, import.meta.env.BASE_URL, flagMap);
      const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
      fetch(`${base}/api/activity/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "descarga",
          detail: `Lista de Docentes ${facultad} (${docentes.length} docentes, ciclos 1 y 2)`,
        }),
      }).catch(() => {});
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm">Cargando planificación...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Lista de Docentes</h1>
          <p className="text-sm text-muted-foreground">Planificación 2026-1 · Ciclos 1 y 2</p>
        </div>
      </div>

      {/* Faculty tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {(["FICA", "FCS"] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFacultad(f); setSearch(""); setLocalFiltro("TODOS"); }}
            className={`px-6 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              facultad === f ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-border rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Total Docentes</p>
          <p className="text-3xl font-bold text-primary">{docentes.length}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Total Horas Acad.</p>
          <p className="text-3xl font-bold text-emerald-600">{totalHoras}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Sedes</p>
          <p className="text-3xl font-bold text-amber-600">{localesDisponibles.length}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Facultad</p>
          <p className="text-xl font-bold text-primary mt-1">{facultad}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={localFiltro} onValueChange={setLocalFiltro}>
            <SelectTrigger className="w-[168px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-primary" />Todos los locales
                </span>
              </SelectItem>
              {localesDisponibles.map(l => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1 max-w-[280px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar docente, carrera…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Button
          onClick={handleExport}
          disabled={exporting || docentes.length === 0}
          className="gap-2 ml-auto"
        >
          {exporting
            ? <><Loader2 className="w-4 h-4 animate-spin" />Generando…</>
            : <><Download className="w-4 h-4" />Descargar Excel ({docentes.length})</>}
        </Button>
      </div>

      {/* Table */}
      {docentes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No se encontraron docentes.</p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#001F5F] text-white">
                  <th className="px-3 py-3 text-center text-xs font-semibold w-10">N°</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Apellidos y Nombres</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">Local(es)</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">Carrera(s)</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold w-24">Ciclo(s)</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold w-24">Hrs Acad.</th>
                </tr>
              </thead>
              <tbody>
                {docentes.map((d, i) => {
                  const flag = getFlag(d.nombre);
                  const renuncio = flag?.tipo === "RENUNCIO_CARGA" || flag?.tipo === "NO_REGRESA";
                  const tieneFlag = !!flag;
                  return (
                    <tr
                      key={d.nombre}
                      className={`border-b last:border-0 transition-colors ${
                        renuncio
                          ? "bg-red-50 hover:bg-red-100/60"
                          : `hover:bg-primary/5 ${i % 2 === 0 ? "bg-white" : "bg-muted/30"}`
                      }`}
                    >
                      <td className={`px-3 py-2.5 text-center text-xs font-mono ${renuncio ? "text-red-400" : "text-muted-foreground"}`}>
                        {i + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {renuncio && <UserX className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          <span className={`text-sm font-semibold ${renuncio ? "text-red-700" : "text-foreground"}`}>
                            {d.nombre}
                          </span>
                          {tieneFlag && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
                              renuncio
                                ? "bg-red-100 text-red-700 border-red-200"
                                : "bg-amber-100 text-amber-700 border-amber-200"
                            }`}>
                              {flag!.tipo === "RENUNCIO_CARGA" ? "RENUNCIÓ" : flag!.tipo === "NO_REGRESA" ? "NO REGRESA" : flag!.tipo === "BAJA_TEMPORAL" ? "BAJA TEMP." : flag!.tipo === "CAMBIO_PLANIFICACION" ? "CAMBIO" : "OBSERVADO"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {d.locales.map(l => (
                            <span
                              key={l}
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                renuncio
                                  ? "bg-red-100 text-red-700 border-red-200"
                                  : LOCAL_COLOR[l] ?? "bg-gray-100 text-gray-700 border-gray-200"
                              }`}
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {d.carreras.map(c => (
                            <Badge
                              key={c}
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 font-mono font-bold ${renuncio ? "border-red-200 text-red-600" : ""}`}
                            >
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className={`px-3 py-2.5 text-center text-xs ${renuncio ? "text-red-400" : "text-muted-foreground"}`}>
                        {d.ciclos.join(", ")}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {renuncio ? (
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-100 text-red-700 border border-red-200">
                            {flag!.tipo === "RENUNCIO_CARGA" ? "RENUNCIÓ" : "NO REGRESA"}
                          </span>
                        ) : tieneFlag ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-sm font-bold text-emerald-700">{d.horasAcad > 0 ? `${d.horasAcad}h` : "—"}</span>
                            <span className="text-[9px] text-amber-600 font-semibold">⚠ ver seguridad</span>
                          </div>
                        ) : d.horasAcad > 0
                          ? <span className="text-sm font-bold text-emerald-700">{d.horasAcad}h</span>
                          : <span className="text-muted-foreground font-normal">—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#D9E0F1] border-t-2 border-[#001F5F]">
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold text-[#001F5F] text-right">
                    TOTAL — {docentes.length} docentes
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-emerald-700">
                    {totalHoras}h
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
