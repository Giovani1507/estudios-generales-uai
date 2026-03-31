import React, { useState, useEffect, useMemo } from "react";
import * as ExcelJS from "exceljs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookOpen, Search, Users, Download, Loader2, MapPin } from "lucide-react";

interface FCSRow {
  local: string;
  carrera: string;
  carreraFull: string;
  ciclo: string;
  seccion: string;
  codigo: string;
  curso: string;
  modalidadCurso: string;
  horasT: number;
  horasP: number;
  horas: number;
  docente: string;
  modalidad: string;
  tipo: string;
  dia: string;
  hora: string;
  horaFin: string;
  horasAcad: number;
}

const CARRERAS_SEDE: Record<string, string> = {
  EN: "Enfermería",
  OB: "Obstetricia",
  PS: "Psicología",
};

const CARRERAS_SUNAMPE: Record<string, string> = {
  MH: "Medicina Humana",
  OB: "Obstetricia",
  PS: "Psicología",
  T1: "Tec. Méd. - Lab. Clínico",
  T3: "Tec. Méd. - Terapia Física",
  T4: "Tec. Méd. - Terapia del Lenguaje",
};

const CARRERAS_FULL: Record<string, string> = {
  EN: "ENFERMERÍA",
  OB: "OBSTETRICIA",
  PS: "PSICOLOGÍA",
  MH: "MEDICINA HUMANA",
  T1: "TEC. MÉD. - LAB. CLÍNICO",
  T3: "TEC. MÉD. - TERAPIA FÍSICA",
  T4: "TEC. MÉD. - TERAPIA DEL LENGUAJE",
  T2: "TEC. MÉD. - OPTOMETRÍA",
};

const DIA_ORDER: Record<string, number> = {
  LUNES: 1, MARTES: 2, MIERCOLES: 3, MIÉRCOLES: 3,
  JUEVES: 4, VIERNES: 5, SABADO: 6, SÁBADO: 6, DOMINGO: 7,
};

const SLOTS = [
  { start: "07:40", end: "08:30" },
  { start: "08:30", end: "09:20" },
  { start: "09:20", end: "10:10" },
  { start: "10:10", end: "11:00" },
  { start: "11:00", end: "11:50" },
  { start: "11:50", end: "12:40" },
  { start: "12:40", end: "13:30" },
  { start: "13:30", end: "14:20" },
  { start: "14:20", end: "15:10" },
  { start: "15:10", end: "16:00" },
  { start: "16:00", end: "16:50" },
  { start: "16:50", end: "17:40" },
  { start: "17:40", end: "18:30" },
  { start: "18:30", end: "19:20" },
  { start: "19:20", end: "20:10" },
  { start: "20:10", end: "21:00" },
  { start: "21:00", end: "21:50" },
  { start: "21:50", end: "22:40" },
  { start: "22:40", end: "23:30" },
];

function baseSeccion(s: string): string {
  return s.replace(/\d+$/, "");
}

