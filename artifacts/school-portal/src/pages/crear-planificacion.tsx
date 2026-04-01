import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Trash2, Edit2, Check, X, AlertTriangle, User,
  BookOpen, LayoutGrid, ChevronDown, Wand2, Download,
  FileSpreadsheet, Eye, CheckCircle2, XCircle,
  Search, ListChecks, Info, ArrowRight, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Types ─────────────────────────────────────────────────────────────────────
type SlotKey = string; // "LUNES|07:40"

type DocenteDisp = {
  id: string;
  docente: string;
  local: string;
  grado: string;
  titulo: string;
  slots: SlotKey[];
  fileName: string;
};

/** One row from the planning Excel (columns 0-based from index 0) */
type CursoRow = {
  id: string;
  // original data
  semestre: string;
  plan: string;
  codigoPlan: string;
  local: string;
  codFacultad: string;
  programa: string;
  ciclo: string;
  seccion: string;
  nd: string;
  codigoCurso: string;
  nombreCurso: string;
  tipoEstudios: string;
  tipoCurso: string;
  modalidad: string;
  horasT: number;
  horasP: number;
  totalHoras: number;
  creditos: number;
  vacantes: number;
  horasAcad: number;
  modalidadEns: string;
  turno: string;
  jefePractica: string;
  pabellon: string;
  aula: string;
  aforoAula: string;
  lab: string;
  aforoLab: string;
  denominacion: string;
  // assignment (filled by auto-assign or manual)
  docenteId?: string;
  docente?: string;
  dni?: string;
  dia?: number;      // 1=Lun...6=Sab
  horaInicio?: string; // "07:40"
  horaFin?: string;    // "09:20"
};

// ── Constants ─────────────────────────────────────────────────────────────────
const DIAS_NUM: Record<number,string> = {1:"LUNES",2:"MARTES",3:"MIERCOLES",4:"JUEVES",5:"VIERNES",6:"SABADO"};
const DIAS_LABEL: Record<string,string> = {
  LUNES:"Lunes",MARTES:"Martes",MIERCOLES:"Miércoles",
  JUEVES:"Jueves",VIERNES:"Viernes",SABADO:"Sábado",
};
const DIAS_LIST = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const HEADER_TO_DIA: Record<string,string> = {
  lunes:"LUNES",martes:"MARTES","miércoles":"MIERCOLES",miercoles:"MIERCOLES",
  jueves:"JUEVES",viernes:"VIERNES","sábado":"SABADO",sabado:"SABADO",
};
const SLOTS = [
  "07:40","08:30","09:20","10:10","11:00","11:50",
  "12:40","13:30","14:20","15:10","16:00","16:50",
  "17:40","18:30","19:20","20:10","21:00","21:50","22:40",
];
function slotToMinutes(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}
function minutesToSlot(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ── Parse planning Excel ──────────────────────────────────────────────────────
async function parsePlanningExcel(file: File): Promise<CursoRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(buf, { type: "array" });
        // Find the planning sheet
        const sheetName = wb.SheetNames.find(n =>
          /planificaci[oó]n/i.test(n) || /editable/i.test(n)
        ) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        // Find header row (has "SEMESTRE" and "PROGRAMA")
        let headerIdx = -1;
        for (let i = 0; i < Math.min(15, rows.length); i++) {
          const flat = rows[i].map((c: any) => String(c).trim().toUpperCase());
          if (flat.some(c => c === "SEMESTRE") && flat.some(c => c.includes("PROGRAMA"))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx < 0) {
          // fallback: row 6 (index 5)
          headerIdx = 5;
        }

        const results: CursoRow[] = [];
        for (let ri = headerIdx + 1; ri < rows.length; ri++) {
          const r = rows[ri];
          const programa = String(r[7] ?? "").trim();
          const nombreCurso = String(r[12] ?? "").trim();
          if (!programa || !nombreCurso) continue;

          const horasT = Number(r[16]) || 0;
          const horasP = Number(r[17]) || 0;
          const horasAcad = Number(r[39]) || (horasT + horasP) || 2;

          results.push({
            id: uid(),
            semestre: String(r[2] ?? "").trim(),
            plan: String(r[3] ?? "").trim(),
            codigoPlan: String(r[4] ?? "").trim(),
            local: String(r[5] ?? "").trim(),
            codFacultad: String(r[6] ?? "").trim(),
            programa,
            ciclo: String(r[8] ?? "").trim(),
            seccion: String(r[9] ?? "").trim(),
            nd: String(r[10] ?? "").trim(),
            codigoCurso: String(r[11] ?? "").trim(),
            nombreCurso,
            tipoEstudios: String(r[13] ?? "").trim(),
            tipoCurso: String(r[14] ?? "").trim(),
            modalidad: String(r[15] ?? "").trim(),
            horasT,
            horasP,
            totalHoras: Number(r[18]) || horasT + horasP,
            creditos: Number(r[19]) || 0,
            vacantes: Number(r[21]) || 0,
            horasAcad,
            modalidadEns: String(r[24] ?? "").trim(),
            turno: String(r[25] ?? "").trim(),
            jefePractica: String(r[26] ?? "").trim(),
            pabellon: String(r[27] ?? "").trim(),
            aula: String(r[28] ?? "").trim(),
            aforoAula: String(r[29] ?? "").trim(),
            lab: String(r[30] ?? "").trim(),
            aforoLab: String(r[31] ?? "").trim(),
            denominacion: String(r[44] ?? "").trim(),
            // Don't carry over old teacher/time assignments
          });
        }
        resolve(results);
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsArrayBuffer(file);
  });
}

