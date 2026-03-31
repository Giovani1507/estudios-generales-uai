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
import { BookOpen, Search, Users, Download, Loader2 } from "lucide-react";

interface FCSRow {
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

const CARRERAS: Record<string, string> = {
  EN: "Enfermería",
  OB: "Obstetricia",
  PS: "Psicología",
};

const CARRERAS_FULL: Record<string, string> = {
  EN: "ENFERMERÍA",
  OB: "OBSTETRICIA",
  PS: "PSICOLOGÍA",
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

// Extract base section letter: A1→A, B2→B, C→C
function baseSeccion(s: string): string {
  return s.replace(/\d+$/, "");
}

function normDia(d: string): string {
  return d.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function slotIdx(hora: string): number {
  const h = hora.trim();
  const i = SLOTS.findIndex((s) => s.start === h);
  if (i >= 0) return i;
  const fi = SLOTS.findIndex((s) => s.start >= h);
  return fi >= 0 ? fi : 0;
}

function slotEndIdx(horaFin: string): number {
  const h = horaFin.trim();
  const i = SLOTS.findIndex((s) => s.end === h);
  if (i >= 0) return i;
  const fi = SLOTS.findIndex((s) => s.end >= h);
  return fi >= 0 ? fi : SLOTS.length - 1;
}

const DAY_COLS: Record<string, number> = {
  LUNES: 2, MARTES: 3, MIERCOLES: 4, JUEVES: 5, VIERNES: 6, SABADO: 7, DOMINGO: 8,
};

function turnoLabel(hora: string): string {
  if (!hora) return "—";
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data
      .filter(
        (r) =>
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
  }, [data, carrera, ciclo, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, { codigo: string; curso: string; rows: FCSRow[] }>();
    filtered.forEach((r) => {
      const key = r.codigo + "|" + r.curso;
      if (!map.has(key)) map.set(key, { codigo: r.codigo, curso: r.curso, rows: [] });
      map.get(key)!.rows.push(r);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.curso.localeCompare(b.curso, "es")
    );
  }, [filtered]);

  const totalDocentes = useMemo(
    () => new Set(filtered.map((r) => r.docente)).size,
    [filtered]
  );

  // ── Excel export ──────────────────────────────────────────────────
  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const carreraRows = data.filter(
        (r) => r.carrera === carrera && r.ciclo === ciclo
      );

      // Group by base section (A, B, C...)
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
      const CTR = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
      const LEFT_MID = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };
      const THIN: Partial<ExcelJS.Borders> = {
        top:    { style: "thin", color: { argb: DGRAY } },
        bottom: { style: "thin", color: { argb: DGRAY } },
        left:   { style: "thin", color: { argb: DGRAY } },
        right:  { style: "thin", color: { argb: DGRAY } },
      };
      const MED: Partial<ExcelJS.Borders> = {
        top:    { style: "medium", color: { argb: NAVY } },
        bottom: { style: "medium", color: { argb: NAVY } },
        left:   { style: "medium", color: { argb: NAVY } },
        right:  { style: "medium", color: { argb: NAVY } },
      };

      // Sort sections alphabetically
      const sections = Array.from(secMap.keys()).sort();

      for (const baseSec of sections) {
        const secRows = secMap.get(baseSec)!;

        // Determine turno from earliest course in section
        const sorted = [...secRows].sort((a, b) => a.hora.localeCompare(b.hora));
        const turno = sorted.length > 0 ? turnoLabel(sorted[0].hora) : "MAÑANA";

        const sheetName = `${carrera} - ${ciclo}${baseSec} SEDE`;
        const ws = wb.addWorksheet(sheetName, {
          pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
        });

        // Column widths: A=Hora, B=Lunes, C=Martes, D=Miercoles, E=Jueves, F=Viernes, G=Sábado, H=Domingo
        ws.columns = [
          { width: 10  }, // A Hora
          { width: 22  }, // B Lunes
          { width: 22  }, // C Martes
          { width: 22  }, // D Miércoles
          { width: 22  }, // E Jueves
          { width: 22  }, // F Viernes
          { width: 22  }, // G Sábado
          { width: 16  }, // H Domingo (only if needed)
        ];

        // ── Row 1: Logo + Title ──────────────────────────────────
        ws.getRow(1).height = 50;
        ws.mergeCells("A1:B1");
        ws.mergeCells("C1:H1");

        const c1left = ws.getCell("A1");
        c1left.fill  = sf(NAVY);
        c1left.alignment = CTR;

        const c1title = ws.getCell("C1");
        c1title.value = "HORARIO DE CLASES 2026-I\nDepartamento Académico de Estudios Generales";
        c1title.font  = { bold: true, size: 13, color: { argb: WHITE } };
        c1title.fill  = sf(NAVY);
        c1title.alignment = CTR;
        c1title.border = MED;

        if (logo64) {
          const imgId = wb.addImage({ base64: logo64, extension: "png" });
          ws.addImage(imgId, {
            tl: { col: 0, row: 0 },
            ext: { width: 46, height: 50 },
            editAs: "absolute",
          });
        }

        // ── Rows 2-4: Empty ──────────────────────────────────────
        [2, 3, 4].forEach((r) => { ws.getRow(r).height = 5; });

        // ── Row 5: FACULTAD ──────────────────────────────────────
        ws.getRow(5).height = 18;
        ws.mergeCells("C5:H5");
        const r5a = ws.getCell("A5");
        r5a.value = "FACULTAD"; r5a.font = { bold: true, size: 10 };
        r5a.fill = sf(LGRAY); r5a.border = THIN; r5a.alignment = LEFT_MID;
        const r5c = ws.getCell("C5");
        r5c.value = "CIENCIAS DE LA SALUD";
        r5c.font = { bold: true, size: 10 }; r5c.fill = sf(LGRAY);
        r5c.border = THIN; r5c.alignment = LEFT_MID;

        // ── Row 6: CARRERA PROFESIONAL ───────────────────────────
        ws.getRow(6).height = 18;
        ws.mergeCells("C6:H6");
        const r6a = ws.getCell("A6");
        r6a.value = "CARRERA PROFESIONAL"; r6a.font = { bold: true, size: 10 };
        r6a.fill = sf(LGRAY); r6a.border = THIN; r6a.alignment = LEFT_MID;
        const r6c = ws.getCell("C6");
        r6c.value = CARRERAS_FULL[carrera] || carrera;
        r6c.font = { bold: true, size: 10 }; r6c.fill = sf(LGRAY);
        r6c.border = THIN; r6c.alignment = LEFT_MID;

        // ── Row 7: CICLO - SECCIÓN ───────────────────────────────
        ws.getRow(7).height = 18;
        ws.mergeCells("C7:H7");
        const r7a = ws.getCell("A7");
        r7a.value = "CICLO ACADÉMICO - SECCIÓN"; r7a.font = { bold: true, size: 10 };
        r7a.fill = sf(LGRAY); r7a.border = THIN; r7a.alignment = LEFT_MID;
        const r7c = ws.getCell("C7");
        r7c.value = `${ciclo}${baseSec}`;
        r7c.font = { bold: true, size: 10 }; r7c.fill = sf(LGRAY);
        r7c.border = THIN; r7c.alignment = LEFT_MID;

        // ── Row 8: TURNO - LOCAL ─────────────────────────────────
        ws.getRow(8).height = 18;
        ws.mergeCells("C8:H8");
        const r8a = ws.getCell("A8");
        r8a.value = "TURNO - LOCAL"; r8a.font = { bold: true, size: 10 };
        r8a.fill = sf(LGRAY); r8a.border = THIN; r8a.alignment = LEFT_MID;
        const r8c = ws.getCell("C8");
        r8c.value = `${turno} - SEDE`;
        r8c.font = { bold: true, size: 10 }; r8c.fill = sf(LGRAY);
        r8c.border = THIN; r8c.alignment = LEFT_MID;

        // ── Row 9: Empty ─────────────────────────────────────────
        ws.getRow(9).height = 5;

        // ── Row 10: Day headers ──────────────────────────────────
        ws.getRow(10).height = 20;
        const HEADERS = ["Hora", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
        HEADERS.forEach((h, i) => {
          const cell = ws.getRow(10).getCell(i + 1);
          cell.value = h;
          cell.font = { bold: true, size: 10, color: { argb: WHITE } };
          cell.fill = sf(NAVY);
          cell.alignment = CTR;
          cell.border = MED;
        });

        // ── Build grid: slotIdx → dayCol → cell content ──────────
        // Each cell: { text, startSlot, endSlot, col }
        type CellInfo = { text: string; startSlot: number; endSlot: number };
        const grid: Map<string, CellInfo> = new Map();

        secRows.forEach((r) => {
          const dayNorm = normDia(r.dia);
          const dayCol = DAY_COLS[dayNorm];
          if (!dayCol) return;

          const startSlot = slotIdx(r.hora);
          const endSlot   = slotEndIdx(r.horaFin);

          const key = `${startSlot}_${dayCol}`;
          const cellText = [
            r.curso.toUpperCase(),
            r.docente,
            r.modalidad.toUpperCase().replace(/PRESENCIAL/i, "PRESENCIAL").trim(),
          ].join("\n");

          // If multiple courses share the same slot+day (different sub-sections), stack them
          if (grid.has(key)) {
            const existing = grid.get(key)!;
            existing.text += "\n\n" + cellText;
            // Take the wider span
            existing.endSlot = Math.max(existing.endSlot, endSlot);
          } else {
            grid.set(key, { text: cellText, startSlot, endSlot });
          }
        });

        // ── Write slot rows (rows 11-29) ─────────────────────────
        const FIRST_ROW = 11;
        const occupied = new Set<string>(); // "rowNum_colNum" that are already merged/written

        SLOTS.forEach((slot, si) => {
          const rowNum = FIRST_ROW + si;
          ws.getRow(rowNum).height = 40;

          // Col A: time range
          const timeCell = ws.getRow(rowNum).getCell(1);
          timeCell.value = `${slot.start}\n${slot.end}`;
          timeCell.font  = { size: 9, bold: true };
          timeCell.alignment = CTR;
          timeCell.fill  = sf(LGRAY);
          timeCell.border = THIN;

          // Cols B-H: check grid for courses starting at this slot
          for (let col = 2; col <= 8; col++) {
            const colKey = `${si}_${col}`;
            const info = grid.get(colKey);

            if (info) {
              const endSlot = info.endSlot;
              const spanRows = endSlot - si + 1;
              const endRow = rowNum + spanRows - 1;

              // Merge rows if span > 1
              if (spanRows > 1) {
                try {
                  ws.mergeCells(rowNum, col, endRow, col);
                } catch { /* already merged */ }
              }

              const cell = ws.getRow(rowNum).getCell(col);
              cell.value = info.text;
              cell.font  = { size: 9, color: { argb: DGRAY } };
              cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
              cell.fill  = sf(YELLOW);
              cell.border = THIN;

              // Mark merged rows as occupied so we don't overwrite
              for (let r = si + 1; r <= endSlot; r++) {
                occupied.add(`${r}_${col}`);
              }
            } else if (!occupied.has(`${si}_${col}`)) {
              const cell = ws.getRow(rowNum).getCell(col);
              cell.fill  = sf(WHITE);
              cell.border = THIN;
            }
          }
        });
      } // end sections loop

      // ── Save ────────────────────────────────────────────────────
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `Horario_${carrera}_Ciclo${ciclo}_2026-1.xlsx`;
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
            Planificación 2026-1 · Sede Principal · Ciclos 1 y 2
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[160px] max-w-[220px]">
          <Select value={carrera} onValueChange={setCarrera}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CARRERAS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[120px]">
          <Select value={ciclo} onValueChange={setCiclo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Ciclo 1</SelectItem>
              <SelectItem value="2">Ciclo 2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1 max-w-[280px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar curso o docente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button
          onClick={exportExcel}
          disabled={exporting || filtered.length === 0}
          className="ml-auto gap-2"
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