function normDia(d: string): string {
  return d.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function slotIdx(hora: string): number {
  const h = hora.trim();
  const exact = SLOTS.findIndex((s) => s.start === h);
  if (exact >= 0) return exact;
  const after = SLOTS.findIndex((s) => s.start >= h);
  return after >= 0 ? after : 0;
}

function slotEndIdx(horaFin: string): number {
  const h = horaFin.trim();
  const exact = SLOTS.findIndex((s) => s.end === h);
  if (exact >= 0) return exact;
  const after = SLOTS.findIndex((s) => s.end >= h);
  return after >= 0 ? after : SLOTS.length - 1;
}

const DAY_COLS: Record<string, number> = {
  LUNES: 2, MARTES: 3, MIERCOLES: 4, JUEVES: 5, VIERNES: 6, SABADO: 7, DOMINGO: 8,
};

function turnoLabel(hora: string): string {
  if (!hora) return "MAÑANA";
  const h = parseInt(hora.split(":")[0]);
  if (h < 13) return "MAÑANA";
  if (h < 18) return "TARDE";
  return "NOCHE";
}

function modalidadBadge(m: string) {
  const norm = m.toUpperCase().trim();
  if (norm.includes("VIRTUAL"))
    return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-medium">Virtual</Badge>;
  if (norm.includes("HIBRIDO") || norm.includes("HÍBRIDO"))
    return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs font-medium">Híbrido</Badge>;
  return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-medium">Presencial</Badge>;
}

function tipoBadge(t: string) {
  if (t === "T")
    return <span className="inline-block bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">T</span>;
  if (t === "P")
    return <span className="inline-block bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">P</span>;
  return <span className="inline-block bg-gray-100 text-gray-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{t}</span>;
}

async function fetchLogoBase64(baseUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(`${baseUrl}logo-uai.png`);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res((r.result as string).split(",")[1]);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

export default function HorarioCarrera() {
  const [data, setData] = useState<FCSRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [local, setLocal] = useState("SEDE");
  const [carrera, setCarrera] = useState("EN");
  const [ciclo, setCiclo] = useState("1");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}planificacion-fcs-2026-1.json`)
      .then((r) => r.json())
      .then((d: FCSRow[]) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // When local changes, reset carrera and ciclo to a valid default
  useEffect(() => {
    if (local === "SEDE") setCarrera("EN");
    else setCarrera("MH");
    setCiclo("1");
  }, [local]);

  const carrerasForLocal = local === "SEDE" ? CARRERAS_SEDE : CARRERAS_SUNAMPE;

  // Available ciclos for selected local+carrera
  const availCiclos = useMemo(() => {
    const set = new Set(
      data
        .filter((r) => r.local === local && r.carrera === carrera)
        .map((r) => r.ciclo)
    );
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [data, local, carrera]);

  // Auto-select ciclo if current is not available
  useEffect(() => {
    if (availCiclos.length > 0 && !availCiclos.includes(ciclo)) {
      setCiclo(availCiclos[0]);
    }
  }, [availCiclos, ciclo]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data
      .filter(
        (r) =>
          r.local === local &&
          r.carrera === carrera &&
          r.ciclo === ciclo &&
          (!q ||
            r.curso.toLowerCase().includes(q) ||
            r.docente.toLowerCase().includes(q) ||
            r.seccion.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const ca = a.curso.localeCompare(b.curso, "es");
        if (ca !== 0) return ca;
        return a.seccion.localeCompare(b.seccion, "es");
      });
  }, [data, local, carrera, ciclo, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, { codigo: string; curso: string; rows: FCSRow[] }>();
    filtered.forEach((r) => {
      const key = r.codigo + "|" + r.curso;
      if (!map.has(key)) map.set(key, { codigo: r.codigo, curso: r.curso, rows: [] });
      map.get(key)!.rows.push(r);
    });
    return Array.from(map.values()).sort((a, b) => a.curso.localeCompare(b.curso, "es"));
  }, [filtered]);

  const totalDocentes = useMemo(
    () => new Set(filtered.map((r) => r.docente).filter(Boolean)).size,
    [filtered]
  );

  // ── Excel Export ───────────────────────────────────────────────────────
  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const carreraRows = data.filter((r) => r.local === local && r.carrera === carrera && r.ciclo === ciclo);

      // Group by base section
      const secMap = new Map<string, FCSRow[]>();
      carreraRows.forEach((r) => {
        const base = baseSeccion(r.seccion);
        if (!secMap.has(base)) secMap.set(base, []);
        secMap.get(base)!.push(r);
      });

      const logo64 = await fetchLogoBase64(import.meta.env.BASE_URL);
      const wb = new ExcelJS.Workbook();
      wb.creator = "UAI Portal Académico";
      wb.created = new Date();

      const NAVY   = "FF001F5F";
      const WHITE  = "FFFFFFFF";
      const LGRAY  = "FFD9E0F1";
      const DGRAY  = "FF444444";
      const YELLOW = "FFFFF2CC";

      type Fill = ExcelJS.Fill;
      const sf = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
      const CTR     = { horizontal: "center"  as const, vertical: "middle" as const, wrapText: true };
      const LEFT_MID= { horizontal: "left"    as const, vertical: "middle" as const, wrapText: true };
      const THIN: Partial<ExcelJS.Borders> = {
        top:    { style: "thin",   color: { argb: DGRAY } },
        bottom: { style: "thin",   color: { argb: DGRAY } },
        left:   { style: "thin",   color: { argb: DGRAY } },
        right:  { style: "thin",   color: { argb: DGRAY } },
      };
      const MED: Partial<ExcelJS.Borders> = {
        top:    { style: "medium", color: { argb: NAVY } },
        bottom: { style: "medium", color: { argb: NAVY } },
        left:   { style: "medium", color: { argb: NAVY } },
        right:  { style: "medium", color: { argb: NAVY } },
      };

      const localLabel = local === "SEDE" ? "SEDE" : "SUNAMPE";
      const sections   = Array.from(secMap.keys()).sort();

      for (const baseSec of sections) {
        const secRows = secMap.get(baseSec)!;
        const withDia = secRows.filter((r) => r.hora);
        const sorted  = [...withDia].sort((a, b) => a.hora.localeCompare(b.hora));
        const turno   = sorted.length > 0 ? turnoLabel(sorted[0].hora) : "MAÑANA";

        const sheetName = `${carrera} - ${ciclo}${baseSec} ${localLabel}`;
        const ws = wb.addWorksheet(sheetName, {
          pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
        });

        ws.columns = [
          { width: 11 }, // A Hora
          { width: 22 }, // B Lunes
          { width: 22 }, // C Martes
          { width: 22 }, // D Miércoles
          { width: 22 }, // E Jueves
          { width: 22 }, // F Viernes
          { width: 22 }, // G Sábado
          { width: 18 }, // H Domingo
        ];

        // Row 1: Logo + Title
        ws.getRow(1).height = 50;
        ws.mergeCells("A1:B1");
        ws.mergeCells("C1:H1");

        const c1left  = ws.getCell("A1");
        c1left.fill   = sf(NAVY);
        c1left.alignment = CTR;

        const c1title = ws.getCell("C1");
        c1title.value = "HORARIO DE CLASES 2026-I\nDepartamento Académico de Estudios Generales";
        c1title.font  = { bold: true, size: 13, color: { argb: WHITE } };
        c1title.fill  = sf(NAVY);
        c1title.alignment = CTR;
        c1title.border = MED;

        if (logo64) {
          const imgId = wb.addImage({ base64: logo64, extension: "png" });
          ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 46, height: 50 }, editAs: "absolute" });
        }

        // Rows 2-4: empty
        [2, 3, 4].forEach((r) => { ws.getRow(r).height = 5; });

        const setInfoRow = (row: number, label: string, value: string) => {
          ws.getRow(row).height = 18;
          ws.mergeCells(`C${row}:H${row}`);
          const la = ws.getCell(`A${row}`);
          la.value = label; la.font = { bold: true, size: 10 };
          la.fill = sf(LGRAY); la.border = THIN; la.alignment = LEFT_MID;
          const lc = ws.getCell(`C${row}`);
          lc.value = value; lc.font = { bold: true, size: 10 };
          lc.fill = sf(LGRAY); lc.border = THIN; lc.alignment = LEFT_MID;
        };

        setInfoRow(5, "FACULTAD", "CIENCIAS DE LA SALUD");
        setInfoRow(6, "CARRERA PROFESIONAL", CARRERAS_FULL[carrera] || carrera);
        setInfoRow(7, "CICLO ACADÉMICO - SECCIÓN", `${ciclo}${baseSec}`);
        setInfoRow(8, "TURNO - LOCAL", `${turno} - ${localLabel}`);

        ws.getRow(9).height = 5;

        // Row 10: day headers
        ws.getRow(10).height = 20;
        ["Hora", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].forEach((h, i) => {
          const cell = ws.getRow(10).getCell(i + 1);
          cell.value = h;
          cell.font  = { bold: true, size: 10, color: { argb: WHITE } };
          cell.fill  = sf(NAVY);
          cell.alignment = CTR;
          cell.border = MED;
        });

        // Build grid
        type CellInfo = { text: string; startSlot: number; endSlot: number };
        const grid = new Map<string, CellInfo>();

        secRows.forEach((r) => {
          if (!r.hora || !r.dia) return;
          const dayNorm = normDia(r.dia);
          const dayCol  = DAY_COLS[dayNorm];
          if (!dayCol) return;

          const startSlot = slotIdx(r.hora);
          const endSlot   = slotEndIdx(r.horaFin);
          const key       = `${startSlot}_${dayCol}`;
          const cellText  = [
            r.curso.toUpperCase(),
            r.docente || "Sin asignar",
            r.modalidad.toUpperCase().trim(),
          ].join("\n");

          if (grid.has(key)) {
            const ex = grid.get(key)!;
            ex.text    += "\n\n" + cellText;
            ex.endSlot  = Math.max(ex.endSlot, endSlot);
          } else {
            grid.set(key, { text: cellText, startSlot, endSlot });
          }
        });

        // Write slot rows 11-29
        const FIRST_ROW = 11;
        const occupied  = new Set<string>();

        SLOTS.forEach((slot, si) => {
          const rowNum = FIRST_ROW + si;
          ws.getRow(rowNum).height = 40;

          const timeCell = ws.getRow(rowNum).getCell(1);
          timeCell.value = `${slot.start}\n${slot.end}`;
          timeCell.font  = { size: 9, bold: true };
          timeCell.alignment = CTR;
          timeCell.fill  = sf(LGRAY);
          timeCell.border = THIN;

          for (let col = 2; col <= 8; col++) {
            const info = grid.get(`${si}_${col}`);

            if (info) {
              const spanRows = info.endSlot - si + 1;
              const endRow   = rowNum + spanRows - 1;
              if (spanRows > 1) {
                try { ws.mergeCells(rowNum, col, endRow, col); } catch { /**/ }
              }
              const cell = ws.getRow(rowNum).getCell(col);
              cell.value = info.text;
              cell.font  = { size: 9, color: { argb: DGRAY } };
              cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
              cell.fill  = sf(YELLOW);
              cell.border = THIN;
              for (let r2 = si + 1; r2 <= info.endSlot; r2++) occupied.add(`${r2}_${col}`);
            } else if (!occupied.has(`${si}_${col}`)) {
              const cell = ws.getRow(rowNum).getCell(col);
              cell.fill  = sf(WHITE);
              cell.border = THIN;
            }
          }
        });
      }

      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `Horario_${carrera}_Ciclo${ciclo}_${local}_2026-1.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Horarios por Carrera — FCS</h1>
          <p className="text-sm text-muted-foreground">
            Planificación 2026-1 · Ciclos 1 al 10
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">

        {/* LOCAL */}
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <Select value={local} onValueChange={setLocal}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SEDE">SEDE</SelectItem>
              <SelectItem value="SUNAMPE">SUNAMPE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* CARRERA */}
        <Select value={carrera} onValueChange={(v) => { setCarrera(v); setCiclo("1"); }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(carrerasForLocal).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                <span className="font-mono text-xs font-bold text-primary mr-2">{k}</span>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* CICLO */}
        <Select value={ciclo} onValueChange={setCiclo}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availCiclos.map((c) => (
              <SelectItem key={c} value={c}>Ciclo {c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 max-w-[280px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar curso o docente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Download */}
        <Button
          onClick={exportExcel}
          disabled={exporting || filtered.length === 0}
          className="gap-2"
        >
          {exporting ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Generando...</>
          ) : (
            <><Download className="w-4 h-4" />Descargar Excel</>
          )}
        </Button>

        {/* Stats */}
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            <b className="text-foreground">{grouped.length}</b> cursos
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <b className="text-foreground">{totalDocentes}</b> docentes
          </span>
        </div>
      </div>

      {/* No data */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No se encontraron cursos para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ codigo, curso, rows }) => (
            <Card key={codigo + curso} className="overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/40 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground leading-snug">
                      {curso}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{codigo}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {rows.length} secc.
                    </Badge>
                    {[...new Set(rows.map((r) => r.modalidad.toUpperCase().trim()))].map((m) => (
                      <span key={m}>{modalidadBadge(m)}</span>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground w-16">Secc.</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-8">Tipo</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Docente</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-24">Modalidad</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-24">Día</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-32">Horario</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground w-16">Hrs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows
                        .sort((a, b) => {
                          const sa = a.seccion.localeCompare(b.seccion, "es");
                          if (sa !== 0) return sa;
                          const da = DIA_ORDER[normDia(a.dia)] || 9;
                          const db = DIA_ORDER[normDia(b.dia)] || 9;
                          if (da !== db) return da - db;
                          return a.hora.localeCompare(b.hora);
                        })
                        .map((r, i) => (
                          <tr
                            key={i}
                            className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${
                              i % 2 === 0 ? "" : "bg-muted/10"
                            }`}
                          >
                            <td className="px-4 py-2.5 font-mono font-semibold text-xs text-primary">
                              {r.seccion}
                            </td>
                            <td className="px-3 py-2.5">{tipoBadge(r.tipo)}</td>
                            <td className="px-3 py-2.5 text-xs font-medium text-foreground">
                              {r.docente || <span className="text-muted-foreground italic">Sin asignar</span>}
                            </td>
                            <td className="px-3 py-2.5">{modalidadBadge(r.modalidad)}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">
                              {r.dia ? r.dia.charAt(0) + r.dia.slice(1).toLowerCase() : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-xs font-mono text-foreground">
                              {r.hora && r.horaFin ? `${r.hora} – ${r.horaFin}` : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                              {r.horasAcad || r.horas}h
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
