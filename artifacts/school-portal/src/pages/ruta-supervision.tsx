import { useState, useEffect, useMemo } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Route, Search, X, Clock, DoorOpen, FlaskConical,
  Printer, FileSpreadsheet, ChevronDown, Loader2, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import * as ExcelJS from "exceljs";

const NAVY = "#001F5F";
const GOLD = "#C9A84C";

const DIAS_ORDER = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];
const DIAS_LABEL: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles",
  JUEVES: "Jueves", VIERNES: "Viernes", SABADO: "Sábado", DOMINGO: "Domingo",
};
const DIA_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  LUNES:     { bg: "#EFF6FF", text: "#1d4ed8", border: "#bfdbfe" },
  MARTES:    { bg: "#F0FDF4", text: "#15803d", border: "#bbf7d0" },
  MIERCOLES: { bg: "#FFF7ED", text: "#c2410c", border: "#fed7aa" },
  JUEVES:    { bg: "#FDF4FF", text: "#7e22ce", border: "#e9d5ff" },
  VIERNES:   { bg: "#FFF1F2", text: "#be123c", border: "#fecdd3" },
  SABADO:    { bg: "#F0FDFA", text: "#0f766e", border: "#99f6e4" },
  DOMINGO:   { bg: "#FEFCE8", text: "#a16207", border: "#fef08a" },
};
const MODAL_COLOR: Record<string, string> = {
  "PRESENCIAL":        "#15803d",
  "VIRTUAL":           "#1d4ed8",
  "HIBRIDO VIRTUAL":   "#7e22ce",
  "SEMIPRESENCIAL":    "#c2410c",
};

// Color por letra de aula (A=azul, B=verde, C=naranja, D=morado, etc.)
const LETRA_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  B: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  C: { bg: "#ffedd5", text: "#c2410c", border: "#fdba74" },
  D: { bg: "#f3e8ff", text: "#7e22ce", border: "#d8b4fe" },
  E: { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" },
  F: { bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc" },
  G: { bg: "#fef9c3", text: "#854d0e", border: "#fde68a" },
};

interface Row {
  local: string;
  carrera: string;
  carreraFull: string;
  ciclo: string;
  seccion: string;
  codigo: string;
  curso: string;
  modalidadCurso: string;
  docente: string;
  modalidad: string;
  tipo: string;
  dia: string;
  hora: string;
  horaFin: string;
  pabellon?: string;
  aula?: string;
  laboratorio?: string;
  facultad: "FICA" | "FCS";
}

function padH(h: string) {
  return h.replace(/^(\d):/, "0$1:");
}
function toMinutes(h: string) {
  const [hh, mm] = padH(h).split(":").map(Number);
  return hh * 60 + (mm || 0);
}
function normDia(d: string): string {
  const s = (d || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  if (s.startsWith("LUN")) return "LUNES";
  if (s.startsWith("MAR")) return "MARTES";
  if (s.startsWith("MIE")) return "MIERCOLES";
  if (s.startsWith("JUE")) return "JUEVES";
  if (s.startsWith("VIE")) return "VIERNES";
  if (s.startsWith("SAB")) return "SABADO";
  if (s.startsWith("DOM")) return "DOMINGO";
  return s;
}
function normModalidad(m: string): string {
  return (m || "").toString().toUpperCase().trim();
}

// Extrae la letra de pabellón al final del nombre del aula (e.g. "AULA 301 A" → "A")
function extractLetra(aula?: string, lab?: string): string {
  const s = (aula || lab || "").trim();
  const m = s.match(/\b([A-Z])\s*$/i);
  return m ? m[1].toUpperCase() : "";
}

// Extrae el número de aula (e.g. "AULA 301 A" → 301)
function extractNumero(aula?: string, lab?: string): number {
  const s = (aula || lab || "");
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1]) : 9999;
}

// Convertir minutos a HH:MM
function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Fila enriquecida con datos de visita programada
interface VisitRow extends Row {
  letra: string;       // pabellón A, B, C... ("" si no tiene aula física)
  orden: number;       // # de visita en la ruta del día
  entrada: string;     // hora de entrada del supervisor (HH:MM)
  salida: string;      // hora de salida (HH:MM)
  entradaMin: number;
  salidaMin: number;
}

// Fila omitida (no entró en la ruta) con motivo
interface OmittedRow extends Row {
  letra: string;
  motivo: string;     // ej: "El supervisor llegaría 09:40, clase termina 09:20"
  llegadaMin: number; // hora a la que el supervisor habría llegado
}

// ID estable para marcar visitas como supervisadas
function visitId(r: Pick<Row, "dia" | "docente" | "curso" | "seccion" | "hora">) {
  return `${r.dia}|${r.docente}|${r.curso}|${r.seccion}|${r.hora}`;
}

const SUPERVISADOS_KEY = "ruta-supervision:supervisados:v1";

