import { useEffect, useMemo, useState } from "react";
import { Search, Download, User, BookOpen, X, Clock, MapPin, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ExcelJS from "exceljs";

type FICARow = {
  carrera: string; carreraFull: string; cod: string; ciclo: string; seccion: string;
  turno: string; local: string; modalidad: string; tipo: string; dia: string;
  hora: string; horaFin: string; curso: string; docente: string;
  horasT: number; horasP: number; horas: number;
};

const TIPO_COLOR: Record<string, string> = {
  T:  "bg-blue-100 text-blue-700",
  TP: "bg-purple-100 text-purple-700",
  P:  "bg-green-100 text-green-700",
};

const CARRERA_COLOR: Record<string, string> = {
  AE: "#1a5a6b", AF: "#15607a", AR: "#4a1a7a", CA: "#6b4a00",
  DE: "#6b1a1a", IC: "#7a3a00", IN: "#1a6b3a", IS: "#2f5aa6",
};

const DIA_ORDER: Record<string, number> = {
  LUNES:1, MARTES:2, MIERCOLES:3, JUEVES:4, VIERNES:5, SABADO:6,
};

function localLabel(local: string) {
  return (local || "").toUpperCase().includes("PRINCIPAL") ? "SEDE" : "FILIAL";
}

function localBadge(local: string) {
  const l = localLabel(local);
  return l === "SEDE"
    ? <Badge className="text-[10px] px-1.5 py-0 bg-blue-600 text-white">{l}</Badge>
    : <Badge className="text-[10px] px-1.5 py-0 bg-orange-500 text-white">{l} · {local}</Badge>;
}

async function fetchLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}logo-uai.png`);
    const blob = await resp.blob();
    return await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res((r.result as string).split(",")[1]);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

export default function HorarioDocente() {
  const [data, setData]       = useState<FICARow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}planificacion-fica-2026-1.json`)
      .then(r => r.json())
      .then((d: FICARow[]) => { setData(d); setLoading(false); });
  }, []);

  /* All unique teachers sorted */
  const teachers = useMemo(() => {
    const map = new Map<string, { horasT: number; horasP: number; horas: number }>();
    data.forEach(r => {
      const k = r.docente.toUpperCase().trim();
      if (!map.has(k)) map.set(k, { horasT: 0, horasP: 0, horas: 0 });
      const v = map.get(k)!;
      v.horasT += r.horasT; v.horasP += r.horasP; v.horas += r.horas;
    });
    return Array.from(map.entries())
      .map(([n, h]) => ({ nombre: n, ...h }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [data]);

  /* Filtered dropdown list */
  const filteredTeachers = useMemo(() => {
    const q = search.toLowerCase();
    return q ? teachers.filter(t => t.nombre.toLowerCase().includes(q)) : teachers;
  }, [teachers, search]);

  /* Courses for selected teacher */
  const courses = useMemo(() => {
    if (!selected) return [];
    return data
      .filter(r => r.docente.toUpperCase().trim() === selected)
      .sort((a, b) => {
        const da = DIA_ORDER[a.dia] || 9, db = DIA_ORDER[b.dia] || 9;
        if (da !== db) return da - db;
        return a.hora.localeCompare(b.hora);
      });
  }, [data, selected]);

  /* Totals for selected teacher */
  const totals = useMemo(() => ({
    horasT: courses.reduce((s, r) => s + r.horasT, 0),
    horasP: courses.reduce((s, r) => s + r.horasP, 0),
    horas:  courses.reduce((s, r) => s + r.horas, 0),
    sede:   courses.filter(r => localLabel(r.local) === "SEDE").reduce((s, r) => s + r.horas, 0),
    filial: courses.filter(r => localLabel(r.local) === "FILIAL").reduce((s, r) => s + r.horas, 0),
    carreras: [...new Set(courses.map(r => r.cod))],
  }), [courses]);

  /* Excel export — matches provided model exactly */
  const exportExcel = async () => {
    if (!selected || courses.length === 0) return;

    const logo64 = await fetchLogoBase64();
    const wb = new ExcelJS.Workbook();
    wb.creator = "UAI Portal Académico"; wb.created = new Date();

    // ── colour palette ──────────────────────────────────────────────
    const C_BLUE_TITLE  = "FF2F5AA6"; // UAI primary — university name text
    const C_DARK_NAVY   = "FF1E3A6E"; // rows 3 & 4 background
    const C_BLUE_HDR    = "FF2F5AA6"; // row 5 (column headers) background
    const C_WHITE       = "FFFFFFFF";
    const C_GRAY_TEXT   = "FF555555";
    const C_ROW_ODD     = "FFF4F7FC"; // light blue-white for alternating rows
    const C_TOTAL_BG    = "FFD6E4F7"; // total row background
    const C_BLUE_TEXT   = "FF1E3A6E"; // numbers in total row & H.Total column

    // ── helpers ─────────────────────────────────────────────────────
    type Fill = ExcelJS.Fill;
    const solidFill = (argb: string): Fill =>
      ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const ctr  = { horizontal: "center" as const, vertical: "middle" as const };
    const mid  = { horizontal: "left"   as const, vertical: "middle" as const };

    // ── columns (16 cols: A-P) ──────────────────────────────────────
    const COLS = [
      { width: 5  }, // A  #
      { width: 9  }, // B  Cód.
      { width: 7  }, // C  Ciclo
      { width: 6  }, // D  Sec
      { width: 10 }, // E  Turno
      { width: 9  }, // F  Sede
      { width: 13 }, // G  Local
      { width: 13 }, // H  Modalidad
      { width: 11 }, // I  Día
      { width: 15 }, // J  Hora
      { width: 7  }, // K  Tipo
      { width: 6  }, // L  H.T
      { width: 6  }, // M  H.P
      { width: 8  }, // N  H.Total
      { width: 34 }, // O  Curso
      { width: 22 }, // P  Carrera
    ];
    const LAST_COL = "P"; // column 16

    // ── build a sheet for each group ─────────────────────────────────
    for (const grupo of ["TODOS", "SEDE", "FILIAL"]) {
      const rows = grupo === "TODOS" ? courses
        : courses.filter(r => localLabel(r.local) === grupo);
      if (rows.length === 0) continue;

      const ws = wb.addWorksheet(
        grupo === "TODOS" ? "Horario Completo"
        : grupo === "SEDE" ? "Sede (Principal)"
        : "Filial",
        { pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" } }
      );

      ws.columns = COLS;

      // ── Logo (overlaid, top-left) ───────────────────────────────
      if (logo64) {
        const imgId = wb.addImage({ base64: logo64, extension: "png" });
        ws.addImage(imgId, {
          tl: { col: 0, row: 0 },
          ext: { width: 90, height: 55 },
        });
      }

      // ── Row 1 — University name ─────────────────────────────────
      ws.mergeCells(`A1:${LAST_COL}1`);
      const rr1 = ws.getRow(1); rr1.height = 26;
      const c1 = rr1.getCell(1);
      c1.value = "UNIVERSIDAD AUTÓNOMA DE ICA";
      c1.font  = { bold: true, size: 14, color: { argb: C_BLUE_TITLE } };
      c1.alignment = ctr;
      c1.fill = solidFill("FFFFFFFF");

      // ── Row 2 — Faculty & period ────────────────────────────────
      ws.mergeCells(`A2:${LAST_COL}2`);
      const rr2 = ws.getRow(2); rr2.height = 17;
      const c2 = rr2.getCell(1);
      c2.value = "FACULTAD DE INGENIERÍA, CIENCIAS Y ADMINISTRACIÓN (FICA) · 2026-1";
      c2.font  = { size: 10, color: { argb: C_GRAY_TEXT } };
      c2.alignment = ctr;
      c2.fill = solidFill("FFFFFFFF");

      // ── Row 3 — Teacher name ────────────────────────────────────
      ws.mergeCells(`A3:${LAST_COL}3`);
      const rr3 = ws.getRow(3); rr3.height = 22;
      const c3 = rr3.getCell(1);
      c3.value = `DOCENTE: ${selected}`;
      c3.font  = { bold: true, size: 12, color: { argb: C_WHITE } };
      c3.fill  = solidFill(C_DARK_NAVY);
      c3.alignment = ctr;

      // ── Row 4 — Subtitle ────────────────────────────────────────
      ws.mergeCells(`A4:${LAST_COL}4`);
      const rr4 = ws.getRow(4); rr4.height = 17;
      const c4 = rr4.getCell(1);
      c4.value =
        grupo === "TODOS" ? "Horario Completo · Sede + Filial"
        : grupo === "SEDE" ? "Sede Principal"
        : "Filial";
      c4.font  = { size: 10, color: { argb: C_WHITE } };
      c4.fill  = solidFill(C_DARK_NAVY);
      c4.alignment = ctr;

      // ── Row 5 — Column headers ───────────────────────────────────
      const HEADERS = ["#","Cód.","Ciclo","Sec","Turno","Sede","Local","Modalidad","Día","Hora","Tipo","H.T","H.P","H.Total","Curso","Carrera"];
      const rr5 = ws.getRow(5); rr5.height = 26;
      HEADERS.forEach((h, i) => {
        const cell = rr5.getCell(i + 1);
        cell.value = h;
        cell.fill  = solidFill(C_BLUE_HDR);
        cell.font  = { bold: true, size: 10, color: { argb: C_WHITE } };
        cell.alignment = ctr;
        cell.border = {
          top:    { style: "thin", color: { argb: "FFAAAAAA" } },
          bottom: { style: "thin", color: { argb: "FFAAAAAA" } },
          left:   { style: "thin", color: { argb: "FFAAAAAA" } },
          right:  { style: "thin", color: { argb: "FFAAAAAA" } },
        };
      });

      // ── Data rows ────────────────────────────────────────────────
      const THIN_BORDER: Partial<ExcelJS.Borders> = {
        top:    { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        left:   { style: "thin", color: { argb: "FFDDDDDD" } },
        right:  { style: "thin", color: { argb: "FFDDDDDD" } },
      };

      rows.forEach((row, idx) => {
        const wr = ws.getRow(6 + idx);
        wr.height = 17;
        const bgColor = idx % 2 === 0 ? "FFFFFFFF" : C_ROW_ODD;
        const fill = solidFill(bgColor);

        const vals: (string | number)[] = [
          idx + 1,
          row.cod,
          row.ciclo,
          row.seccion,
          row.turno,
          localLabel(row.local),
          row.local,
          row.modalidad,
          row.dia,
          row.hora + (row.horaFin ? ` - ${row.horaFin}` : ""),
          row.tipo ?? "",
          row.horasT ?? 0,
          row.horasP ?? 0,
          row.horas,
          row.curso,
          row.carreraFull,
        ];

        vals.forEach((v, i) => {
          const cell = wr.getCell(i + 1);
          cell.value  = v;
          cell.fill   = fill;
          cell.border = THIN_BORDER;

          const isCenterCol = i === 0 || (i >= 2 && i <= 10) || i === 11 || i === 12 || i === 13;
          cell.alignment = isCenterCol ? ctr : mid;

          if (i === 13) { // H.Total — bold blue
            cell.font = { bold: true, size: 10, color: { argb: C_BLUE_TEXT } };
          } else {
            cell.font = { size: 9.5 };
          }
        });
      });

      // ── Totals row ───────────────────────────────────────────────
      const totRowNum = 6 + rows.length;
      const totRow = ws.getRow(totRowNum);
      totRow.height = 20;
      const tFill = solidFill(C_TOTAL_BG);

      ws.mergeCells(`A${totRowNum}:K${totRowNum}`);
      const tc = totRow.getCell(1);
      tc.value = `TOTAL  (${rows.length} sesiones)`;
      tc.fill  = tFill;
      tc.font  = { bold: true, size: 10, color: { argb: C_BLUE_TEXT } };
      tc.alignment = ctr;
      tc.border = THIN_BORDER;

      const totalHT = rows.reduce((s, r) => s + (r.horasT ?? 0), 0);
      const totalHP = rows.reduce((s, r) => s + (r.horasP ?? 0), 0);
      const totalH  = rows.reduce((s, r) => s + r.horas,         0);

      ([ [12, totalHT], [13, totalHP], [14, totalH] ] as [number, number][]).forEach(([col, val]) => {
        const cell = totRow.getCell(col);
        cell.value = val;
        cell.fill  = tFill;
        cell.font  = { bold: true, size: 11, color: { argb: C_BLUE_TEXT } };
        cell.alignment = ctr;
        cell.border = THIN_BORDER;
      });

      // blank cells K15-K16 (O and P in total row) — just style them
      [15, 16].forEach(col => {
        const cell = totRow.getCell(col);
        cell.fill   = tFill;
        cell.border = THIN_BORDER;
      });
    }

    // ── save & download ─────────────────────────────────────────────
    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `Horario_${selected.replace(/\s+/g, "_")}_2026-1.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-2">
          <Clock className="w-10 h-10 mx-auto opacity-30 animate-pulse" />
          <p className="text-sm">Cargando horarios…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            Horario por Docente — FICA
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Planificación 2026-1 · {teachers.length} docentes · {data.length} sesiones totales
          </p>
        </div>
        {selected && (
          <Button onClick={exportExcel} className="gap-2 bg-green-600 hover:bg-green-700 shrink-0">
            <Download className="w-4 h-4" /> Descargar Excel
          </Button>
        )}
      </div>

      {/* Teacher search/select */}
      <div className="bg-white border border-border rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <User className="w-4 h-4 text-primary" /> Seleccionar Docente
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar docente por nombre…"
            value={search}
            onChange={e => { setSearch(e.target.value); setDropOpen(true); }}
            onFocus={() => setDropOpen(true)}
            className="pl-9 h-10"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setSelected(null); setDropOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {/* Dropdown */}
          {dropOpen && filteredTeachers.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {filteredTeachers.slice(0, 80).map(t => (
                <button
                  key={t.nombre}
                  onClick={() => { setSelected(t.nombre); setSearch(t.nombre); setDropOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary/5 flex items-center justify-between gap-4 border-b border-border/30 last:border-0 ${selected === t.nombre ? "bg-primary/10 font-semibold" : ""}`}
                >
                  <span className="truncate">{t.nombre}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {t.horas} H · {t.horasT}T + {t.horasP}P
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selected && (
          <p className="text-xs text-muted-foreground">
            Mostrando: <strong className="text-foreground">{selected}</strong>
          </p>
        )}
      </div>

      {!selected ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <BookOpen className="w-12 h-12 opacity-20" />
          <p className="text-sm">Selecciona un docente para ver su horario</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-border rounded-xl p-4 shadow-sm text-center">
              <p className="text-xs text-muted-foreground mb-1">Sesiones</p>
              <p className="text-2xl font-bold text-foreground">{courses.length}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm text-center">
              <p className="text-xs text-blue-600 font-medium mb-1">H. Teoría</p>
              <p className="text-2xl font-bold text-blue-700">{totals.horasT}</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 shadow-sm text-center">
              <p className="text-xs text-purple-600 font-medium mb-1">H. Práctica</p>
              <p className="text-2xl font-bold text-purple-700">{totals.horasP}</p>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 shadow-sm text-center">
              <p className="text-xs text-primary font-medium mb-1">Total Horas</p>
              <p className="text-2xl font-bold text-primary">{totals.horas}</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-muted-foreground">Sede / Filial</p>
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex gap-2 text-xs">
                <span className="bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 font-semibold">
                  Sede {totals.sede}H
                </span>
                {totals.filial > 0 && (
                  <span className="bg-orange-100 text-orange-700 rounded px-1.5 py-0.5 font-semibold">
                    Filial {totals.filial}H
                  </span>
                )}
              </div>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {totals.carreras.map(c => (
                  <span key={c} className="text-[10px] font-bold px-1 py-0.5 rounded text-white"
                    style={{ background: CARRERA_COLOR[c] ?? "#555" }}>{c}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Courses table */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Cursos Asignados — {courses.length} sesiones
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">#</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Cód.</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Ciclo</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Sec</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Turno</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Sede</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Modalidad</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Día</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Hora</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Tipo</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap bg-blue-700">H.T</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap bg-purple-700">H.P</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Total</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap min-w-[200px]">Curso</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`border-t border-border/50 hover:bg-primary/5 transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-muted/20"
                      }`}
                    >
                      <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                          style={{ background: CARRERA_COLOR[row.cod] ?? "#555" }}
                        >{row.cod}</span>
                      </td>
                      <td className="px-3 py-2 text-center font-semibold">{row.ciclo}</td>
                      <td className="px-3 py-2 text-center font-mono">{row.seccion}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                          row.turno === "DIURNO"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}>{row.turno}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center">{localBadge(row.local)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.modalidad}</td>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{row.dia}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                        {row.hora}{row.horaFin ? ` – ${row.horaFin}` : ""}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.tipo && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TIPO_COLOR[row.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                            {row.tipo}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-semibold text-blue-600">{row.horasT || "—"}</td>
                      <td className="px-3 py-2 text-center font-semibold text-purple-600">{row.horasP || "—"}</td>
                      <td className="px-3 py-2 text-center font-bold text-primary">{row.horas}</td>
                      <td className="px-3 py-2 font-medium max-w-[240px]">
                        <span className="line-clamp-2">{row.curso}</span>
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="border-t-2 border-primary/30 bg-primary/5 font-semibold">
                    <td colSpan={10} className="px-3 py-2.5 text-right text-xs text-primary">
                      TOTALES ({courses.length} sesiones)
                    </td>
                    <td className="px-3 py-2.5 text-center text-blue-700 font-bold">{totals.horasT}</td>
                    <td className="px-3 py-2.5 text-center text-purple-700 font-bold">{totals.horasP}</td>
                    <td className="px-3 py-2.5 text-center text-primary font-bold text-sm">{totals.horas}</td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