// ── Parse teacher availability Excel ─────────────────────────────────────────
async function parseDisponibilidadExcel(file: File): Promise<Omit<DocenteDisp, "id">> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        let docente = "", local = "", grado = "", titulo = "";
        for (const row of rows) {
          const flat = row.map((c: any) => String(c).trim());
          for (let ci = 0; ci < flat.length; ci++) {
            const cell = flat[ci];
            if (/apellidos|nombres/i.test(cell) && !docente) {
              for (let k = ci + 1; k < flat.length; k++) {
                if (flat[k] && !/disponible|local|grado|t[íi]tulo/i.test(flat[k])) {
                  docente = flat[k]; break;
                }
              }
            }
            if (/^local:/i.test(cell) && !local) {
              for (let k = ci + 1; k < flat.length; k++) { if (flat[k]) { local = flat[k]; break; } }
            }
            if (/grado:/i.test(cell) && !grado) {
              for (let k = ci + 1; k < flat.length; k++) { if (flat[k]) { grado = flat[k]; break; } }
            }
            if (/t[íi]tulo/i.test(cell) && !titulo) {
              for (let k = ci + 1; k < flat.length; k++) { if (flat[k]) { titulo = flat[k]; break; } }
            }
          }
        }

        let headerRow = -1;
        const colToDia: Record<number, string> = {};
        let horaCol = -1;
        for (let ri = 0; ri < rows.length; ri++) {
          const row = rows[ri].map((c: any) => String(c).trim().toLowerCase());
          if (row.some(c => c === "lunes" || c === "martes")) {
            headerRow = ri;
            for (let ci = 0; ci < row.length; ci++) {
              const mapped = HEADER_TO_DIA[row[ci]];
              if (mapped) colToDia[ci] = mapped;
              if (row[ci] === "hora") horaCol = ci;
            }
            break;
          }
        }

        const slots: SlotKey[] = [];
        if (headerRow >= 0) {
          for (let ri = headerRow + 1; ri < rows.length; ri++) {
            const row = rows[ri].map((c: any) => String(c).trim());
            const horaRaw = horaCol >= 0 ? row[horaCol] :
              (row.find(c => /^\d{2}:\d{2}/.test(c)) || "");
            const horaInicio = horaRaw.split(/[\r\n]/)[0].trim().slice(0, 5);
            if (!horaInicio || !SLOTS.includes(horaInicio)) continue;
            for (const [ci, dia] of Object.entries(colToDia)) {
              if (/disponible/i.test(row[Number(ci)])) slots.push(`${dia}|${horaInicio}`);
            }
          }
        }

        resolve({
          docente: docente || file.name.replace(/\.xlsx?$/, ""),
          local, grado, titulo, slots,
          fileName: file.name,
        });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsArrayBuffer(file);
  });
}