export default function RutaSupervision() {
  const [allData,   setAllData]   = useState<Row[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [facultad,  setFacultad]  = useState("TODAS");
  const [local,     setLocal]     = useState("TODOS");
  const [ciclo,     setCiclo]     = useState("TODOS");
  const [diaFiltro, setDiaFiltro] = useState("TODOS");
  const MODALIDADES = ["PRESENCIAL", "HIBRIDO PRESENCIAL", "VIRTUAL", "HIBRIDO VIRTUAL"] as const;
  const MODALIDAD_LABEL: Record<string, string> = {
    "PRESENCIAL":         "Presencial",
    "HIBRIDO PRESENCIAL": "Híbrido presencial",
    "VIRTUAL":            "Virtual",
    "HIBRIDO VIRTUAL":    "Híbrido virtual",
  };
  const [modalidadesSel, setModalidadesSel] = useState<Set<string>>(new Set());
  const toggleModalidad = (m: string) => {
    setModalidadesSel(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  };
  const [search, setSearch] = useState("");
  const [duracionMin, setDuracionMin] = useState(60); // duración de visita por aula

  // Visitas marcadas como "ya supervisadas" — se persisten en localStorage
  const [supervisados, setSupervisados] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(SUPERVISADOS_KEY);
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch { return new Set(); }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SUPERVISADOS_KEY, JSON.stringify(Array.from(supervisados)));
    } catch { /* ignore */ }
  }, [supervisados]);
  const toggleSupervisado = (id: string) => {
    setSupervisados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const limpiarSupervisados = () => {
    if (window.confirm("¿Borrar todas las marcas de supervisado?")) {
      setSupervisados(new Set());
    }
  };

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}planificacion-fica-2026-1.json`).then(r => r.json()),
      fetch(`${base}planificacion-fcs-2026-1.json`).then(r  => r.json()),
    ]).then(([fica, fcs]) => {
      const norm = (rows: Omit<Row, "facultad">[], fac: "FICA" | "FCS"): Row[] =>
        rows.map(r => ({
          ...r,
          facultad:  fac,
          dia:       normDia(r.dia),
          modalidad: normModalidad(r.modalidad),
        }));
      setAllData([...norm(fica as Omit<Row, "facultad">[], "FICA"),
                  ...norm(fcs  as Omit<Row, "facultad">[], "FCS")]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const locales = useMemo(() => {
    const base = allData.filter(r => facultad === "TODAS" || r.facultad === facultad);
    return ["TODOS", ...Array.from(new Set(base.map(r => r.local))).sort()];
  }, [allData, facultad]);

  const ciclos = useMemo(() => {
    const base = allData.filter(r =>
      (facultad === "TODAS" || r.facultad === facultad) &&
      (local    === "TODOS" || r.local    === local)
    );
    return ["TODOS", ...Array.from(new Set(base.map(r => r.ciclo)))
      .sort((a, b) => Number(a) - Number(b))];
  }, [allData, facultad, local]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    // Importante: el filtro de DÍA se aplica DESPUÉS de la dedup semanal,
    // para que la regla "cada docente aparece una vez en toda la semana"
    // se mantenga incluso al filtrar por un día específico.
    const base = allData.filter(r => {
      if (facultad  !== "TODAS" && r.facultad !== facultad)  return false;
      if (local     !== "TODOS" && r.local    !== local)     return false;
      if (ciclo     !== "TODOS" && r.ciclo    !== ciclo)     return false;
      if (modalidadesSel.size > 0 && modalidadesSel.size < MODALIDADES.length) {
        if (!modalidadesSel.has(r.modalidad)) return false;
      }
      if (q) {
        const hay = `${r.carreraFull} ${r.seccion} ${r.curso} ${r.docente} ${r.ciclo} ${r.local} ${r.aula ?? ""} ${r.laboratorio ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Cada docente aparece UNA SOLA VEZ en toda la semana, en su clase más
    // temprana (primero por orden de día Lunes→Domingo, luego por hora).
    // Así la ruta del Martes contiene docentes distintos a los del Lunes.
    const rank = (r: Row) => {
      const di = DIAS_ORDER.indexOf(r.dia);
      const dayKey = di === -1 ? 999 : di;
      return dayKey * 10000 + toMinutes(r.hora);
    };
    const earliest = new Map<string, Row>();
    for (const r of base) {
      const prev = earliest.get(r.docente);
      if (!prev || rank(r) < rank(prev)) {
        earliest.set(r.docente, r);
      }
    }
    const dedup = Array.from(earliest.values());

    // Ahora aplicamos el filtro de día sobre el conjunto deduplicado
    if (diaFiltro === "TODOS") return dedup;
    return dedup.filter(r => r.dia === diaFiltro);
  }, [allData, facultad, local, ciclo, diaFiltro, modalidadesSel, search]);

  // Planificador de ruta: agrupa por día, recorre todos los pabellones A primero,
  // luego B, C, D... y calcula entrada/salida sucesivas con visitas de `duracionMin`.
  // Las clases que ya terminaron cuando el supervisor podría llegar se registran
  // en `omitted` junto con el motivo.
  const planning = useMemo(() => {
    const visits  = new Map<string, VisitRow[]>();
    const omitted = new Map<string, OmittedRow[]>();
    DIAS_ORDER.forEach(d => { visits.set(d, []); omitted.set(d, []); });

    const dayGroups = new Map<string, Row[]>();
    for (const r of filtered) {
      if (!dayGroups.has(r.dia)) dayGroups.set(r.dia, []);
      dayGroups.get(r.dia)!.push(r);
    }

    for (const [dia, rows] of dayGroups) {
      const byLetter = new Map<string, Row[]>();
      for (const r of rows) {
        const letra = extractLetra(r.aula, r.laboratorio) || "Z";
        if (!byLetter.has(letra)) byLetter.set(letra, []);
        byLetter.get(letra)!.push(r);
      }

      const letrasSorted = Array.from(byLetter.keys()).sort();
      const dayVisits: VisitRow[] = [];
      const dayOmitted: OmittedRow[] = [];
      let currentMin = -Infinity;
      let orden = 1;

      for (const letra of letrasSorted) {
        const groupRows = byLetter.get(letra)!.slice().sort((a, b) => {
          const ta = toMinutes(a.hora), tb = toMinutes(b.hora);
          if (ta !== tb) return ta - tb;
          return extractNumero(a.aula, a.laboratorio) - extractNumero(b.aula, b.laboratorio);
        });

        for (const r of groupRows) {
          const claseInicio = toMinutes(r.hora);
          const claseFin    = toMinutes(r.horaFin);
          const entradaMin  = Math.max(claseInicio, currentMin);

          // Clase ya terminó cuando el supervisor llegaría → omitir
          if (entradaMin >= claseFin) {
            dayOmitted.push({
              ...r,
              letra: letra === "Z" ? "" : letra,
              llegadaMin: entradaMin,
              motivo: `Llegada ${minToHHMM(entradaMin)} · clase termina ${padH(r.horaFin)}`,
            });
            continue;
          }

          const salidaMin = Math.min(entradaMin + duracionMin, claseFin);
          dayVisits.push({
            ...r,
            letra: letra === "Z" ? "" : letra,
            orden: orden++,
            entradaMin,
            salidaMin,
            entrada: minToHHMM(entradaMin),
            salida:  minToHHMM(salidaMin),
          });
          currentMin = salidaMin;
        }
      }

      visits.set(dia, dayVisits);
      omitted.set(dia, dayOmitted);
    }
    return { visits, omitted };
  }, [filtered, duracionMin]);

  const byDay         = planning.visits;
  const omittedByDay  = planning.omitted;
  const diasConClases = DIAS_ORDER.filter(d => (byDay.get(d) ?? []).length > 0 || (omittedByDay.get(d) ?? []).length > 0);
  const totalVisitas  = Array.from(byDay.values()).reduce((s, v) => s + v.length, 0);
  const totalOmitidas = Array.from(omittedByDay.values()).reduce((s, v) => s + v.length, 0);
  const totalAulas    = new Set(filtered.map(r => r.aula || r.laboratorio || "virtual").filter(Boolean)).size;
  const totalDocentes = new Set(filtered.map(r => r.docente)).size;

  // Progreso de supervisión sobre las visitas actuales
  const visitIdsActuales = useMemo(() => {
    const ids = new Set<string>();
    for (const v of byDay.values()) for (const r of v) ids.add(visitId(r));
    return ids;
  }, [byDay]);
  const supervisadosActuales = Array.from(supervisados).filter(id => visitIdsActuales.has(id)).length;
  const progresoPct = totalVisitas > 0 ? Math.round((supervisadosActuales / totalVisitas) * 100) : 0;

  const filterLabel = [
    facultad  !== "TODAS" ? `Facultad: ${facultad}` : null,
    local     !== "TODOS" ? `Local: ${local}`        : null,
    ciclo     !== "TODOS" ? `Ciclo: ${ciclo}`        : null,
    diaFiltro !== "TODOS" ? `Día: ${DIAS_LABEL[diaFiltro]}` : null,
    modalidadesSel.size > 0 && modalidadesSel.size < MODALIDADES.length
      ? `Modalidad: ${Array.from(modalidadesSel).map(m => MODALIDAD_LABEL[m] ?? m).join(" + ")}`
      : null,
  ].filter(Boolean).join(" · ") || "Todos los filtros";

  const exportExcel = async () => {
    const NAVY_X = "FF001F5F";
    const WHITE  = "FFFFFFFF";
    const sf = (a: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: a } });
    const CTR  = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
    const LEFT = { horizontal: "left"   as const, vertical: "middle" as const, wrapText: true };
    const THIN: Partial<ExcelJS.Borders> = {
      top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" },
    };

    const wb = new ExcelJS.Workbook();
    const headers = ["#", "ENTRADA", "SALIDA", "AULA", "LABORATORIO", "LETRA", "CLASE INI", "CLASE FIN", "CARRERA", "CICLO", "SECCIÓN", "CURSO", "TIPO", "DOCENTE", "MODALIDAD", "LOCAL"];
    const widths  = [5, 10, 10, 14, 16, 7, 10, 10, 38, 7, 10, 36, 8, 36, 14, 12];

    const buildSheet = (name: string, rows: VisitRow[], includeDia = false) => {
      const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 3 }] });
      const fullHeaders = includeDia ? ["DÍA", ...headers] : headers;
      const fullWidths  = includeDia ? [12, ...widths]    : widths;
      ws.columns = fullWidths.map(w => ({ width: w }));
      const lastCol = fullHeaders.length;

      ws.mergeCells(1, 1, 1, lastCol);
      const t = ws.getCell(1, 1);
      t.value = `UNIVERSIDAD AUTÓNOMA DE ICA — RUTA DE SUPERVISIÓN · 2026-I · Visitas de ${duracionMin} min`;
      t.font = { bold: true, size: 13, color: { argb: WHITE } };
      t.fill = sf(NAVY_X); t.alignment = CTR; t.border = THIN;
      ws.getRow(1).height = 26;

      ws.mergeCells(2, 1, 2, lastCol);
      const s = ws.getCell(2, 1);
      s.value = `Filtros: ${filterLabel}   ·   ${rows.length} visitas`;
      s.font = { italic: true, size: 10, color: { argb: "FF555555" } };
      s.alignment = LEFT; s.border = THIN;
      ws.getRow(2).height = 18;

      fullHeaders.forEach((h, i) => {
        const c = ws.getRow(3).getCell(i + 1);
        c.value = h; c.font = { bold: true, size: 10, color: { argb: WHITE } };
        c.fill = sf(NAVY_X); c.alignment = CTR; c.border = THIN;
      });
      ws.getRow(3).height = 22;

      let ri = 4;
      for (const row of rows) {
        const rr = ws.getRow(ri);
        let off = 0;
        if (includeDia) { rr.getCell(1).value = DIAS_LABEL[row.dia] ?? row.dia; off = 1; }
        rr.getCell(off + 1).value  = row.orden;
        rr.getCell(off + 2).value  = row.entrada;
        rr.getCell(off + 3).value  = row.salida;
        rr.getCell(off + 4).value  = row.aula || "";
        rr.getCell(off + 5).value  = row.laboratorio || "";
        rr.getCell(off + 6).value  = row.letra || "—";
        rr.getCell(off + 7).value  = padH(row.hora);
        rr.getCell(off + 8).value  = padH(row.horaFin);
        rr.getCell(off + 9).value  = row.carreraFull || row.carrera;
        rr.getCell(off + 10).value = row.ciclo;
        rr.getCell(off + 11).value = row.seccion;
        rr.getCell(off + 12).value = row.curso;
        rr.getCell(off + 13).value = row.tipo;
        rr.getCell(off + 14).value = row.docente;
        rr.getCell(off + 15).value = row.modalidad;
        rr.getCell(off + 16).value = row.local;
        for (let c = 1; c <= lastCol; c++) {
          rr.getCell(c).border = THIN;
          rr.getCell(c).font = { size: 10 };
          // CARRERA, CURSO, DOCENTE alineados a la izquierda
          const colIdx = c - off;
          rr.getCell(c).alignment = (colIdx === 9 || colIdx === 12 || colIdx === 14) ? LEFT : CTR;
        }
        rr.height = 18;
        ri++;
      }
      ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, ri - 1), column: lastCol } };
    };

    // Hoja resumen con todas las visitas de todos los días
    const allVisits: VisitRow[] = [];
    for (const dia of diasConClases) {
      allVisits.push(...(byDay.get(dia) ?? []));
    }
    buildSheet("Resumen", allVisits, true);
    for (const dia of diasConClases) {
      buildSheet(DIAS_LABEL[dia], byDay.get(dia) ?? []);
    }

    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a    = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Ruta_Supervision_UAI_2026-1.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const printRuta = async () => {
    const base    = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const logoUrl = `${window.location.origin}${base}/logo-uai.png`;
    let logoData  = "";
    try {
      const res  = await fetch(logoUrl);
      const blob = await res.blob();
      logoData   = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { logoData = ""; }

    const diasHtml = diasConClases.map(dia => {
      const rows = byDay.get(dia) ?? [];
      const col  = DIA_COLOR[dia] ?? { bg: "#f8fafc", text: "#334155", border: "#e2e8f0" };
      const cellStyle = `border-bottom:1px solid ${col.border};border-right:1px solid ${col.border};padding:4px 7px;vertical-align:middle;`;
      const rowsHtml = rows.map((r, i) => {
        const lc = LETRA_COLOR[r.letra] ?? { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1" };
        return `
        <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#ffffff"};">
          <td style="${cellStyle}white-space:nowrap;text-align:center;font-weight:900;color:${col.text};font-size:11px;">${r.orden}</td>
          <td style="${cellStyle}white-space:nowrap;text-align:center;">
            <span style="background:${lc.bg};color:${lc.text};padding:2px 6px;border-radius:4px;font-size:9px;font-weight:800;border:1px solid ${lc.border};display:inline-block;line-height:1.1;">
              ${r.entrada}<br/><span style="font-size:7px;opacity:0.6;">↓</span><br/>${r.salida}
            </span>
          </td>
          <td style="${cellStyle}font-size:8px;">
            ${r.aula    ? `<span style="background:${lc.bg};color:${lc.text};padding:1px 6px;border-radius:4px;font-size:8px;font-weight:800;border:1px solid ${lc.border};display:inline-block;">${r.aula}</span>` : ""}
            ${r.laboratorio ? `<span style="background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:4px;font-size:8px;font-weight:800;border:1px solid #6ee7b7;display:inline-block;">${r.laboratorio}</span>` : ""}
            ${!r.aula && !r.laboratorio ? `<span style="color:#94a3b8;font-size:7px;">${r.modalidad}</span>` : ""}
          </td>
          <td style="${cellStyle}white-space:nowrap;font-size:7px;color:#94a3b8;">${padH(r.hora)}<br/>${padH(r.horaFin)}</td>
          <td style="${cellStyle}font-size:8px;">
            <span style="background:#001F5F;color:white;padding:1px 5px;border-radius:3px;font-size:7px;font-weight:700;display:inline-block;margin-bottom:2px;">${r.carreraFull}</span><br/>
            <span style="background:#C9A84C;color:#001F5F;padding:1px 5px;border-radius:3px;font-size:7px;font-weight:700;display:inline-block;">C${r.ciclo}·${r.seccion}</span>
          </td>
          <td style="${cellStyle}font-size:8px;font-weight:600;">${r.curso} <span style="color:#94a3b8;font-weight:400;">(${r.tipo})</span></td>
          <td style="${cellStyle}font-size:8px;color:#475569;">${r.docente}</td>
          <td style="${cellStyle}font-size:7px;color:#64748b;border-right:none;">${r.local}</td>
        </tr>`;
      }).join("");

      return `
        <div style="margin-bottom:16px;">
          <div style="background:${col.text};color:white;padding:6px 12px;display:flex;align-items:center;justify-content:space-between;break-after:avoid;page-break-after:avoid;">
            <span style="font-weight:800;font-size:12px;">${DIAS_LABEL[dia]}</span>
            <span style="background:white;color:${col.text};padding:2px 10px;border-radius:20px;font-size:9px;font-weight:700;">${rows.length} visita${rows.length !== 1 ? "s" : ""} · ${duracionMin} min c/u</span>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid ${col.border};border-top:none;">
            <thead style="display:table-header-group;">
              <tr style="background:${col.bg};">
                <th style="padding:4px 6px;text-align:center;font-size:8px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">#</th>
                <th style="padding:4px 6px;text-align:center;font-size:8px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};white-space:nowrap;">VISITA</th>
                <th style="padding:4px 6px;text-align:left;font-size:8px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">AULA / LAB</th>
                <th style="padding:4px 6px;text-align:left;font-size:8px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">CLASE</th>
                <th style="padding:4px 6px;text-align:left;font-size:8px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">CARRERA / CICLO</th>
                <th style="padding:4px 6px;text-align:left;font-size:8px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">CURSO</th>
                <th style="padding:4px 6px;text-align:left;font-size:8px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">DOCENTE</th>
                <th style="padding:4px 6px;text-align:left;font-size:8px;color:${col.text};font-weight:700;border-bottom:1px solid ${col.border};">LOCAL</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Ruta de Supervisión · UAI 2026-I</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; padding: 24px; background: white; color: #1e293b; }
    @media print {
      body { padding: 12px; }
      @page { margin: 1cm; size: A4 landscape; }
    }
    .no-print { display: flex; justify-content: flex-end; margin-bottom: 16px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="background:#001F5F;color:white;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold;">🖨️ Imprimir / Guardar PDF</button>
  </div>
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #001F5F;">
    ${logoData ? `<img src="${logoData}" style="height:52px;width:auto;object-fit:contain;flex-shrink:0;" alt="UAI" />` : ""}
    <div>
      <h1 style="font-size:18px;font-weight:900;color:#001F5F;">RUTA DE SUPERVISIÓN · 2026-I</h1>
      <p style="font-size:11px;color:#64748b;margin-top:2px;">Universidad Autónoma de Ica · Filtros: ${filterLabel}</p>
      <p style="font-size:10px;color:#94a3b8;">Total: <b>${totalVisitas} visitas</b> · ${diasConClases.length} días · ${totalDocentes} docentes · ${totalAulas} aulas${totalOmitidas > 0 ? ` · ${totalOmitidas} omitidas` : ""}</p>
      <p style="font-size:9px;color:#94a3b8;margin-top:2px;">Recorrido: todas las aulas A → luego B → C → D... · Visitas de ${duracionMin} min (se ajusta al fin de clase)</p>
    </div>
  </div>
  ${diasHtml}
  <p style="text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;">Generado el ${new Date().toLocaleDateString("es-PE", { day:"2-digit", month:"long", year:"numeric" })}</p>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando horarios...
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Encabezado */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
          <Route className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: NAVY }}>Ruta de Supervisión</h1>
          <p className="text-xs text-muted-foreground">
            Recorre primero todas las aulas <b>A</b>, luego <b>B</b>, <b>C</b>, <b>D</b>... ·
            Visitas de <b>{duracionMin} min</b> por aula · 2026-I
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {supervisadosActuales > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={limpiarSupervisados}
              title="Borrar todas las marcas de supervisado"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Limpiar marcas ({supervisadosActuales})
            </Button>
          )}
          <Button
            size="sm"
            className="text-white font-semibold bg-emerald-600 hover:bg-emerald-700"
            onClick={exportExcel}
            disabled={diasConClases.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Excel
          </Button>
          <Button
            size="sm"
            className="text-white font-semibold"
            style={{ background: NAVY }}
            onClick={printRuta}
            disabled={diasConClases.length === 0}
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Visitas",      value: totalVisitas,         color: NAVY       },
          { label: "Docentes",     value: totalDocentes,        color: "#7e22ce"  },
          { label: "Aulas",        value: totalAulas,           color: "#059669"  },
          { label: "Omitidas",     value: totalOmitidas,        color: "#dc2626"  },
        ].map(s => (
          <Card key={s.label} className="shadow-sm">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
        {/* Progreso de supervisión */}
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold" style={{ color: "#15803d" }}>
              {supervisadosActuales}<span className="text-sm text-slate-400">/{totalVisitas}</span>
            </p>
            <p className="text-xs text-muted-foreground">Supervisados ({progresoPct}%)</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full transition-all"
                style={{ width: `${progresoPct}%`, background: "#15803d" }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leyenda de letras */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Pabellones:</span>
        {Object.entries(LETRA_COLOR).map(([letra, lc]) => (
          <span
            key={letra}
            className="text-xs font-bold px-2.5 py-0.5 rounded-full border"
            style={{ background: lc.bg, color: lc.text, borderColor: lc.border }}
          >
            {letra}
          </span>
        ))}
        <span className="text-xs text-slate-400 ml-1">→ el supervisor recorre A primero, luego B, C, D...</span>

        <div className="ml-auto flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-600 font-medium">Duración por aula:</span>
          <Select value={String(duracionMin)} onValueChange={v => setDuracionMin(Number(v))}>
            <SelectTrigger className="h-7 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="45">45 min</SelectItem>
              <SelectItem value="60">60 min</SelectItem>
              <SelectItem value="75">75 min</SelectItem>
              <SelectItem value="90">90 min</SelectItem>
              <SelectItem value="120">2 horas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filtros */}
      <Card className="shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Select value={facultad} onValueChange={v => { setFacultad(v); setLocal("TODOS"); setCiclo("TODOS"); }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Facultad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas las facultades</SelectItem>
                <SelectItem value="FICA">FICA</SelectItem>
                <SelectItem value="FCS">FCS</SelectItem>
              </SelectContent>
            </Select>

            <Select value={local} onValueChange={v => { setLocal(v); setCiclo("TODOS"); }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Local" />
              </SelectTrigger>
              <SelectContent>
                {locales.map(l => (
                  <SelectItem key={l} value={l}>{l === "TODOS" ? "Todos los locales" : l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={ciclo} onValueChange={setCiclo}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Ciclo" />
              </SelectTrigger>
              <SelectContent>
                {ciclos.map(c => (
                  <SelectItem key={c} value={c}>
                    {c === "TODOS" ? "Todos los ciclos" : `Ciclo ${c}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={diaFiltro} onValueChange={setDiaFiltro}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Día" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los días</SelectItem>
                {DIAS_ORDER.map(d => (
                  <SelectItem key={d} value={d}>{DIAS_LABEL[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-9 text-xs border rounded-md px-3 bg-white flex items-center justify-between gap-2 min-w-0"
                >
                  <span className="truncate">
                    {modalidadesSel.size === 0 || modalidadesSel.size === MODALIDADES.length
                      ? "Todas las modalidades"
                      : modalidadesSel.size === 1
                        ? MODALIDAD_LABEL[Array.from(modalidadesSel)[0]] ?? Array.from(modalidadesSel)[0]
                        : `${modalidadesSel.size} modalidades`}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="flex items-center justify-between px-2 pb-1 mb-1 border-b">
                  <span className="text-[11px] font-medium text-muted-foreground">Modalidades</span>
                  <button
                    type="button"
                    className="text-[11px] text-blue-600 hover:underline"
                    onClick={() => setModalidadesSel(new Set())}
                  >
                    Limpiar
                  </button>
                </div>
                {MODALIDADES.map(m => (
                  <label
                    key={m}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    <Checkbox
                      checked={modalidadesSel.has(m)}
                      onCheckedChange={() => toggleModalidad(m)}
                    />
                    <span>{MODALIDAD_LABEL[m]}</span>
                  </label>
                ))}
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-1 border rounded-md px-2 py-1 bg-white h-9">
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Carrera, aula, docente..."
                className="text-xs outline-none flex-1 bg-transparent min-w-0"
              />
              {search && (
                <X className="w-3.5 h-3.5 cursor-pointer text-muted-foreground flex-shrink-0"
                   onClick={() => setSearch("")} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de resultados */}
      {diasConClases.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            No se encontraron clases con los filtros seleccionados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {diasConClases.map(dia => {
            const rows = byDay.get(dia) ?? [];
            const col  = DIA_COLOR[dia] ?? { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" };
            return (
              <Card key={dia} className="shadow-sm overflow-hidden" style={{ borderColor: col.border }}>
                <CardHeader
                  className="py-3 px-5 flex flex-row items-center gap-3"
                  style={{ background: col.bg, borderBottom: `1px solid ${col.border}` }}
                >
                  <Eye className="w-4 h-4 flex-shrink-0" style={{ color: col.text }} />
                  <CardTitle className="text-sm font-bold m-0" style={{ color: col.text }}>
                    {DIAS_LABEL[dia]}
                  </CardTitle>
                  <span
                    className="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: col.text, color: "white" }}
                  >
                    {rows.length} visita{rows.length !== 1 ? "s" : ""}
                  </span>
                  {(omittedByDay.get(dia) ?? []).length > 0 && (
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }}
                    >
                      {(omittedByDay.get(dia) ?? []).length} omitida{(omittedByDay.get(dia) ?? []).length !== 1 ? "s" : ""}
                    </span>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr style={{ background: col.bg, borderBottom: `2px solid ${col.border}` }}>
                          {["✓", "#", "VISITA", "AULA / LAB", "CLASE", "CARRERA / CICLO", "CURSO", "DOCENTE", "LOCAL"].map(h => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-bold whitespace-nowrap"
                              style={{ color: col.text, borderRight: `1px solid ${col.border}` }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const letra = r.letra;
                          const lc    = LETRA_COLOR[letra] ?? { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1" };
                          const isEven = i % 2 === 0;
                          const cellBorder = `1px solid #e2e8f0`;
                          const id      = visitId(r);
                          const checked = supervisados.has(id);
                          return (
                            <tr
                              key={id}
                              style={{
                                background: checked ? "#ecfdf5" : (isEven ? "white" : "#f8fafc"),
                                borderBottom: cellBorder,
                                opacity: checked ? 0.6 : 1,
                              }}
                              className="hover:bg-slate-100 transition-colors"
                            >
                              {/* CHECKBOX supervisado */}
                              <td
                                className="px-3 py-2.5 align-middle text-center"
                                style={{ borderRight: cellBorder, minWidth: 40 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleSupervisado(id)}
                                  className="h-5 w-5"
                                  aria-label={`Marcar como supervisado: ${r.docente} - ${r.curso} (${DIAS_LABEL[r.dia] ?? r.dia} ${r.entrada})`}
                                />
                              </td>

                              {/* ORDEN # */}
                              <td
                                className="px-3 py-2.5 align-middle text-center font-extrabold"
                                style={{ borderRight: cellBorder, color: col.text, minWidth: 36, fontSize: 13, textDecoration: checked ? "line-through" : "none" }}
                              >
                                {r.orden}
                              </td>

                              {/* VISITA programada (entrada → salida) */}
                              <td
                                className="px-3 py-2.5 whitespace-nowrap align-middle"
                                style={{ borderRight: cellBorder, minWidth: 110 }}
                              >
                                <div
                                  className="inline-flex flex-col items-center px-2 py-1 rounded-md font-bold"
                                  style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}`, minWidth: 78 }}
                                >
                                  <span className="text-[12px] leading-tight">{r.entrada}</span>
                                  <span className="text-[8px] opacity-60 leading-none">↓</span>
                                  <span className="text-[12px] leading-tight">{r.salida}</span>
                                </div>
                              </td>

                              {/* AULA / LAB — columna destacada */}
                              <td className="px-3 py-2.5 align-middle" style={{ borderRight: cellBorder, minWidth: 110 }}>
                                <div className="flex flex-col gap-1">
                                  {r.aula && (
                                    <span
                                      className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md w-fit"
                                      style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}
                                    >
                                      <DoorOpen className="w-3.5 h-3.5" />
                                      {r.aula}
                                    </span>
                                  )}
                                  {r.laboratorio && (
                                    <span
                                      className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md w-fit"
                                      style={{ background: "#d1fae5", color: "#065f46", border: "1px solid #6ee7b7" }}
                                    >
                                      <FlaskConical className="w-3.5 h-3.5" />
                                      {r.laboratorio}
                                    </span>
                                  )}
                                  {!r.aula && !r.laboratorio && (
                                    <span
                                      className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md w-fit font-medium"
                                      style={{ background: "#f1f5f9", color: "#94a3b8" }}
                                    >
                                      {r.modalidad}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* CLASE — horario real de la clase */}
                              <td
                                className="px-3 py-2.5 whitespace-nowrap align-middle text-[10px] text-slate-500 font-medium"
                                style={{ borderRight: cellBorder, minWidth: 78 }}
                              >
                                <div className="flex flex-col items-start leading-tight">
                                  <span>{padH(r.hora)}</span>
                                  <span className="text-[8px] text-slate-300">↓</span>
                                  <span>{padH(r.horaFin)}</span>
                                </div>
                              </td>

                              {/* CARRERA / CICLO */}
                              <td className="px-3 py-2.5 align-middle" style={{ borderRight: cellBorder, minWidth: 160 }}>
                                <div className="flex flex-col gap-1">
                                  <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white w-fit"
                                    style={{ background: NAVY }}
                                  >
                                    {r.carreraFull.length > 32
                                      ? r.carreraFull.split(" ").slice(0, 4).join(" ")
                                      : r.carreraFull}
                                  </span>
                                  <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md w-fit"
                                    style={{ background: GOLD, color: NAVY }}
                                  >
                                    Ciclo {r.ciclo} · {r.seccion}
                                  </span>
                                  <span
                                    className="text-[10px] px-2 py-0.5 rounded-md font-medium w-fit"
                                    style={{
                                      background: `${MODAL_COLOR[r.modalidad] ?? "#64748b"}22`,
                                      color: MODAL_COLOR[r.modalidad] ?? "#64748b",
                                    }}
                                  >
                                    {r.modalidad}
                                  </span>
                                </div>
                              </td>

                              {/* CURSO */}
                              <td className="px-3 py-2.5 align-middle" style={{ borderRight: cellBorder, minWidth: 200 }}>
                                <p className="font-semibold text-slate-700">{r.curso}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">({r.tipo})</p>
                              </td>

                              {/* DOCENTE */}
                              <td className="px-3 py-2.5 align-middle" style={{ borderRight: cellBorder, minWidth: 180 }}>
                                <p className="text-slate-600">{r.docente}</p>
                              </td>

                              {/* LOCAL */}
                              <td className="px-3 py-2.5 align-middle text-center" style={{ minWidth: 90 }}>
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded"
                                  style={{ background: "#f1f5f9", color: "#64748b" }}
                                >
                                  {r.local}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}

                  {/* Panel de clases omitidas (no entran en la ruta) */}
                  {(omittedByDay.get(dia) ?? []).length > 0 && (
                    <details className="border-t border-rose-100 bg-rose-50/40">
                      <summary className="cursor-pointer px-5 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 select-none flex items-center gap-2">
                        <ChevronDown className="w-3.5 h-3.5" />
                        Clases omitidas en este día ({(omittedByDay.get(dia) ?? []).length})
                      </summary>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-rose-100/60 border-b border-rose-200">
                              {["HORA", "AULA / LAB", "CURSO", "DOCENTE", "MOTIVO"].map(h => (
                                <th key={h} className="px-3 py-1.5 text-left font-bold text-rose-800 border-r border-rose-200">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(omittedByDay.get(dia) ?? []).map((o, i) => (
                              <tr key={i} className="border-b border-rose-100 hover:bg-rose-50">
                                <td className="px-3 py-2 align-middle whitespace-nowrap text-slate-700 font-mono">
                                  {padH(o.hora)}–{padH(o.horaFin)}
                                </td>
                                <td className="px-3 py-2 align-middle whitespace-nowrap text-slate-600">
                                  {o.aula || o.laboratorio || <span className="text-slate-400">{o.modalidad}</span>}
                                </td>
                                <td className="px-3 py-2 align-middle text-slate-700 font-medium">{o.curso}</td>
                                <td className="px-3 py-2 align-middle text-slate-600">{o.docente}</td>
                                <td className="px-3 py-2 align-middle text-rose-700 text-[11px]">{o.motivo}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
