import React, { useState, useEffect, useMemo, useRef } from "react";
import * as ExcelJS from "exceljs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Search, Users, Download, Loader2, MapPin, Layers,
  ChevronDown, Check, Eye, ChevronLeft, ChevronRight, ArrowRight,
} from "lucide-react";

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
  EN: "Enfermería", OB: "Obstetricia", PS: "Psicología",
};
const CARRERAS_SUNAMPE: Record<string, string> = {
  MH: "Medicina Humana", OB: "Obstetricia", PS: "Psicología",
  T1: "Tec. Méd. - Lab. Clínico", T3: "Tec. Méd. - Terapia Física",
  T4: "Tec. Méd. - Terapia del Lenguaje",
};
const CARRERAS_FULL: Record<string, string> = {
  EN: "ENFERMERÍA", OB: "OBSTETRICIA", PS: "PSICOLOGÍA",
  MH: "MEDICINA HUMANA", T1: "TEC. MÉD. - LAB. CLÍNICO",
  T3: "TEC. MÉD. - TERAPIA FÍSICA", T4: "TEC. MÉD. - TERAPIA DEL LENGUAJE",
};
const DIA_ORDER: Record<string, number> = {
  LUNES: 1, MARTES: 2, MIERCOLES: 3, MIÉRCOLES: 3,
  JUEVES: 4, VIERNES: 5, SABADO: 6, SÁBADO: 6, DOMINGO: 7,
};
const DAYS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];
const DAYS_LABEL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
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
const DAY_COLS: Record<string, number> = {
  LUNES: 2, MARTES: 3, MIERCOLES: 4, JUEVES: 5, VIERNES: 6, SABADO: 7, DOMINGO: 8,
};