// ── Auto-assign algorithm ─────────────────────────────────────────────────────
function runAutoAssign(
  cursos: CursoRow[],
  disps: DocenteDisp[],
): CursoRow[] {
  const updated = cursos.map(c => ({ ...c }));
  // Track occupied slots per teacher: docenteId -> Set<"DIA|SLOT">
  const occupied = new Map<string, Set<string>>();

  // Pre-fill from already-assigned courses
  updated.forEach(c => {
    if (c.docenteId && c.dia && c.horaInicio) {
      const key = c.docenteId;
      if (!occupied.has(key)) occupied.set(key, new Set());
      const si = SLOTS.indexOf(c.horaInicio);
      const dia = DIAS_NUM[c.dia] || "";
      for (let i = si; i < si + c.horasAcad && i < SLOTS.length; i++) {
        occupied.get(key)!.add(`${dia}|${SLOTS[i]}`);
      }
    }
  });

  // Sort unassigned: most hours first (harder to assign)
  const unassigned = updated.filter(c => !c.docenteId);
  unassigned.sort((a, b) => b.horasAcad - a.horasAcad);

  for (const curso of unassigned) {
    const target = updated.find(c => c.id === curso.id)!;

    // Try each teacher
    for (const disp of disps) {
      const slotSet = new Set(disp.slots);
      if (!occupied.has(disp.id)) occupied.set(disp.id, new Set());
      const occ = occupied.get(disp.id)!;

      let assigned = false;
      for (const diaStr of DIAS_LIST) {
        if (assigned) break;
        for (let si = 0; si <= SLOTS.length - curso.horasAcad; si++) {
          // Check all needed slots are available and not occupied
          let ok = true;
          for (let i = si; i < si + curso.horasAcad; i++) {
            const k = `${diaStr}|${SLOTS[i]}`;
            if (!slotSet.has(k) || occ.has(k)) { ok = false; break; }
          }
          if (!ok) continue;

          const horaInicio = SLOTS[si];
          const horaFinIdx = si + curso.horasAcad;
          const horaFin = horaFinIdx < SLOTS.length
            ? SLOTS[horaFinIdx]
            : minutesToSlot(slotToMinutes(SLOTS[SLOTS.length - 1]) + 50);

          // Mark slots occupied
          for (let i = si; i < si + curso.horasAcad; i++) {
            occ.add(`${diaStr}|${SLOTS[i]}`);
          }

          // Find DIA number
          const diaNum = Object.entries(DIAS_NUM).find(([, v]) => v === diaStr)?.[0];

          target.docenteId = disp.id;
          target.docente = disp.docente;
          target.dia = Number(diaNum);
          target.horaInicio = horaInicio;
          target.horaFin = horaFin;
          assigned = true;
          break;
        }
      }
      if (assigned) break;
    }
  }

  return updated;
}

