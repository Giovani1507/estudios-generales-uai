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

  /* All unique teachers sorted — horas solo de ciclo 1 y 2 */
  const teachers = useMemo(() => {
    const map = new Map<string, { horasT: number; horasP: number; horas: number }>();
    data.forEach(r => {
      if (r.ciclo !== "1" && r.ciclo !== "2" && r.ciclo !== 1 && r.ciclo !== 2) return;
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

  /* Courses for selected teacher — solo ciclo 1 y 2 */
  const courses = useMemo(() => {
    if (!selected) return [];
    return data
      .filter(r =>
        r.docente.toUpperCase().trim() === selected &&
        (r.ciclo === "1" || r.ciclo === "2" || r.ciclo === 1 || r.ciclo === 2)
      )
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

  /* ── Excel export — GRILLA SEMANAL (formato plantilla) ── */
  const exportExcel = async () => {
    if (!selected || courses.length === 0) return;

    const logo64 = await fetchLogoBase64();
    const wb = new ExcelJS.Workbook();
    wb.creator = "UAI Portal Académico";
    wb.created = new Date();

    // ── Colores de la plantilla ─────────────────────────────────────
    const NAVY   = "FF001F5F"; // fondo encabezado (plantilla exacta)
    const LIGHT  = "FFD9E0F1"; // celda total horas
    const WHITE  = "FFFFFFFF";
    const GRAY   = "FF444444";
    const NAVY_T = "FF001F5F"; // texto en celda LIGHT

    type Fill = ExcelJS.Fill;
    const sf  = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const CTR = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
    const BOT = { horizontal: "left"   as const, vertical: "bottom" as const };

    const THIN: Partial<ExcelJS.Borders> = {
      top:    { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      left:   { style: "thin", color: { argb: "FFCCCCCC" } },
      right:  { style: "thin", color: { argb: "FFCCCCCC" } },
    };
    const MED: Partial<ExcelJS.Borders> = {
      top:    { style: "medium", color: { argb: NAVY } },
      bottom: { style: "medium", color: { argb: NAVY } },
      left:   { style: "medium", color: { argb: NAVY } },
      right:  { style: "medium", color: { argb: NAVY } },
    };

    // ── Franjas horarias (mismas que la plantilla) ──────────────────
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
    const FIRST_DATA_ROW = 6; // fila Excel donde empieza la primera franja

    // Normaliza la hora (elimina espacios)
    const norm = (h: string) => (h ?? "").trim().replace(/\s/g, "");

    function findStartRow(hora: string): number {
      const h = norm(hora);
      const i = SLOTS.findIndex(s => s.start === h);
      if (i >= 0) return FIRST_DATA_ROW + i;
      // fallback: primer slot >= hora
      const fi = SLOTS.findIndex(s => s.start >= h);
      return FIRST_DATA_ROW + (fi >= 0 ? fi : 0);
    }

    function findEndRow(horaFin: string, startRow: number, horas: number): number {
      const h = norm(horaFin);
      const i = SLOTS.findIndex(s => s.end === h);
      if (i >= 0) return FIRST_DATA_ROW + i;
      // fallback: estimar por horas (4H ≈ 5 slots de 50min; ajustamos a slots enteros)
      const slots = Math.round(horas * 60 / 50);
      return startRow + Math.max(slots, 1) - 1;
    }

    // ── Columnas (A-J exactas de la plantilla) ──────────────────────
    // A=Hora, B=Lunes, C=Martes(left), D=Martes(right), E=Miercoles,
    // F=Jueves, G=Viernes, H=Sabado, I=Domingo, J=spacer
    const DAY_COL: Record<string, { col: number; col2?: number }> = {
      LUNES:     { col: 2           },
      MARTES:    { col: 3, col2: 4  }, // C:D merged
      MIERCOLES: { col: 5           },
      JUEVES:    { col: 6           },
      VIERNES:   { col: 7           },
      SABADO:    { col: 8           },
      DOMINGO:   { col: 9           },
    };

    // Convierte número de columna (1-based) + fila a referencia Excel (ej: 2,20 → "B20")
    function excelAddr(col: number, row: number): string {
      let letter = "";
      let c = col;
      while (c > 0) {
        const rem = (c - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        c = Math.floor((c - 1) / 26);
      }
      return `${letter}${row}`;
    }

    // nombre normalizado del día (del JSON puede ser MIÉRCOLES con tilde, etc.)
    function normDay(d: string): string {
      return d.toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .trim();
    }

    // Programa de estudio — siempre fijo para ciclos 1 y 2
    const carrerasLabel = "ESTUDIOS GENERALES - FICA";

    // ── Construir la hoja ───────────────────────────────────────────
    const ws = wb.addWorksheet("Table 1", {
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
    });

    ws.columns = [
      { width: 8           }, // A  Hora
      { width: 12.66       }, // B  Lunes
      { width: 3           }, // C  Martes (left)
      { width: 11.5        }, // D  Martes (right)
      { width: 15.16       }, // E  Miércoles
      { width: 17.33       }, // F  Jueves
      { width: 12.66       }, // G  Viernes
      { width: 12.66       }, // H  Sábado
      { width: 14          }, // I  Domingo
      { width: 2.16        }, // J  spacer
    ];

    // ── Fila 1: Logo a la IZQUIERDA + título "HORARIO DOCENTE" ──────
    // A1:B1 = logo (imagen flotante), C1:I1 merged = título
    ws.mergeCells("A1:B1"); // reservar celdas izquierdas para logo
    ws.mergeCells("C1:I1"); // título a la derecha del logo
    const r1 = ws.getRow(1); r1.height = 60; // más alto para el logo

    // Celdas A-B: fondo navy (bajo el logo)
    const c1left = r1.getCell(1);
    c1left.fill  = sf(NAVY);

    // Celda C: título
    const c1title = r1.getCell(3);
    c1title.value = "HORARIO DOCENTE";
    c1title.font  = { bold: true, size: 14, color: { argb: WHITE } };
    c1title.fill  = sf(NAVY);
    c1title.alignment = CTR;

    // Logo centrado dentro de las columnas A-B con proporciones correctas
    // Logo real: 165×182 px (ratio 0.907 — más alto que ancho)
    // Imagen destino: 46×50 px (mantiene ratio 0.907)
    // Área A+B: ~145px ancho, 60pt alto ≈ 80px
    // Centrado horizontal: colOff ≈ (145-46)/2 * 9525 EMU ≈ 471188 EMU
    // Centrado vertical:   rowOff ≈ (80-50)/2  * 9525 EMU ≈ 142875 EMU
    if (logo64) {
      const imgId = wb.addImage({ base64: logo64, extension: "png" });
      ws.addImage(imgId, {
        tl: { col: 0, row: 0, colOff: 471188, rowOff: 142875 },
        ext: { width: 46, height: 50 },
        editAs: "absolute",
      } as any);
    }

    // ── Fila 3: Docente (izq) | Semestre + Nombre (der) ────────────
    ws.mergeCells("A3:C3");
    ws.mergeCells("D3:J3");
    const r3 = ws.getRow(3); r3.height = 41.25;
    const c3a = r3.getCell(1);
    c3a.value     = "Docente:";
    c3a.font      = { bold: true, size: 9, color: { argb: GRAY } };
    c3a.alignment = BOT;

    const c3b = r3.getCell(4);
    c3b.value     = `SEMESTRE ACADÉMICO 2026-1\n${selected}`;
    c3b.font      = { bold: false, size: 11, color: { argb: "FF000000" } };
    c3b.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    // ── Fila 4: Programa de estudio ─────────────────────────────────
    ws.mergeCells("A4:J4");
    const r4 = ws.getRow(4); r4.height = 14;
    const c4 = r4.getCell(1);
    c4.value     = `Programa de estudio:            ${carrerasLabel}`;
    c4.font      = { size: 10, color: { argb: "FF000000" } };
    c4.alignment = { horizontal: "left", vertical: "middle" };

    // ── Fila 5: Encabezados de días ──────────────────────────────────
    ws.mergeCells("C5:D5"); // Martes ocupa C:D
    const r5 = ws.getRow(5); r5.height = 13.5;
    const dayHeaders = [
      [1, "Hora"], [2, "Lunes"], [3, "Martes"],
      [5, "Miércoles"], [6, "Jueves"], [7, "Viernes"],
      [8, "Sábado"], [9, "Domingo"],
    ] as [number, string][];
    dayHeaders.forEach(([col, label]) => {
      const cell = r5.getCell(col);
      cell.value = label;
      cell.fill  = sf(NAVY);
      cell.font  = { bold: true, size: 9, color: { argb: WHITE } };
      cell.alignment = CTR;
      cell.border = THIN;
    });

    // ── Filas 6-24: franjas horarias (columna A) ────────────────────
    const LAST_SLOT_ROW = FIRST_DATA_ROW + SLOTS.length - 1; // 24
    SLOTS.forEach((slot, idx) => {
      const rowNum = FIRST_DATA_ROW + idx;
      const row = ws.getRow(rowNum);
      row.height = 31.5;

      // Col A: horario
      const ca = row.getCell(1);
      ca.value     = `${slot.start}\n${slot.end}`;
      ca.font      = { size: 8, color: { argb: GRAY } };
      ca.alignment = CTR;
      ca.border    = THIN;

      // Colores de fondo alternados para celdas vacías
      // NOTA: NO pre-mergeamos C:D aquí — los cursos de Martes necesitan
      // poder mergear C6:D10 (multi-fila) sin que haya merges previos bloqueando.
      [2, 3, 4, 5, 6, 7, 8, 9].forEach(col => {
        const cell = row.getCell(col);
        cell.fill   = sf(idx % 2 === 0 ? "FFFAFBFF" : WHITE);
        cell.border = THIN;
      });
    });

    // ── Colocar cursos en la grilla ──────────────────────────────────
    // Colores de relleno para cursos (uno por carrera/sección)
    const COURSE_FILLS = [
      "FFD6E4F7", "FFDFF0D8", "FFFCE4D6", "FFE8D6F7",
      "FFDFF7FC", "FFFFE0B2", "FFFFE6F0", "FFFFE9B3",
    ];
    let fillIdx = 0;
    const courseColors = new Map<string, string>();

    courses.forEach(row => {
      const dayNorm = normDay(row.dia);
      const dayInfo = DAY_COL[dayNorm];
      if (!dayInfo) return; // día no reconocido

      const startRow = findStartRow(row.hora);
      const endRow   = findEndRow(row.horaFin ?? "", startRow, row.horas);

      // Asignar color único por curso
      const key = `${row.cod}-${row.ciclo}-${row.seccion}-${row.curso}`;
      if (!courseColors.has(key)) {
        courseColors.set(key, COURSE_FILLS[fillIdx % COURSE_FILLS.length]);
        fillIdx++;
      }
      const bgColor = courseColors.get(key)!;

      // Texto de la celda del curso (sin espacio inicial — se centra)
      const cellText = `${row.cod}_${row.ciclo}-${row.seccion}\n${localLabel(row.local)}\n${row.modalidad}\n \n${row.curso}`;

      // Mergear el bloque de filas en la columna del día
      const col1 = dayInfo.col;
      const col2 = dayInfo.col2 ?? col1;

      const topAddr    = excelAddr(col1, startRow);
      const bottomAddr = excelAddr(col2, endRow);
      const mergeRef   = `${topAddr}:${bottomAddr}`;

      try {
        if (startRow !== endRow || col1 !== col2) {
          ws.mergeCells(mergeRef);
        }
      } catch (_) { /* ya merged o solapado */ }

      const cell = ws.getRow(startRow).getCell(col1);
      cell.value     = cellText;
      cell.font      = { size: 8, color: { argb: "FF000000" }, bold: false };
      cell.fill      = sf(bgColor);
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border    = MED;
    });

    // ── Fila 25: total ───────────────────────────────────────────────
    const TOT_ROW = LAST_SLOT_ROW + 1; // 25
    ws.mergeCells(`A${TOT_ROW}:G${TOT_ROW}`);
    const rTot = ws.getRow(TOT_ROW); rTot.height = 22.5;

    const ctLeft = rTot.getCell(1);
    ctLeft.value = "";
    ctLeft.fill  = sf(NAVY);

    const ctLabel = rTot.getCell(8); // H
    ctLabel.value     = "TOTAL DE\nHORAS:";
    ctLabel.fill      = sf(NAVY);
    ctLabel.font      = { size: 10, color: { argb: WHITE } };
    ctLabel.alignment = CTR;
    ctLabel.border    = THIN;

    const totalH = courses.reduce((s, r) => s + r.horas, 0);
    const ctVal  = rTot.getCell(9); // I
    ctVal.value     = totalH;
    ctVal.fill      = sf(LIGHT);
    ctVal.font      = { bold: true, size: 15, color: { argb: NAVY_T } };
    ctVal.alignment = CTR;
    ctVal.border    = THIN;

    // ── Guardar y descargar ──────────────────────────────────────────
    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `${selected.replace(/\s+/g, "_")}_2026-1.xlsx`;
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
            <Badge className="text-[10px] px-2 py-0.5 bg-blue-600 text-white font-semibold">
              Ciclo 1 y 2
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Planificación 2026-1 · {teachers.length} docentes con cursos de ciclo 1-2
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