function baseSeccion(s: string) { return s.replace(/\d+$/, ""); }
function normDia(d: string) {
  return d.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
function slotIdx(hora: string) {
  const h = hora.trim();
  const i = SLOTS.findIndex(s => s.start === h);
  if (i >= 0) return i;
  const j = SLOTS.findIndex(s => s.start >= h);
  return j >= 0 ? j : 0;
}
function slotEndIdx(horaFin: string) {
  const h = horaFin.trim();
  const i = SLOTS.findIndex(s => s.end === h);
  if (i >= 0) return i;
  const j = SLOTS.findIndex(s => s.end >= h);
  return j >= 0 ? j : SLOTS.length - 1;
}
function turnoLabel(hora: string) {
  if (!hora) return "MAÑANA";
  const h = parseInt(hora.split(":")[0]);
  if (h < 13) return "MAÑANA";
  if (h < 18) return "TARDE";
  return "NOCHE";
}
function modalidadBadge(m: string) {
  const n = m.toUpperCase().trim();
  if (n.includes("VIRTUAL"))
    return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">Virtual</Badge>;
  if (n.includes("HIBRIDO") || n.includes("HÍBRIDO"))
    return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">Híbrido</Badge>;
  return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Presencial</Badge>;
}
function tipoBadge(t: string) {
  if (t === "T") return <span className="inline-block bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">T</span>;
  if (t === "P") return <span className="inline-block bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">P</span>;
  return <span className="inline-block bg-gray-100 text-gray-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{t}</span>;
}

async function fetchLogoBase64(baseUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(`${baseUrl}logo-uai.png`);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise(res => {
      const r = new FileReader();
      r.onload = () => res((r.result as string).split(",")[1]);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ── Ciclo multi-select ─────────────────────────────────────────────────────
function CicloMultiSelect({
  availCiclos, selectedCiclos, onChange,
}: { availCiclos: string[]; selectedCiclos: string[]; onChange: (v: string[]) => void; }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const allSelected = selectedCiclos.length === 0 || selectedCiclos.length === availCiclos.length;
  const label = allSelected ? "Todos los ciclos"
    : selectedCiclos.length === 1 ? `Ciclo ${selectedCiclos[0]}`
    : `Ciclos ${selectedCiclos.map(Number).sort((a, b) => a - b).join(", ")}`;
  const toggle = (c: string) => {
    if (selectedCiclos.includes(c)) {
      const next = selectedCiclos.filter(x => x !== c);
      onChange(next.length === availCiclos.length || next.length === 0 ? [] : next);
    } else {
      const next = [...selectedCiclos, c];
      onChange(next.length === availCiclos.length ? [] : next);
    }
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm min-w-[170px] justify-between hover:bg-accent transition-colors">
        <span className={allSelected ? "text-muted-foreground" : "text-foreground font-medium"}>{label}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-10 left-0 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[170px]">
          <button type="button" onClick={() => onChange([])}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${allSelected ? "bg-primary border-primary" : "border-input"}`}>
              {allSelected && <Check className="w-3 h-3 text-white" />}
            </div>
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">Todos los ciclos</span>
          </button>
          <div className="border-t border-border my-1" />
          {availCiclos.map(c => {
            const checked = allSelected ? true : selectedCiclos.includes(c);
            return (
              <button key={c} type="button" onClick={() => toggle(c)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors">
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-primary border-primary" : "border-input"}`}>
                  {checked && <Check className="w-3 h-3 text-white" />}
                </div>
                <span>Ciclo {c}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Preview Modal ──────────────────────────────────────────────────────────
interface SheetKey { carr: string; ciclo: string; base: string; }

function buildGrid(rows: FCSRow[]) {
  type CellData = { text: string[]; sourceIdx: number[]; spanEnd: number; dayKey: string; };
  const cells = new Map<string, CellData>();
  rows.forEach((r, idx) => {
    if (!r.hora || !r.dia) return;
    const dayKey = normDia(r.dia);
    const si     = slotIdx(r.hora);
    const ei     = slotEndIdx(r.horaFin);
    const k      = `${si}_${dayKey}`;
    if (cells.has(k)) {
      const ex = cells.get(k)!;
      ex.text.push(r.curso.toUpperCase(), r.docente || "—", r.modalidad);
      ex.sourceIdx.push(idx);
      ex.spanEnd = Math.max(ex.spanEnd, ei);
    } else {
      cells.set(k, {
        text: [r.curso.toUpperCase(), r.docente || "—", r.modalidad],
        sourceIdx: [idx],
        spanEnd: ei,
        dayKey,
      });
    }
  });
  return cells;
}

function PreviewModal({
  open, onClose, data, local, carrera, activeCiclos,
}: {
  open: boolean; onClose: () => void;
  data: FCSRow[]; local: string; carrera: string; activeCiclos: string[];
}) {
  const sheets = useMemo<SheetKey[]>(() => {
    const src = data.filter(r =>
      r.local === local &&
      (carrera === "TODOS" || r.carrera === carrera) &&
      activeCiclos.includes(r.ciclo)
    );
    const seen = new Set<string>();
    const result: SheetKey[] = [];
    src.forEach(r => {
      const base = baseSeccion(r.seccion);
      const k    = `${r.carrera}|${r.ciclo}|${base}`;
      if (!seen.has(k)) { seen.add(k); result.push({ carr: r.carrera, ciclo: r.ciclo, base }); }
    });
    return result.sort((a, b) => {
      const cc = a.carr.localeCompare(b.carr);
      if (cc !== 0) return cc;
      return Number(a.ciclo) - Number(b.ciclo);
    });
  }, [data, local, carrera, activeCiclos]);

  const [sheetIdx, setSheetIdx] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [hoveredSrcIdx, setHoveredSrcIdx] = useState<number | null>(null);

  useEffect(() => { setSheetIdx(0); setHoveredCell(null); setHoveredSrcIdx(null); }, [open]);

  const sheet = sheets[sheetIdx] ?? null;
  const sheetRows = useMemo(() => {
    if (!sheet) return [];
    return data.filter(r =>
      r.local === local &&
      r.carrera === sheet.carr &&
      r.ciclo === sheet.ciclo &&
      baseSeccion(r.seccion) === sheet.base
    );
  }, [data, local, sheet]);

  const grid = useMemo(() => buildGrid(sheetRows), [sheetRows]);
  const occupied = useMemo(() => {
    const s = new Set<string>();
    grid.forEach((cell, k) => {
      const si = parseInt(k.split("_")[0]);
      for (let r = si + 1; r <= cell.spanEnd; r++) s.add(`${r}_${cell.dayKey}`);
    });
    return s;
  }, [grid]);

  // Only show days that have at least one course
  const activeDays = useMemo(() => {
    const used = new Set<string>();
    sheetRows.forEach(r => { if (r.dia) used.add(normDia(r.dia)); });
    return DAYS.filter(d => used.has(d));
  }, [sheetRows]);

  // First slot index that has any course
  const firstSlot = useMemo(() => {
    let min = SLOTS.length - 1;
    grid.forEach((_, k) => { const si = parseInt(k.split("_")[0]); if (si < min) min = si; });
    return Math.max(0, min);
  }, [grid]);
  const lastSlot = useMemo(() => {
    let max = 0;
    grid.forEach(c => { if (c.spanEnd > max) max = c.spanEnd; });
    return Math.min(SLOTS.length - 1, max);
  }, [grid]);

  const sheetLabel = sheet
    ? `${sheet.carr} — Ciclo ${sheet.ciclo}${sheet.base} · ${local}`
    : "";
  const carreraFull = sheet ? (CARRERAS_FULL[sheet.carr] ?? sheet.carr) : "";
  const withDia     = sheetRows.filter(r => r.hora);
  const turno       = withDia.length > 0
    ? turnoLabel([...withDia].sort((a, b) => a.hora.localeCompare(b.hora))[0].hora)
    : "MAÑANA";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[95vw] w-full max-h-[92vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="w-5 h-5 text-primary" />
            Vista Previa del Excel — Guía de Origen de Datos
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Cada celda amarilla muestra el curso tal como aparecerá en el Excel. Pasa el cursor sobre una celda para ver su origen en la planificación.
          </p>
        </DialogHeader>

        <div className="flex flex-col overflow-hidden flex-1 min-h-0">
          {/* Sheet selector bar */}
          <div className="flex items-center gap-3 px-5 py-2 border-b bg-muted/30 shrink-0 overflow-x-auto">
            <button
              onClick={() => setSheetIdx(i => Math.max(0, i - 1))}
              disabled={sheetIdx === 0}
              className="p-1 rounded hover:bg-accent disabled:opacity-30"
            ><ChevronLeft className="w-4 h-4" /></button>

            <div className="flex gap-1.5 overflow-x-auto flex-1 py-0.5">
              {sheets.map((s, i) => (
                <button
                  key={`${s.carr}${s.ciclo}${s.base}`}
                  onClick={() => { setSheetIdx(i); setHoveredCell(null); setHoveredSrcIdx(null); }}
                  className={`shrink-0 px-3 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
                    i === sheetIdx
                      ? "bg-primary text-white border-primary"
                      : "bg-background border-border hover:bg-accent"
                  }`}
                >
                  {s.carr} {s.ciclo}{s.base}
                </button>
              ))}
            </div>

            <button
              onClick={() => setSheetIdx(i => Math.min(sheets.length - 1, i + 1))}
              disabled={sheetIdx >= sheets.length - 1}
              className="p-1 rounded hover:bg-accent disabled:opacity-30"
            ><ChevronRight className="w-4 h-4" /></button>

            <span className="text-xs text-muted-foreground shrink-0">
              {sheetIdx + 1} / {sheets.length}
            </span>
          </div>

          {/* Two-panel layout */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* LEFT — Grid preview */}
            <div className="flex-1 overflow-auto p-4 min-w-0">
              {sheet ? (
                <div className="min-w-[640px]">
                  {/* Header info rows like Excel */}
                  <div className="rounded-t-md overflow-hidden border border-b-0 border-[#001F5F]">
                    <div className="bg-[#001F5F] text-white text-center py-2 px-4 text-sm font-bold">
                      HORARIO DE CLASES 2026-I
                    </div>
                    {[
                      ["FACULTAD", "CIENCIAS DE LA SALUD"],
                      ["CARRERA PROFESIONAL", carreraFull],
                      ["CICLO ACADÉMICO — SECCIÓN", `${sheet.ciclo}${sheet.base}`],
                      ["TURNO — LOCAL", `${turno} — ${local}`],
                    ].map(([label, val]) => (
                      <div key={label} className="grid grid-cols-[140px_1fr] border-b border-[#001F5F]/20 bg-[#D9E0F1]">
                        <div className="px-3 py-1 text-[11px] font-semibold text-[#001F5F] border-r border-[#001F5F]/20">{label}</div>
                        <div className="px-3 py-1 text-[11px] font-semibold text-[#001F5F]">{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Grid table */}
                  <div className="overflow-x-auto border border-[#001F5F] rounded-b-md">
                    <table className="w-full border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-[#001F5F] text-white">
                          <th className="border border-[#001F5F]/40 px-2 py-1.5 text-center w-20 font-semibold">Hora</th>
                          {activeDays.map((d, i) => (
                            <th key={d} className="border border-[#001F5F]/40 px-2 py-1.5 text-center font-semibold">
                              {DAYS_LABEL[DAYS.indexOf(d)]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {SLOTS.slice(firstSlot, lastSlot + 1).map((slot, relIdx) => {
                          const si = firstSlot + relIdx;
                          return (
                            <tr key={si}>
                              <td className="border border-gray-200 bg-[#D9E0F1] px-2 py-1 text-center font-mono text-[9px] whitespace-nowrap font-semibold">
                                {slot.start}<br />{slot.end}
                              </td>
                              {activeDays.map(dayKey => {
                                const cellKey = `${si}_${dayKey}`;
                                if (occupied.has(cellKey)) return null;
                                const cell = grid.get(cellKey);
                                if (!cell) {
                                  return <td key={dayKey} className="border border-gray-200 bg-white px-1 py-0.5" />;
                                }
                                const span   = cell.spanEnd - si + 1;
                                const isHov  = hoveredCell === cellKey;
                                const srcHov = hoveredSrcIdx !== null && cell.sourceIdx.includes(hoveredSrcIdx);
                                const lines  = cell.text;
                                return (
                                  <td
                                    key={dayKey}
                                    rowSpan={span}
                                    onMouseEnter={() => { setHoveredCell(cellKey); setHoveredSrcIdx(null); }}
                                    onMouseLeave={() => { setHoveredCell(null); }}
                                    className={`border border-gray-300 px-1.5 py-1 text-center cursor-pointer transition-colors align-middle ${
                                      isHov || srcHov
                                        ? "bg-amber-300 ring-2 ring-amber-500"
                                        : "bg-[#FFFFF2CC] hover:bg-amber-200"
                                    }`}
                                    style={{ backgroundColor: isHov || srcHov ? undefined : "#FFFFF2" }}
                                  >
                                    {/* Course text lines */}
                                    {Array.from({ length: Math.ceil(lines.length / 3) }, (_, gi) => (
                                      <div key={gi} className={gi > 0 ? "mt-1 pt-1 border-t border-amber-300/50" : ""}>
                                        <div className="font-bold text-[9px] text-gray-800 leading-tight">{lines[gi * 3]}</div>
                                        <div className="text-[8px] text-gray-600">{lines[gi * 3 + 1]}</div>
                                        <div className="text-[8px] text-gray-500 italic">{lines[gi * 3 + 2]}</div>
                                      </div>
                                    ))}
                                    {/* Arrow indicator */}
                                    {isHov && (
                                      <div className="mt-1 flex items-center justify-center gap-1 text-amber-700 text-[8px]">
                                        <ArrowRight className="w-2.5 h-2.5" />
                                        <span>Ver en planificación →</span>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  No hay hojas para los filtros seleccionados
                </div>
              )}
            </div>

            {/* RIGHT — Source data */}
            <div className="w-[360px] shrink-0 border-l flex flex-col overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 border-b shrink-0">
                <div className="text-xs font-semibold text-foreground">
                  Planificación 2026-1 — Origen de datos
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {sheetLabel} · <strong>{sheetRows.length}</strong> filas
                </div>
              </div>

              <div className="overflow-auto flex-1 p-2">
                {sheetRows.map((r, idx) => {
                  const fromHov = hoveredCell && (() => {
                    const dayKey = normDia(r.dia || "");
                    const si     = slotIdx(r.hora || "");
                    const k      = `${si}_${dayKey}`;
                    return k === hoveredCell;
                  })();
                  const isHighlighted = fromHov || hoveredSrcIdx === idx;
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredSrcIdx(idx)}
                      onMouseLeave={() => setHoveredSrcIdx(null)}
                      className={`rounded-md border mb-1.5 p-2 cursor-pointer transition-all text-[10px] ${
                        isHighlighted
                          ? "bg-amber-50 border-amber-400 ring-1 ring-amber-400 shadow-sm"
                          : "bg-background border-border hover:bg-muted/30"
                      }`}
                    >
                      {/* Row number + section */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-primary text-[9px]">
                          Fila {idx + 1}
                        </span>
                        <div className="flex gap-1">
                          <span className="bg-primary/10 text-primary px-1.5 rounded font-mono font-bold text-[9px]">
                            {r.seccion}
                          </span>
                          {tipoBadge(r.tipo)}
                        </div>
                      </div>
                      {/* Course */}
                      <div className="font-semibold text-foreground leading-tight mb-0.5">
                        {r.curso}
                      </div>
                      {/* Fields grid */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
                        <div>
                          <span className="text-muted-foreground">Docente: </span>
                          <span className="font-medium">{r.docente || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Modalidad: </span>
                          <span className="font-medium">{r.modalidad}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Día: </span>
                          <span className={`font-bold ${r.dia ? "text-blue-700" : "text-muted-foreground"}`}>
                            {r.dia
                              ? r.dia.charAt(0) + r.dia.slice(1).toLowerCase()
                              : "Sin horario"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Hora: </span>
                          <span className="font-mono font-semibold text-[9px]">
                            {r.hora && r.horaFin ? `${r.hora}–${r.horaFin}` : "—"}
                          </span>
                        </div>
                      </div>
                      {/* Highlight indicator */}
                      {isHighlighted && (
                        <div className="mt-1.5 flex items-center gap-1 text-amber-700 text-[9px] font-semibold">
                          <ArrowRight className="w-3 h-3" />
                          Esta fila alimenta la celda resaltada en el horario
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Build Excel sheet ──────────────────────────────────────────────────────
function buildSheet(
  wb: ExcelJS.Workbook, logo64: string | null, secRows: FCSRow[],
  carreraCode: string, cicloNum: string, baseSec: string, localLabel: string,
) {
  const NAVY   = "FF001F5F";
  const WHITE  = "FFFFFFFF";
  const LGRAY  = "FFD9E0F1";
  const DGRAY  = "FF444444";
  const YELLOW = "FFFFF2CC";
  type Fill = ExcelJS.Fill;
  const sf = (a: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: a } });
  const CTR      = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
  const LEFT_MID = { horizontal: "left"   as const, vertical: "middle" as const, wrapText: true };
  const THIN: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: DGRAY } }, bottom: { style: "thin", color: { argb: DGRAY } },
    left: { style: "thin", color: { argb: DGRAY } }, right: { style: "thin", color: { argb: DGRAY } },
  };
  const MED: Partial<ExcelJS.Borders> = {
    top: { style: "medium", color: { argb: NAVY } }, bottom: { style: "medium", color: { argb: NAVY } },
    left: { style: "medium", color: { argb: NAVY } }, right: { style: "medium", color: { argb: NAVY } },
  };
  const sheetName = `${carreraCode} - ${cicloNum}${baseSec} ${localLabel}`.substring(0, 31);
  const ws = wb.addWorksheet(sheetName, { pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" } });
  ws.columns = [
    { width: 11 }, { width: 22 }, { width: 22 }, { width: 22 },
    { width: 22 }, { width: 22 }, { width: 22 }, { width: 18 },
  ];
  ws.getRow(1).height = 50;
  ws.mergeCells("A1:B1"); ws.mergeCells("C1:H1");
  const c1l = ws.getCell("A1"); c1l.fill = sf(NAVY); c1l.alignment = CTR;
  const c1t = ws.getCell("C1");
  c1t.value = "HORARIO DE CLASES 2026-I\nDepartamento Académico de Estudios Generales";
  c1t.font = { bold: true, size: 13, color: { argb: WHITE } };
  c1t.fill = sf(NAVY); c1t.alignment = CTR; c1t.border = MED;
  if (logo64) {
    const imgId = wb.addImage({ base64: logo64, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 46, height: 50 }, editAs: "absolute" });
  }
  [2, 3, 4].forEach(r => { ws.getRow(r).height = 5; });
  const infoRow = (row: number, label: string, value: string) => {
    ws.getRow(row).height = 18;
    ws.mergeCells(`C${row}:H${row}`);
    const la = ws.getCell(`A${row}`);
    la.value = label; la.font = { bold: true, size: 10 }; la.fill = sf(LGRAY); la.border = THIN; la.alignment = LEFT_MID;
    const lc = ws.getCell(`C${row}`);
    lc.value = value; lc.font = { bold: true, size: 10 }; lc.fill = sf(LGRAY); lc.border = THIN; lc.alignment = LEFT_MID;
  };
  const withDia = secRows.filter(r => r.hora);
  const turno = withDia.length > 0
    ? turnoLabel([...withDia].sort((a, b) => a.hora.localeCompare(b.hora))[0].hora)
    : "MAÑANA";
  infoRow(5, "FACULTAD", "CIENCIAS DE LA SALUD");
  infoRow(6, "CARRERA PROFESIONAL", CARRERAS_FULL[carreraCode] || carreraCode);
  infoRow(7, "CICLO ACADÉMICO - SECCIÓN", `${cicloNum}${baseSec}`);
  infoRow(8, "TURNO - LOCAL", `${turno} - ${localLabel}`);
  ws.getRow(9).height = 5;
  ws.getRow(10).height = 20;
  ["Hora", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].forEach((h, i) => {
    const cell = ws.getRow(10).getCell(i + 1);
    cell.value = h; cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = sf(NAVY); cell.alignment = CTR; cell.border = MED;
  });
  type CellInfo = { text: string; startSlot: number; endSlot: number };
  const grid = new Map<string, CellInfo>();
  secRows.forEach(r => {
    if (!r.hora || !r.dia) return;
    const dayCol = DAY_COLS[normDia(r.dia)];
    if (!dayCol) return;
    const si  = slotIdx(r.hora);
    const ei  = slotEndIdx(r.horaFin);
    const key = `${si}_${dayCol}`;
    const txt = [r.curso.toUpperCase(), r.docente || "Sin asignar", r.modalidad.toUpperCase().trim()].join("\n");
    if (grid.has(key)) {
      const ex = grid.get(key)!;
      ex.text   += "\n\n" + txt;
      ex.endSlot = Math.max(ex.endSlot, ei);
    } else {
      grid.set(key, { text: txt, startSlot: si, endSlot: ei });
    }
  });
  const FIRST_ROW = 11;
  const occupied  = new Set<string>();
  SLOTS.forEach((slot, si) => {
    const rowNum = FIRST_ROW + si;
    ws.getRow(rowNum).height = 40;
    const tc = ws.getRow(rowNum).getCell(1);
    tc.value = `${slot.start}\n${slot.end}`; tc.font = { size: 9, bold: true };
    tc.alignment = CTR; tc.fill = sf(LGRAY); tc.border = THIN;
    for (let col = 2; col <= 8; col++) {
      const info = grid.get(`${si}_${col}`);
      if (info) {
        const span = info.endSlot - si + 1;
        if (span > 1) { try { ws.mergeCells(rowNum, col, rowNum + span - 1, col); } catch { /**/ } }
        const cell = ws.getRow(rowNum).getCell(col);
        cell.value = info.text; cell.font = { size: 9, color: { argb: DGRAY } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.fill = sf(YELLOW); cell.border = THIN;
        for (let r2 = si + 1; r2 <= info.endSlot; r2++) occupied.add(`${r2}_${col}`);
      } else if (!occupied.has(`${si}_${col}`)) {
        ws.getRow(rowNum).getCell(col).fill = sf(WHITE);
        ws.getRow(rowNum).getCell(col).border = THIN;
      }
    }
  });
}

// ── Main component ─────────────────────────────────────────────────────────
export default function HorarioCarrera() {
  const [data, setData]         = useState<FCSRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [local, setLocal]       = useState("SEDE");
  const [carrera, setCarrera]   = useState("TODOS");
  const [selectedCiclos, setSelectedCiclos] = useState<string[]>([]);
  const [search, setSearch]     = useState("");
  const [exporting, setExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}planificacion-fcs-2026-1.json`)
      .then(r => r.json())
      .then((d: FCSRow[]) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const carrerasForLocal = local === "SEDE" ? CARRERAS_SEDE : CARRERAS_SUNAMPE;
  useEffect(() => { setCarrera("TODOS"); setSelectedCiclos([]); }, [local]);
  useEffect(() => { setSelectedCiclos([]); }, [carrera]);

  const availCiclos = useMemo(() => {
    const set = new Set(
      data.filter(r => r.local === local && (carrera === "TODOS" || r.carrera === carrera)).map(r => r.ciclo)
    );
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [data, local, carrera]);

  const activeCiclos = selectedCiclos.length > 0 ? selectedCiclos : availCiclos;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter(r =>
      r.local === local &&
      (carrera === "TODOS" || r.carrera === carrera) &&
      activeCiclos.includes(r.ciclo) &&
      (!q || r.curso.toLowerCase().includes(q) || r.docente.toLowerCase().includes(q) || r.seccion.toLowerCase().includes(q))
    ).sort((a, b) => {
      const cc = a.carrera.localeCompare(b.carrera);
      if (cc !== 0) return cc;
      const nc = Number(a.ciclo) - Number(b.ciclo);
      if (nc !== 0) return nc;
      return a.curso.localeCompare(b.curso, "es");
    });
  }, [data, local, carrera, activeCiclos, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, { codigo: string; curso: string; carrera: string; ciclo: string; rows: FCSRow[] }>();
    filtered.forEach(r => {
      const key = r.carrera + "|" + r.ciclo + "|" + r.codigo + "|" + r.curso;
      if (!map.has(key)) map.set(key, { codigo: r.codigo, curso: r.curso, carrera: r.carrera, ciclo: r.ciclo, rows: [] });
      map.get(key)!.rows.push(r);
    });
    return Array.from(map.values());
  }, [filtered]);

  const totalDocentes = useMemo(() => new Set(filtered.map(r => r.docente).filter(Boolean)).size, [filtered]);

  const sheetCount = useMemo(() => {
    const combos = new Set<string>();
    data.filter(r =>
      r.local === local && (carrera === "TODOS" || r.carrera === carrera) && activeCiclos.includes(r.ciclo)
    ).forEach(r => { combos.add(`${r.carrera}|${r.ciclo}|${baseSeccion(r.seccion)}`); });
    return combos.size;
  }, [data, local, carrera, activeCiclos]);

  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const srcRows = data.filter(r =>
        r.local === local && (carrera === "TODOS" || r.carrera === carrera) && activeCiclos.includes(r.ciclo)
      );
      const orderedKeys: Array<[string, string, string]> = [];
      const seen = new Set<string>();
      srcRows.forEach(r => {
        const base = baseSeccion(r.seccion);
        const k = `${r.carrera}|${r.ciclo}|${base}`;
        if (!seen.has(k)) { seen.add(k); orderedKeys.push([r.carrera, r.ciclo, base]); }
      });
      orderedKeys.sort((a, b) => {
        const cc = a[0].localeCompare(b[0]);
        if (cc !== 0) return cc;
        const nc = Number(a[1]) - Number(b[1]);
        if (nc !== 0) return nc;
        return a[2].localeCompare(b[2]);
      });
      const logo64     = await fetchLogoBase64(import.meta.env.BASE_URL);
      const wb         = new ExcelJS.Workbook();
      wb.creator       = "UAI Portal Académico";
      wb.created       = new Date();
      const localLabel = local === "SEDE" ? "SEDE" : "SUNAMPE";
      for (const [carr, cic, base] of orderedKeys) {
        const secRows = srcRows.filter(r => r.carrera === carr && r.ciclo === cic && baseSeccion(r.seccion) === base);
        buildSheet(wb, logo64, secRows, carr, cic, base, localLabel);
      }
      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      const carreraLabel = carrera === "TODOS" ? "Todas" : carrera;
      const cicloLabel   = selectedCiclos.length === 0
        ? "TodosCiclos"
        : `Ciclos${selectedCiclos.map(Number).sort((x, y) => x - y).join("_")}`;
      a.download = `Horario_FCS_${carreraLabel}_${cicloLabel}_${localLabel}_2026-1.xlsx`;
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

  const showCarreraCol = carrera === "TODOS";
  const showCicloCol   = activeCiclos.length > 1;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Horarios por Carrera — FCS</h1>
          <p className="text-sm text-muted-foreground">Planificación 2026-1 · Ciclos 1 al 10</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={local} onValueChange={setLocal}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SEDE">SEDE</SelectItem>
              <SelectItem value="SUNAMPE">SUNAMPE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select value={carrera} onValueChange={setCarrera}>
          <SelectTrigger className="w-[230px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">
              <span className="flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-primary" />Todas las carreras</span>
            </SelectItem>
            {Object.entries(carrerasForLocal).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                <span className="font-mono text-xs font-bold text-primary mr-2">{k}</span>{v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <CicloMultiSelect availCiclos={availCiclos} selectedCiclos={selectedCiclos} onChange={setSelectedCiclos} />

        <div className="relative flex-1 max-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar curso o docente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* VERIFICAR button */}
        <Button
          variant="outline"
          onClick={() => setPreviewOpen(true)}
          disabled={filtered.length === 0}
          className="gap-2 shrink-0 border-primary/40 text-primary hover:bg-primary/5"
        >
          <Eye className="w-4 h-4" />
          Verificar
        </Button>

        {/* Download */}
        <Button onClick={exportExcel} disabled={exporting || filtered.length === 0} className="gap-2 shrink-0">
          {exporting
            ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</>
            : <><Download className="w-4 h-4" />Descargar Excel{sheetCount > 0 ? ` (${sheetCount} hojas)` : ""}</>}
        </Button>

        <div className="flex gap-3 text-sm text-muted-foreground shrink-0">
          <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /><b className="text-foreground">{grouped.length}</b> cursos</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /><b className="text-foreground">{totalDocentes}</b> docentes</span>
        </div>
      </div>

      {/* Summary banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary">
        <Layers className="w-4 h-4 shrink-0" />
        <span>
          Mostrando{" "}
          <strong>{carrera === "TODOS" ? "todas las carreras" : CARRERAS_FULL[carrera] ?? carrera}</strong>
          {" · "}
          <strong>
            {selectedCiclos.length === 0
              ? "todos los ciclos"
              : `ciclo${selectedCiclos.length > 1 ? "s" : ""} ${selectedCiclos.map(Number).sort((a, b) => a - b).join(" y ")}`}
          </strong>
          {" · "}
          El Excel generará <strong>{sheetCount} hojas</strong>.
        </span>
      </div>

      {/* Table */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No se encontraron cursos para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ codigo, curso, carrera: carr, ciclo: cic, rows }) => (
            <Card key={carr + cic + codigo + curso} className="overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/40 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground leading-snug">{curso}</CardTitle>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{codigo}</span>
                      {showCarreraCol && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{carr}</Badge>}
                      {showCicloCol && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Ciclo {cic}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">{rows.length} secc.</Badge>
                    {[...new Set(rows.map(r => r.modalidad.toUpperCase().trim()))].map(m => <span key={m}>{modalidadBadge(m)}</span>)}
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
                        <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground w-14">Hrs</th>
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
                          <tr key={i} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                            <td className="px-4 py-2.5 font-mono font-semibold text-xs text-primary">{r.seccion}</td>
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
                            <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{r.horasAcad || r.horas}h</td>
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

      {/* Preview Modal */}
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data={data}
        local={local}
        carrera={carrera}
        activeCiclos={activeCiclos}
      />
    </div>
  );
}