// ── Export to Excel ───────────────────────────────────────────────────────────
function exportPlanningExcel(cursos: CursoRow[], semestre: string) {
  const header = [
    "", "", "SEMESTRE", "PLAN DE ESTUDIOS", "CODIGO DE  PLAN", "LOCAL",
    "Cod Facultad:", "PROGRAMA ACADÉMICO", "CICLO", "SECCIÓN", "nd",
    "CÓDIGO", "NOMBRE DE CURSO", "TIPO DE ESTUDIOS", "TIPO DE CURSO",
    "MODALIDAD DE CURSO", "HORAS TEORÍA", "HORAS PRÁCTICA", "TOTAL DE HORAS",
    "TOTAL DE CREDITOS", "", "NÚMERO VACANTES PROYECTADAS", "DNI",
    "APELLIDOS Y NOMBRES", "MODALIDAD\n(Presenc./VIRTUAL/HIBRIDO)",
    "TURNO\n(DIURNO/\nMAÑANA/ TARDE/NOCHE)", "JEFE DE PRACTICA\n(SI / NO)",
    "PABELLON", "AULA", "AFORO AULA", "LABORATORIO", "AFORO LAB",
    "TURNO", "TIPO DE CURSO", "DIA", "HORA INICIO", "MINUTO INICIO",
    "HORA FIN", "MINUTO FIN", "HORAS\nACADEM.", "HORA INICIO", "HORA FIN",
    "CRUCE DOCENTE", "CRUCE LABORATORIO", "DENOMINACIÓN", "CRUCE DE SECCIÓN",
  ];

  const dataRows = cursos.map(c => {
    const horaInicioMin = c.horaInicio ? slotToMinutes(c.horaInicio) : null;
    const horaFinMin = c.horaFin ? slotToMinutes(c.horaFin) : null;
    return [
      "", "",
      c.semestre || semestre,
      c.plan, c.codigoPlan, c.local, c.codFacultad, c.programa,
      c.ciclo, c.seccion, c.nd, c.codigoCurso, c.nombreCurso,
      c.tipoEstudios, c.tipoCurso, c.modalidad,
      c.horasT, c.horasP, c.totalHoras, c.creditos,
      "", c.vacantes,
      c.dni || "",
      c.docente || "",
      c.modalidadEns, c.turno, c.jefePractica,
      c.pabellon, c.aula, c.aforoAula, c.lab, c.aforoLab,
      "", "",
      c.dia || "",
      horaInicioMin !== null ? Math.floor(horaInicioMin / 60) : "",
      horaInicioMin !== null ? horaInicioMin % 60 : "",
      horaFinMin !== null ? Math.floor(horaFinMin / 60) : "",
      horaFinMin !== null ? horaFinMin % 60 : "",
      c.horasAcad,
      c.horaInicio || "",
      c.horaFin || "",
      "", "", c.denominacion, "",
    ];
  });

  const wb = XLSX.utils.book_new();
  const wsData = [
    Array(46).fill(""),
    Array(46).fill(""),
    ["", "", `PLANIFICACIÓN ACADÉMICA PREGRADO ${semestre}`, ...Array(43).fill("")],
    Array(46).fill(""),
    Array(46).fill(""),
    header,
    ...dataRows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = Array(46).fill({ wch: 18 });
  ws["!cols"][12] = { wch: 35 };
  ws["!cols"][23] = { wch: 35 };
  XLSX.utils.book_append_sheet(wb, ws, "Planificación");
  XLSX.writeFile(wb, `PLANIFICACION_${semestre}_GENERADA.xlsx`);
}

// ── Helper: Dropdown ──────────────────────────────────────────────────────────
function Sel({
  value, onChange, options, placeholder = "Seleccionar...", className = "",
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const label = options.find(o => o.value === value)?.label ?? placeholder;
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors">
        <span className={value ? "text-foreground" : "text-muted-foreground truncate"}>{label}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-10 left-0 right-0 bg-popover border border-border rounded-md shadow-lg py-1 max-h-56 overflow-y-auto">
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${o.value === value ? "bg-primary/10 text-primary font-medium" : ""}`}>
              {o.value === value ? <Check className="w-3 h-3 shrink-0" /> : <span className="w-3 h-3 shrink-0" />}
              <span className="truncate">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DispGrid ──────────────────────────────────────────────────────────────────
function DispGrid({ disp }: { disp: DocenteDisp }) {
  const slotSet = new Set(disp.slots);
  const usedDias = DIAS_LIST.filter(d => disp.slots.some(s => s.startsWith(d + "|")));
  const usedSlots = SLOTS.filter(s => disp.slots.some(k => k.endsWith("|" + s)));
  if (!usedDias.length) return <div className="text-xs text-muted-foreground py-4 text-center">Sin disponibilidades registradas.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-collapse">
        <thead><tr>
          <th className="px-2 py-1 bg-primary text-white font-semibold border border-primary/40 w-20">Hora</th>
          {usedDias.map(d => <th key={d} className="px-4 py-1 bg-primary text-white font-semibold border border-primary/40 min-w-[70px]">{DIAS_LABEL[d]}</th>)}
        </tr></thead>
        <tbody>
          {usedSlots.map(slot => (
            <tr key={slot}>
              <td className="px-2 py-1 bg-[#D9E0F1] border border-gray-200 font-mono font-bold text-center text-[9px]">{slot}</td>
              {usedDias.map(dia => {
                const has = slotSet.has(`${dia}|${slot}`);
                return <td key={dia} className={`border border-gray-200 text-center px-2 py-1 ${has ? "bg-green-100 text-green-700 font-bold" : "bg-gray-50 text-gray-300"}`}>{has ? "✓" : "—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
type Tab = "importar" | "disponibilidades" | "asignaciones" | "exportar";

export default function CrearPlanificacion() {
  const [tab, setTab] = useState<Tab>("importar");

  // Persisted state
  const [cursos, setCursos] = useState<CursoRow[]>(() => {
    try { return JSON.parse(localStorage.getItem("plan4_cursos") || "[]"); } catch { return []; }
  });
  const [disps, setDisps] = useState<DocenteDisp[]>(() => {
    try { return JSON.parse(localStorage.getItem("plan4_disps") || "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem("plan4_cursos", JSON.stringify(cursos)); }, [cursos]);
  useEffect(() => { localStorage.setItem("plan4_disps", JSON.stringify(disps)); }, [disps]);

  // UI state
  const [dragging1, setDragging1] = useState(false);
  const [dragging2, setDragging2] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msgs, setMsgs] = useState<{ ok: boolean; text: string }[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterProg, setFilterProg] = useState("");
  const [filterLocal, setFilterLocal] = useState("");
  const [autoMsg, setAutoMsg] = useState("");
  const [importing, setImporting] = useState(false);

  // ── Import planning Excel ──────────────────────────────────────────────────
  const importPlanningFile = useCallback(async (files: FileList | File[]) => {
    const file = Array.from(files).find(f => f.name.match(/\.xlsx?$/i));
    if (!file) return;
    setImporting(true);
    setMsgs([]);
    try {
      const rows = await parsePlanningExcel(file);
      setCursos(rows);
      setMsgs([{ ok: true, text: `✓ Importados ${rows.length} cursos desde "${file.name}"` }]);
      setTab("disponibilidades");
    } catch (err: any) {
      setMsgs([{ ok: false, text: `Error: ${err.message}` }]);
    } finally {
      setImporting(false);
    }
  }, []);

  // ── Upload teacher availability ────────────────────────────────────────────
  const uploadAvailability = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.name.match(/\.xlsx?$/i));
    if (!arr.length) return;
    setUploading(true);
    const newMsgs: typeof msgs = [];
    const newDisps = [...disps];

    for (const file of arr) {
      try {
        const parsed = await parseDisponibilidadExcel(file);
        const existing = newDisps.find(d => d.docente === parsed.docente);
        if (existing) {
          const idx = newDisps.findIndex(d => d.id === existing.id);
          newDisps[idx] = { ...existing, ...parsed };
          newMsgs.push({ ok: true, text: `Actualizado: ${parsed.docente} — ${parsed.slots.length} slots` });
        } else {
          newDisps.push({ ...parsed, id: uid() });
          newMsgs.push({ ok: true, text: `Cargado: ${parsed.docente} — ${parsed.slots.length} slots disponibles` });
        }
      } catch (err: any) {
        newMsgs.push({ ok: false, text: `Error en "${file.name}": ${err.message}` });
      }
    }

    setDisps(newDisps);
    setMsgs(newMsgs);
    setUploading(false);
  }, [disps]);

  // ── Auto-assign ────────────────────────────────────────────────────────────
  const handleAutoAssign = useCallback(() => {
    if (!cursos.length) { setAutoMsg("⚠ Primero importa el archivo de planificación."); return; }
    if (!disps.length) { setAutoMsg("⚠ Primero sube las disponibilidades de los docentes."); return; }
    const updated = runAutoAssign(cursos, disps);
    setCursos(updated);
    const assigned = updated.filter(c => c.docenteId).length;
    const total = updated.length;
    setAutoMsg(`✓ ${assigned} de ${total} cursos asignados automáticamente. ${total - assigned} sin docente disponible.`);
    setTimeout(() => setAutoMsg(""), 8000);
    setTab("asignaciones");
  }, [cursos, disps]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = cursos.length;
    const assigned = cursos.filter(c => c.docenteId).length;
    const unassigned = total - assigned;
    const uniqueDocentes = new Set(cursos.filter(c => c.docente).map(c => c.docente)).size;
    return { total, assigned, unassigned, uniqueDocentes };
  }, [cursos]);

  // ── Filter options ─────────────────────────────────────────────────────────
  const programOptions = useMemo(() => {
    const s = new Set(cursos.map(c => c.programa).filter(Boolean));
    return [{ value: "", label: "Todos los programas" }, ...[...s].sort().map(v => ({ value: v, label: v }))];
  }, [cursos]);
  const localOptions = useMemo(() => {
    const s = new Set(cursos.map(c => c.local).filter(Boolean));
    return [{ value: "", label: "Todos los locales" }, ...[...s].sort().map(v => ({ value: v, label: v }))];
  }, [cursos]);

  const filteredCursos = useMemo(() => {
    return cursos.filter(c => {
      if (filterProg && c.programa !== filterProg) return false;
      if (filterLocal && c.local !== filterLocal) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.nombreCurso.toLowerCase().includes(q) ||
          c.docente?.toLowerCase().includes(q) ||
          c.seccion.toLowerCase().includes(q);
      }
      return true;
    });
  }, [cursos, filterProg, filterLocal, search]);

  // ── Semestre ───────────────────────────────────────────────────────────────
  const semestre = cursos[0]?.semestre || "2026-1";

  // ── Schedule grid ──────────────────────────────────────────────────────────
  const activeDias = useMemo(() => {
    const s = new Set(cursos.filter(c => c.dia).map(c => DIAS_NUM[c.dia!]).filter(Boolean));
    return DIAS_LIST.filter(d => s.has(d));
  }, [cursos]);
  const activeSlots = useMemo(() => {
    if (!cursos.some(c => c.horaInicio)) return [];
    const used = new Set<number>();
    cursos.forEach(c => {
      if (!c.horaInicio) return;
      const si = SLOTS.indexOf(c.horaInicio);
      if (si >= 0) for (let i = si; i < Math.min(si + (c.horasAcad || 1), SLOTS.length); i++) used.add(i);
    });
    const arr = [...used].sort((a, b) => a - b);
    if (!arr.length) return [];
    return SLOTS.filter((_, i) => i >= arr[0] && i <= arr[arr.length - 1]);
  }, [cursos]);

  const gridCells = useMemo(() => {
    const m = new Map<string, CursoRow[]>();
    cursos.forEach(c => {
      if (!c.dia || !c.horaInicio) return;
      const k = `${DIAS_NUM[c.dia]}|${c.horaInicio}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
    return m;
  }, [cursos]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1400px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Crear Planificación</h1>
            <p className="text-sm text-muted-foreground">Semestre {semestre} · Importa cursos → sube disponibilidades → auto-asigna → exporta</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleAutoAssign}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!cursos.length || !disps.length}>
            <Wand2 className="w-4 h-4" />Auto-asignar todo
          </Button>
          <Button onClick={() => exportPlanningExcel(cursos, semestre)}
            variant="outline"
            className="gap-2"
            disabled={!cursos.length}>
            <Download className="w-4 h-4" />Exportar Excel
          </Button>
        </div>
      </div>

      {/* Auto-assign toast */}
      {autoMsg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border
          ${autoMsg.startsWith("✓") ? "bg-green-50 border-green-200 text-green-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
          {autoMsg.startsWith("✓") ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {autoMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total cursos", value: stats.total, Icon: BookOpen, c: "text-blue-600 bg-blue-50" },
          { label: "Asignados", value: stats.assigned, Icon: CheckCircle2, c: "text-green-600 bg-green-50" },
          { label: "Sin asignar", value: stats.unassigned, Icon: AlertTriangle, c: "text-amber-600 bg-amber-50" },
          { label: "Docentes cargados", value: disps.length, Icon: User, c: "text-indigo-600 bg-indigo-50" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.c}`}><s.Icon className="w-4 h-4" /></div>
              <div><div className="text-xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {[
          { id: "importar" as Tab, label: "1. Importar Plan" },
          { id: "disponibilidades" as Tab, label: "2. Disponibilidades" },
          { id: "asignaciones" as Tab, label: "3. Revisar & Editar" },
          { id: "exportar" as Tab, label: "4. Vista & Exportar" },
        ].map((s, i, arr) => (
          <React.Fragment key={s.id}>
            <button onClick={() => setTab(s.id)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${tab === s.id ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>
              {s.label}
            </button>
            {i < arr.length - 1 && <ArrowRight className="w-3 h-3 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* ══ STEP 1: IMPORT PLAN ════════════════════════════════════════════════ */}
      {tab === "importar" && (
        <div className="space-y-5">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-sm text-blue-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Paso 1:</strong> Sube el Excel de planificación del semestre anterior (PLANIFICACION_PREGRADO_2026-1_FCS).
              El sistema extrae todos los cursos y crea el catálogo automáticamente.
            </div>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragging1(true); }}
            onDragLeave={() => setDragging1(false)}
            onDrop={e => { e.preventDefault(); setDragging1(false); importPlanningFile(e.dataTransfer.files); }}
            onClick={() => {
              const inp = document.createElement("input");
              inp.type = "file"; inp.accept = ".xlsx,.xls";
              inp.onchange = e => importPlanningFile((e.target as HTMLInputElement).files!);
              inp.click();
            }}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
              ${dragging1 ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20"}`}>
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-base font-semibold">
              {importing ? "Procesando..." : "Arrastra el Excel de planificación aquí"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Archivo PLANIFICACION_PREGRADO_2026-1_FCS.xlsx · Hoja "Planificación 2026-1"
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Extrae: Local, Programa, Ciclo, Sección, Código Curso, Nombre, Horas T/P, Créditos, Vacantes
            </p>
          </div>

          {msgs.length > 0 && (
            <div className="space-y-1.5">
              {msgs.map((m, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm
                  ${m.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {m.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                  {m.text}
                </div>
              ))}
            </div>
          )}

          {cursos.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-primary" />
                  Catálogo importado
                  <Badge className="bg-primary/10 text-primary border-0">{cursos.length} cursos</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-muted/20 text-muted-foreground">
                    <th className="px-4 py-2 text-left">Programa</th>
                    <th className="px-3 py-2 text-left">Local</th>
                    <th className="px-3 py-2 text-center">Ciclo</th>
                    <th className="px-3 py-2 text-left">Curso (muestra)</th>
                    <th className="px-3 py-2 text-center">H.Acad</th>
                  </tr></thead>
                  <tbody>
                    {cursos.slice(0, 12).map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="px-4 py-2 font-bold text-primary">{c.programa}</td>
                        <td className="px-3 py-2">{c.local}</td>
                        <td className="px-3 py-2 text-center">{c.ciclo}</td>
                        <td className="px-3 py-2 font-medium">{c.nombreCurso} <span className="text-muted-foreground font-normal">Sec {c.seccion}</span></td>
                        <td className="px-3 py-2 text-center"><Badge className="bg-blue-100 text-blue-700 border-0">{c.horasAcad}h</Badge></td>
                      </tr>
                    ))}
                    {cursos.length > 12 && (
                      <tr><td colSpan={5} className="px-4 py-2 text-muted-foreground text-center">
                        ... y {cursos.length - 12} cursos más
                      </td></tr>
                    )}
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t">
                  <Button onClick={() => setTab("disponibilidades")} className="gap-2 w-full">
                    Continuar → Paso 2: Subir disponibilidades<ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══ STEP 2: DISPONIBILIDADES ═══════════════════════════════════════════ */}
      {tab === "disponibilidades" && (
        <div className="space-y-5">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-sm text-blue-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Paso 2:</strong> Sube los Excel de disponibilidad horaria de cada docente.
              Puedes subir varios archivos a la vez.
              Cuando termines, usa el botón <strong>"Auto-asignar todo"</strong> en la parte superior.
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging2(true); }}
            onDragLeave={() => setDragging2(false)}
            onDrop={e => { e.preventDefault(); setDragging2(false); uploadAvailability(e.dataTransfer.files); }}
            onClick={() => {
              const inp = document.createElement("input");
              inp.type = "file"; inp.accept = ".xlsx,.xls"; inp.multiple = true;
              inp.onchange = e => uploadAvailability((e.target as HTMLInputElement).files!);
              inp.click();
            }}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
              ${dragging2 ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20"}`}>
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-base font-semibold">{uploading ? "Procesando..." : "Arrastra los Excel de disponibilidad aquí"}</p>
            <p className="text-sm text-muted-foreground mt-1">Formato: DISPONIBILIDAD HORARIA DOCENTE · Múltiples archivos .xlsx</p>
          </div>

          {msgs.length > 0 && (
            <div className="space-y-1.5">
              {msgs.map((m, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm
                  ${m.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {m.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                  {m.text}
                </div>
              ))}
            </div>
          )}

          {disps.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Docentes cargados
                    <Badge className="bg-primary/10 text-primary border-0">{disps.length}</Badge>
                  </CardTitle>
                  <div className="relative w-60">
                    <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-8 h-8 text-sm" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Docente</th>
                    <th className="px-3 py-2.5 text-left font-medium">Local</th>
                    <th className="px-3 py-2.5 text-center font-medium">Slots</th>
                    <th className="px-3 py-2.5 text-center font-medium">Ver</th>
                  </tr></thead>
                  <tbody>
                    {disps
                      .filter(d => !search || d.docente.toLowerCase().includes(search.toLowerCase()))
                      .map(d => (
                        <React.Fragment key={d.id}>
                          <tr className="border-b hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-xs">{d.docente}</td>
                            <td className="px-3 py-2.5 text-xs">{d.local || "—"}</td>
                            <td className="px-3 py-2.5 text-center">
                              <Badge className="bg-green-100 text-green-700 border-0 text-[11px]">{d.slots.length}</Badge>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => setPreview(preview === d.id ? null : d.id)}
                                  className={`p-1.5 rounded transition-colors ${preview === d.id ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}>
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setDisps(prev => prev.filter(x => x.id !== d.id))}
                                  className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {preview === d.id && (
                            <tr><td colSpan={4} className="px-4 py-4 bg-muted/5 border-b">
                              <DispGrid disp={d} />
                            </td></tr>
                          )}
                        </React.Fragment>
                      ))}
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t">
                  <Button onClick={handleAutoAssign}
                    className="gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!cursos.length || !disps.length}>
                    <Wand2 className="w-4 h-4" />Auto-asignar todos los cursos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══ STEP 3: ASIGNACIONES ══════════════════════════════════════════════ */}
      {tab === "asignaciones" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-8 h-9 text-sm" placeholder="Buscar curso o docente..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Sel value={filterProg} onChange={setFilterProg} options={programOptions} className="w-48" />
            <Sel value={filterLocal} onChange={setFilterLocal} options={localOptions} className="w-48" />
            <button onClick={() => { setSearch(""); setFilterProg(""); setFilterLocal(""); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 underline">
              <RefreshCw className="w-3 h-3" />Limpiar filtros
            </button>
            <div className="ml-auto text-xs text-muted-foreground">
              Mostrando {filteredCursos.length} de {cursos.length} cursos
            </div>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              {filteredCursos.length === 0
                ? <div className="py-12 text-center text-muted-foreground text-sm">No hay cursos para mostrar.</div>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b bg-muted/20 text-muted-foreground">
                        <th className="px-3 py-2.5 text-left font-medium">Programa</th>
                        <th className="px-3 py-2.5 text-left font-medium">Local</th>
                        <th className="px-3 py-2.5 text-center font-medium w-12">Cic</th>
                        <th className="px-3 py-2.5 text-center font-medium w-12">Sec</th>
                        <th className="px-3 py-2.5 text-left font-medium">Curso</th>
                        <th className="px-3 py-2.5 text-center font-medium w-12">H</th>
                        <th className="px-3 py-2.5 text-left font-medium">Docente</th>
                        <th className="px-3 py-2.5 text-left font-medium w-28">Día</th>
                        <th className="px-3 py-2.5 text-left font-medium w-28">Horario</th>
                        <th className="px-3 py-2.5 text-center font-medium w-20">Estado</th>
                      </tr></thead>
                      <tbody>
                        {filteredCursos.map(c => {
                          const isAssigned = !!c.docenteId;
                          return (
                            <tr key={c.id} className={`border-b last:border-0 hover:bg-muted/10 transition-colors ${!isAssigned ? "bg-amber-50/40" : ""}`}>
                              <td className="px-3 py-2 font-bold text-primary">{c.programa}</td>
                              <td className="px-3 py-2">{c.local}</td>
                              <td className="px-3 py-2 text-center">{c.ciclo}</td>
                              <td className="px-3 py-2 text-center font-mono">{c.seccion}</td>
                              <td className="px-3 py-2 font-medium">{c.nombreCurso}</td>
                              <td className="px-3 py-2 text-center">
                                <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">{c.horasAcad}h</Badge>
                              </td>
                              <td className="px-3 py-2">
                                {c.docente
                                  ? <span className="font-semibold text-[11px]">{c.docente}</span>
                                  : <span className="text-muted-foreground italic text-[11px]">Sin asignar</span>}
                              </td>
                              <td className="px-3 py-2">
                                {c.dia ? DIAS_LABEL[DIAS_NUM[c.dia]] || "" : "—"}
                              </td>
                              <td className="px-3 py-2 font-mono">
                                {c.horaInicio && c.horaFin ? `${c.horaInicio}–${c.horaFin}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {isAssigned
                                  ? <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">✓ OK</Badge>
                                  : <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Pendiente</Badge>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══ STEP 4: VISTA & EXPORTAR ══════════════════════════════════════════ */}
      {tab === "exportar" && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-green-700">{stats.assigned}</div>
                  <div className="text-xs text-green-600">Cursos asignados</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
                <div>
                  <div className="text-2xl font-bold text-amber-700">{stats.unassigned}</div>
                  <div className="text-xs text-amber-600">Sin docente disponible</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4 flex items-center gap-3">
                <User className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold text-blue-700">{stats.uniqueDocentes}</div>
                  <div className="text-xs text-blue-600">Docentes asignados</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={() => exportPlanningExcel(cursos, semestre)}
            className="gap-2 w-full py-5 text-base bg-primary hover:bg-primary/90"
            disabled={!cursos.length}>
            <Download className="w-5 h-5" />
            Descargar PLANIFICACION_{semestre}_GENERADA.xlsx
          </Button>

          {stats.unassigned > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>⚠ {stats.unassigned} cursos sin docente:</strong> Sube más Excel de disponibilidad o asigna manualmente en el paso 3.
            </div>
          )}

          {/* Mini schedule by program */}
          {activeDias.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-primary" />
                  Vista de horario
                  {filterProg && <Badge className="bg-primary/10 text-primary border-0">{filterProg}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[10px]">
                    <thead><tr className="bg-primary text-white">
                      <th className="border border-primary/40 px-2 py-1.5 text-center font-semibold w-16">Hora</th>
                      {activeDias.map(d => <th key={d} className="border border-primary/40 px-2 py-1.5 text-center font-semibold">{DIAS_LABEL[d]}</th>)}
                    </tr></thead>
                    <tbody>
                      {activeSlots.map(slot => (
                        <tr key={slot}>
                          <td className="border border-gray-200 bg-[#D9E0F1] px-1 py-1 text-center font-mono text-[9px] font-bold">{slot}</td>
                          {activeDias.map(dia => {
                            const cells = gridCells.get(`${dia}|${slot}`) ?? [];
                            if (cells.length > 0) return (
                              <td key={dia} className="border border-gray-200 p-0.5 align-top">
                                <div className="flex flex-col gap-0.5 max-h-24 overflow-y-auto">
                                  {cells.slice(0, 3).map((c, ci) => (
                                    <div key={ci} className="rounded p-0.5 bg-blue-50 border border-blue-200 text-center">
                                      <div className="font-bold text-[8px] truncate">{c.nombreCurso}</div>
                                      <div className="text-[7px] text-muted-foreground truncate">{c.programa} {c.ciclo}{c.seccion}</div>
                                      {c.docente && <div className="text-[7px] text-blue-600 truncate">{c.docente.split(" ")[0]}</div>}
                                    </div>
                                  ))}
                                  {cells.length > 3 && <div className="text-[8px] text-center text-muted-foreground">+{cells.length - 3} más</div>}
                                </div>
                              </td>
                            );
                            return <td key={dia} className="border border-gray-100 bg-white" />;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
