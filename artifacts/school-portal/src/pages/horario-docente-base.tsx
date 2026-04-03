import { useEffect, useMemo, useState } from "react";
import { Search, Download, User, BookOpen, X, Clock, MapPin, GraduationCap, PackageOpen, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ExcelJS from "exceljs";
import JSZip from "jszip";

type FICARow = {
  carrera: string; carreraFull: string; cod: string; ciclo: string; seccion: string;
  turno: string; local: string; modalidad: string; tipo: string; dia: string;
  hora: string; horaFin: string; curso: string; docente: string;
  horasT: number; horasP: number; horas: number;
};
type FCSRaw = {
  local: string; carrera: string; carreraFull: string; ciclo: string; seccion: string;
  codigo: string; curso: string; modalidadCurso: string; horasT: number; horasP: number;
  horas: number; docente: string; modalidad: string; tipo: string;
  dia: string; hora: string; horaFin: string; horasAcad: number;
};

function turnoFromHora(hora: string): string {
  if (!hora) return "DIURNO";
  const h = parseInt(hora.split(":")[0]);
  return h < 18 ? "DIURNO" : "NOCTURNO";
}

const TIPO_COLOR: Record<string, string> = {
  T:  "bg-blue-100 text-blue-700",
  TP: "bg-purple-100 text-purple-700",
  P:  "bg-green-100 text-green-700",
};

const CARRERA_COLOR: Record<string, string> = {
  // FICA
  AE: "#1a5a6b", AF: "#15607a", AR: "#4a1a7a", CA: "#6b4a00",
  DE: "#6b1a1a", IC: "#7a3a00", IN: "#1a6b3a", IS: "#2f5aa6",
  // FCS
  EN: "#7a1a5a", ME: "#8b1a1a", OB: "#4a6b1a", OD: "#1a4a6b",
  FA: "#6b3a1a", TM: "#1a6b6b", PS: "#5a1a6b", NU: "#2a6b2a",
};

const DIA_ORDER: Record<string, number> = {
  LUNES:1, MARTES:2, MIERCOLES:3, JUEVES:4, VIERNES:5, SABADO:6, DOMINGO:7,
};

function localLabel(local: string) {
  const u = (local || "").toUpperCase().trim();
  if (u === "SEDE" || u === "PRINCIPAL") return "PRINCIPAL";
  return u || "—";
}

const LOCAL_BADGE_STYLE: Record<string, { cls: string; label: string }> = {
  PRINCIPAL: { cls: "bg-blue-600 text-white",    label: "PRINCIPAL" },
  SEDE:      { cls: "bg-blue-600 text-white",    label: "PRINCIPAL" },
  SUNAMPE:   { cls: "bg-teal-600 text-white",    label: "SUNAMPE"   },
  FILIAL:    { cls: "bg-orange-500 text-white",  label: "FILIAL"    },
  HUAURA:    { cls: "bg-purple-600 text-white",  label: "HUAURA"    },
  PORUMA:    { cls: "bg-emerald-600 text-white", label: "PORUMA"    },
};

function localBadge(local: string) {
  const u = (local || "").toUpperCase().trim();
  const b = LOCAL_BADGE_STYLE[u];
  if (b) return <Badge className={`text-[10px] px-1.5 py-0 ${b.cls}`}>{b.label}</Badge>;
  return <Badge className="text-[10px] px-1.5 py-0 bg-gray-500 text-white">{u || "—"}</Badge>;
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

interface Props {
  faculty: "FICA" | "FCS";
}

export default function HorarioDocenteBase({ faculty }: Props) {
  const [data, setData]         = useState<FICARow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const jsonFile     = faculty === "FICA" ? "planificacion-fica-2026-1.json" : "planificacion-fcs-2026-1.json";
  const facultyLabel = faculty === "FICA"
    ? "ESTUDIOS GENERALES - FICA"
    : "ESTUDIOS GENERALES - FCS";
  const facultySubtitle = faculty === "FICA"
    ? "Facultad de Ingeniería y Ciencias Ambientales"
    : "Facultad de Ciencias de la Salud";
  const accentColor = faculty === "FICA" ? "bg-blue-600" : "bg-rose-600";

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}${jsonFile}`)
      .then(r => r.json())
      .then((raw: FICARow[] | FCSRaw[]) => {
        let rows: FICARow[];
        if (faculty === "FCS") {
          rows = (raw as FCSRaw[]).map(r => ({
            cod:         r.carrera,
            carrera:     r.carreraFull || r.carrera,
            carreraFull: r.carreraFull || r.carrera,
            ciclo:       String(r.ciclo),
            seccion:     r.seccion,
            turno:       turnoFromHora(r.hora),
            local:       r.local,
            modalidad:   r.modalidad,
            tipo:        r.tipo,
            dia:         r.dia,
            hora:        r.hora,
            horaFin:     r.horaFin,
            curso:       r.curso,
            docente:     r.docente,
            horasT:      r.horasT,
            horasP:      r.horasP,
            horas:       r.horas || r.horasAcad,
          }));
        } else {
          rows = raw as FICARow[];
        }
        setData(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [faculty, jsonFile]);

  /* Solo ciclos 1 y 2 */
  const dataCiclo12 = useMemo(() =>
    data.filter(r => r.ciclo === "1" || r.ciclo === "2"),
  [data]);

  /* Docentes únicos ordenados */
  const teachers = useMemo(() => {
    const map = new Map<string, { horasT: number; horasP: number; horas: number }>();
    dataCiclo12.forEach(r => {
      if (!r.docente?.trim()) return;
      const k = r.docente.toUpperCase().trim();
      if (!map.has(k)) map.set(k, { horasT: 0, horasP: 0, horas: 0 });
      const v = map.get(k)!;
      v.horasT += Number(r.horasT) || 0;
      v.horasP += Number(r.horasP) || 0;
      v.horas  += Number(r.horas)  || 0;
    });
    return Array.from(map.entries())
      .map(([n, h]) => ({ nombre: n, ...h }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [dataCiclo12]);

  const filteredTeachers = useMemo(() => {
    const q = search.toLowerCase();
    return q ? teachers.filter(t => t.nombre.toLowerCase().includes(q)) : teachers;
  }, [teachers, search]);

  const courses = useMemo(() => {
    if (!selected) return [];
    return dataCiclo12
      .filter(r => r.docente.toUpperCase().trim() === selected)
      .sort((a, b) => {
        const da = DIA_ORDER[a.dia] || 9, db = DIA_ORDER[b.dia] || 9;
        if (da !== db) return da - db;
        return a.hora.localeCompare(b.hora);
      });
  }, [dataCiclo12, selected]);

  const totals = useMemo(() => {
    const sedeMap = new Map<string, number>();
    courses.forEach(r => {
      const l = localLabel(r.local);
      sedeMap.set(l, (sedeMap.get(l) ?? 0) + (Number(r.horas) || 0));
    });
    return {
      horasT:   courses.reduce((s, r) => s + (Number(r.horasT) || 0), 0),
      horasP:   courses.reduce((s, r) => s + (Number(r.horasP) || 0), 0),
      horas:    courses.reduce((s, r) => s + (Number(r.horas)  || 0), 0),
      sedeMap,
      carreras: [...new Set(courses.map(r => r.cod))],
    };
  }, [courses]);

  /* ── Genera el buffer de un workbook para un docente ── */
  const buildWbBuffer = async (
    teacherName: string,
    teacherRows: FICARow[],
    logo64: string | null,
  ): Promise<ArrayBuffer> => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "UAI Portal Académico";
    wb.created = new Date();

    const NAVY  = "FF001F5F";
    const LIGHT = "FFD9E0F1";
    const WHITE = "FFFFFFFF";
    const GRAY  = "FF444444";

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

    const SLOTS = [
      { start: "07:40", end: "08:30" }, { start: "08:30", end: "09:20" },
      { start: "09:20", end: "10:10" }, { start: "10:10", end: "11:00" },
      { start: "11:00", end: "11:50" }, { start: "11:50", end: "12:40" },
      { start: "12:40", end: "13:30" }, { start: "13:30", end: "14:20" },
      { start: "14:20", end: "15:10" }, { start: "15:10", end: "16:00" },
      { start: "16:00", end: "16:50" }, { start: "16:50", end: "17:40" },
      { start: "17:40", end: "18:30" }, { start: "18:30", end: "19:20" },
      { start: "19:20", end: "20:10" }, { start: "20:10", end: "21:00" },
      { start: "21:00", end: "21:50" }, { start: "21:50", end: "22:40" },
      { start: "22:40", end: "23:30" },
    ];
    const FIRST_DATA_ROW = 6;
    const norm = (h: string) => (h ?? "").trim().replace(/\s/g, "");

    function findStartRow(hora: string): number {
      const h = norm(hora);
      const i = SLOTS.findIndex(s => s.start === h);
      if (i >= 0) return FIRST_DATA_ROW + i;
      const fi = SLOTS.findIndex(s => s.start >= h);
      return FIRST_DATA_ROW + (fi >= 0 ? fi : 0);
    }
    function findEndRow(horaFin: string, startRow: number, horas: number): number {
      const h = norm(horaFin);
      const i = SLOTS.findIndex(s => s.end === h);
      if (i >= 0) return FIRST_DATA_ROW + i;
      const slots = Math.round(horas * 60 / 50);
      return startRow + Math.max(slots, 1) - 1;
    }

    const DAY_COL: Record<string, { col: number; col2?: number }> = {
      LUNES:     { col: 2 },
      MARTES:    { col: 3, col2: 4 },
      MIERCOLES: { col: 5 },
      JUEVES:    { col: 6 },
      VIERNES:   { col: 7 },
      SABADO:    { col: 8 },
      DOMINGO:   { col: 9 },
    };

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
    function normDay(d: string): string {
      return d.toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .trim();
    }

    const ws = wb.addWorksheet("Table 1", {
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
    });

    ws.columns = [
      { width: 8    }, { width: 12.66 }, { width: 3     }, { width: 11.5  },
      { width: 15.16}, { width: 17.33 }, { width: 12.66 }, { width: 12.66 },
      { width: 14   }, { width: 2.16  },
    ];

    ws.mergeCells("A1:B1"); ws.mergeCells("C1:I1");
    const r1 = ws.getRow(1); r1.height = 60;
    r1.getCell(1).fill = sf(NAVY);
    const c1title = r1.getCell(3);
    c1title.value = "HORARIO DOCENTE";
    c1title.font  = { bold: true, size: 14, color: { argb: WHITE } };
    c1title.fill  = sf(NAVY);
    c1title.alignment = CTR;

    if (logo64) {
      const imgId = wb.addImage({ base64: logo64, extension: "png" });
      ws.addImage(imgId, {
        tl: { col: 0, row: 0, colOff: 471188, rowOff: 142875 },
        ext: { width: 46, height: 50 },
        editAs: "absolute",
      } as any);
    }

    ws.mergeCells("A3:C3"); ws.mergeCells("D3:J3");
    const r3 = ws.getRow(3); r3.height = 41.25;
    const c3a = r3.getCell(1);
    c3a.value = "Docente:"; c3a.font = { bold: true, size: 9, color: { argb: GRAY } }; c3a.alignment = BOT;
    const c3b = r3.getCell(4);
    c3b.value = `SEMESTRE ACADÉMICO 2026-1\n${teacherName}`;
    c3b.font  = { size: 11, color: { argb: "FF000000" } };
    c3b.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    ws.mergeCells("A4:J4");
    const r4 = ws.getRow(4); r4.height = 14;
    const c4 = r4.getCell(1);
    c4.value = `Programa de estudio:            ${facultyLabel}`;
    c4.font  = { size: 10, color: { argb: "FF000000" } };
    c4.alignment = { horizontal: "left", vertical: "middle" };

    ws.mergeCells("C5:D5");
    const r5 = ws.getRow(5); r5.height = 13.5;
    ([
      [1,"Hora"],[2,"Lunes"],[3,"Martes"],
      [5,"Miércoles"],[6,"Jueves"],[7,"Viernes"],[8,"Sábado"],[9,"Domingo"],
    ] as [number,string][]).forEach(([col, label]) => {
      const cell = r5.getCell(col);
      cell.value = label; cell.fill = sf(NAVY);
      cell.font  = { bold: true, size: 9, color: { argb: WHITE } };
      cell.alignment = CTR; cell.border = THIN;
    });

    const LAST_SLOT_ROW = FIRST_DATA_ROW + SLOTS.length - 1;
    SLOTS.forEach((slot, idx) => {
      const rowNum = FIRST_DATA_ROW + idx;
      const row = ws.getRow(rowNum); row.height = 31.5;
      const ca = row.getCell(1);
      ca.value = `${slot.start}\n${slot.end}`; ca.font = { size: 8, color: { argb: GRAY } };
      ca.alignment = CTR; ca.border = THIN;
      [2,3,4,5,6,7,8,9].forEach(col => {
        const cell = row.getCell(col);
        cell.fill = sf(idx % 2 === 0 ? "FFFAFBFF" : WHITE); cell.border = THIN;
      });
    });

    const COURSE_FILLS = [
      "FFD6E4F7","FFDFF0D8","FFFCE4D6","FFE8D6F7",
      "FFDFF7FC","FFFFE0B2","FFFFE6F0","FFFFE9B3",
    ];
    let fillIdx = 0;
    const courseColors = new Map<string, string>();
    type CourseGroup = { rows: FICARow[]; day: string; dayInfo: { col: number; col2?: number }; startRow: number; endRow: number };
    const grouped = new Map<string, CourseGroup>();

    teacherRows.forEach(row => {
      const dayNorm = normDay(row.dia);
      const dayInfo = DAY_COL[dayNorm];
      if (!dayInfo) return;
      const startRow = findStartRow(row.hora);
      const endRow   = findEndRow(row.horaFin ?? "", startRow, row.horas);
      const groupKey = `${dayNorm}|${row.hora}|${row.horaFin}`;
      if (!grouped.has(groupKey)) grouped.set(groupKey, { rows: [], day: dayNorm, dayInfo, startRow, endRow });
      grouped.get(groupKey)!.rows.push(row);
    });

    grouped.forEach(({ rows: gRows, dayInfo, startRow, endRow }) => {
      const rep = gRows[0];
      const colorKey = `${rep.dia}|${rep.hora}|${rep.horaFin}`;
      if (!courseColors.has(colorKey)) {
        courseColors.set(colorKey, COURSE_FILLS[fillIdx % COURSE_FILLS.length]); fillIdx++;
      }
      const bgColor  = courseColors.get(colorKey)!;
      const secciones = [...new Set(gRows.map(r => r.seccion))].join("/");
      const codLine   = `${rep.cod}_${rep.ciclo}-${secciones}`;
      const cellText  = `${codLine}\n${localLabel(rep.local)}\n${rep.modalidad}\n \n${rep.curso}`;
      const col1 = dayInfo.col, col2 = dayInfo.col2 ?? col1;
      const mergeRef = `${excelAddr(col1, startRow)}:${excelAddr(col2, endRow)}`;
      try { if (startRow !== endRow || col1 !== col2) ws.mergeCells(mergeRef); } catch (_) {}
      const cell = ws.getRow(startRow).getCell(col1);
      cell.value = cellText; cell.font = { size: 8, color: { argb: "FF000000" } };
      cell.fill = sf(bgColor); cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = MED;
    });

    const TOT_ROW = LAST_SLOT_ROW + 1;
    ws.mergeCells(`A${TOT_ROW}:G${TOT_ROW}`);
    const rTot = ws.getRow(TOT_ROW); rTot.height = 22.5;
    rTot.getCell(1).fill = sf(NAVY);
    const ctLabel = rTot.getCell(8);
    ctLabel.value = "TOTAL DE\nHORAS:"; ctLabel.fill = sf(NAVY);
    ctLabel.font = { size: 10, color: { argb: WHITE } }; ctLabel.alignment = CTR; ctLabel.border = THIN;
    const ctVal = rTot.getCell(9);
    ctVal.value = teacherRows.reduce((s, r) => s + r.horas, 0);
    ctVal.fill = sf(LIGHT); ctVal.font = { bold: true, size: 15, color: { argb: NAVY } };
    ctVal.alignment = CTR; ctVal.border = THIN;

    return wb.xlsx.writeBuffer();
  };

  /* ── Descargar Excel individual ── */
  const exportExcel = async () => {
    if (!selected || courses.length === 0) return;
    const logo64 = await fetchLogoBase64();
    const buf  = await buildWbBuffer(selected, courses, logo64);
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `${selected.replace(/\s+/g, "_")}_${faculty}_2026-1.xlsx`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  /* ── Descarga masiva: ZIP con un Excel por docente ── */
  const exportAll = async () => {
    if (teachers.length === 0) return;
    const logo64 = await fetchLogoBase64();
    const zip = new JSZip();
    const folder = zip.folder(`Horarios_${faculty}_2026-1`)!;

    for (let i = 0; i < teachers.length; i++) {
      const t = teachers[i];
      setBulkProgress({ current: i + 1, total: teachers.length });
      const teacherRows = dataCiclo12.filter(
        r => r.docente?.toUpperCase().trim() === t.nombre,
      );
      if (teacherRows.length === 0) continue;
      const buf = await buildWbBuffer(t.nombre, teacherRows, logo64);
      folder.file(`${t.nombre.replace(/\s+/g, "_")}_${faculty}_2026-1.xlsx`, buf);
      await new Promise(r => setTimeout(r, 0));
    }

    const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = `Horarios_${faculty}_2026-1.zip`;
    a.click(); URL.revokeObjectURL(a.href);
    setBulkProgress(null);
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
            Horario por Docente
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${accentColor}`}>
              {faculty}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-500 text-white">
              Ciclos 1 y 2
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {facultySubtitle} · {teachers.length} docentes · Planificación 2026-1
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {selected && (
            <Button onClick={exportExcel} disabled={!!bulkProgress} className="gap-2 bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4" /> Descargar Excel
            </Button>
          )}
          <Button
            onClick={exportAll}
            disabled={!!bulkProgress || teachers.length === 0}
            variant="outline"
            className="gap-2 border-primary text-primary hover:bg-primary/10"
          >
            {bulkProgress ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {bulkProgress.current}/{bulkProgress.total} generando…
              </>
            ) : (
              <>
                <PackageOpen className="w-4 h-4" />
                Descargar Todo ({teachers.length})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Barra de progreso descarga masiva */}
      {bulkProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">
              Generando archivos Excel… {bulkProgress.current} de {bulkProgress.total}
            </span>
            <span className="text-sm text-blue-500 font-semibold">
              {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Buscador */}
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
                    {t.horas}H · {t.horasT}T + {t.horasP}P
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
          {/* Tarjetas resumen */}
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
                <p className="text-xs text-muted-foreground">Por Sede</p>
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex gap-1.5 text-[10px] flex-wrap mb-1.5">
                {[...totals.sedeMap.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([sede, h]) => {
                  const style = LOCAL_BADGE_STYLE[sede];
                  return (
                    <span key={sede}
                      className={`px-1.5 py-0.5 rounded font-semibold text-white ${style?.cls ?? "bg-gray-500"}`}>
                      {style?.label ?? sede} {h}H
                    </span>
                  );
                })}
              </div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {totals.carreras.map(c => (
                  <span key={c} className="text-[10px] font-bold px-1 py-0.5 rounded text-white"
                    style={{ background: CARRERA_COLOR[c] ?? "#555" }}>{c}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Tabla de cursos */}
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
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                          style={{ background: CARRERA_COLOR[row.cod] ?? "#555" }}>
                          {row.cod}
                        </span>
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
