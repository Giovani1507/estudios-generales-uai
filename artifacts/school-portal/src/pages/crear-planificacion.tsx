import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Trash2, Edit2, Check, X, AlertTriangle, User,
  Calendar, Clock, BookOpen, LayoutGrid, ChevronDown,
  FileSpreadsheet, Eye, Plus, CheckCircle2, XCircle,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Types ───────────────────────────────────────────────────────────────────
type SlotKey = string; // "DIA|07:40"
type DocenteDisponibilidad = {
  id: string;
  docente: string;
  local: string;
  grado: string;
  titulo: string;
  semestre: string;
  slots: SlotKey[]; // "LUNES|07:40", "MARTES|09:20", ...
  fileName: string;
};

type Asignacion = {
  id: string;
  docenteId: string;
  docente: string;
  curso: string;
  carrera: string;
  ciclo: string;
  seccion: string;
  tipo: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  local: string;
};

// ── Constants ─────────────────────────────────────────────────────────────
const DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
const DIAS_LABEL: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles",
  JUEVES: "Jueves", VIERNES: "Viernes", SABADO: "Sábado",
};
const SLOTS = [
  "07:40","08:30","09:20","10:10","11:00","11:50",
  "12:40","13:30","14:20","15:10","16:00","16:50",
  "17:40","18:30","19:20","20:10","21:00","21:50","22:40",
];
const SLOT_ENDS: Record<string,string> = {
  "07:40":"08:30","08:30":"09:20","09:20":"10:10","10:10":"11:00",
  "11:00":"11:50","11:50":"12:40","12:40":"13:30","13:30":"14:20",
  "14:20":"15:10","15:10":"16:00","16:00":"16:50","16:50":"17:40",
  "17:40":"18:30","18:30":"19:20","19:20":"20:10","20:10":"21:00",
  "21:00":"21:50","21:50":"22:40","22:40":"23:30",
};

// Normalize header row day names (handles accented chars)
const HEADER_TO_DIA: Record<string, string> = {
  lunes:"LUNES", martes:"MARTES", "mi\u00e9rcoles":"MIERCOLES",
  miercoles:"MIERCOLES", jueves:"JUEVES", viernes:"VIERNES", s\u00e1bado:"SABADO", sabado:"SABADO",
};

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function timeToMin(t: string) { const [h,m]=t.split(":").map(Number); return h*60+(m||0); }
function overlaps(aS:string,aE:string,bS:string,bE:string) {
  return timeToMin(aS)<timeToMin(bE) && timeToMin(bS)<timeToMin(aE);
}

// ── Excel Parser ─────────────────────────────────────────────────────────
function parseDisponibilidadExcel(file: File): Promise<Omit<DocenteDisponibilidad,"id">> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        // Find teacher name, local, grado, titulo, semestre
        let docente = "", local = "", grado = "", titulo = "", semestre = "2026-1";
        for (const row of rows) {
          const flat = row.map((c: any) => String(c).trim());
          // Semestre row
          const sem = flat.find(c => c.includes("2026") || c.includes("SEMESTRE"));
          if (sem && !semestre) semestre = sem;

          for (let ci = 0; ci < flat.length; ci++) {
            const cell = flat[ci];
            if (/apellidos|nombres/i.test(cell) && !docente) {
              // Docente is in the next non-empty cell
              for (let k = ci+1; k < flat.length; k++) {
                if (flat[k] && !/disponible/i.test(flat[k])) { docente = flat[k]; break; }
              }
            }
            if (/^local:/i.test(cell) && !local) {
              for (let k = ci+1; k < flat.length; k++) {
                if (flat[k]) { local = flat[k]; break; }
              }
            }
            if (/grado:/i.test(cell) && !grado) {
              for (let k = ci+1; k < flat.length; k++) {
                if (flat[k]) { grado = flat[k]; break; }
              }
            }
            if (/t[íi]tulo/i.test(cell) && !titulo) {
              for (let k = ci+1; k < flat.length; k++) {
                if (flat[k]) { titulo = flat[k]; break; }
              }
            }
          }
        }

        // Find header row with dias
        let headerRow = -1;
        let colToDia: Record<number, string> = {};
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

        // Extract slots
        const slots: SlotKey[] = [];
        if (headerRow >= 0) {
          for (let ri = headerRow + 1; ri < rows.length; ri++) {
            const row = rows[ri].map((c: any) => String(c).trim());
            // Get hora from horaCol or first non-empty col
            const horaRaw = horaCol >= 0 ? row[horaCol] : row.find(c => /^\d{2}:\d{2}/.test(c)) || "";
            const horaInicio = horaRaw.split(/[\r\n]/)[0].trim().slice(0,5);
            if (!horaInicio || !SLOTS.includes(horaInicio)) continue;

            for (const [ci, dia] of Object.entries(colToDia)) {
              const val = row[Number(ci)];
              if (/disponible/i.test(val)) {
                slots.push(`${dia}|${horaInicio}`);
              }
            }
          }
        }

        resolve({ docente: docente || file.name.replace(/\.xlsx?$/, ""), local, grado, titulo, semestre, slots, fileName: file.name });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsArrayBuffer(file);
  });
}

// ── Custom Select ────────────────────────────────────────────────────────
function Sel({ value, onChange, options, placeholder = "Seleccionar...", className="" }: {
  value: string; onChange: (v: string)=>void;
  options: {value:string;label:string}[];
  placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);
  const label = options.find(o=>o.value===value)?.label ?? placeholder;
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className="w-full flex items-center justify-between h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors">
        <span className={value?"text-foreground":"text-muted-foreground"}>{label}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open?"rotate-180":""}`}/>
      </button>
      {open && (
        <div className="absolute z-50 top-10 left-0 right-0 bg-popover border border-border rounded-md shadow-lg py-1 max-h-52 overflow-y-auto">
          {options.map(o=>(
            <button key={o.value} type="button" onClick={()=>{onChange(o.value);setOpen(false);}}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${o.value===value?"bg-primary/10 text-primary font-medium":""}`}>
              {o.value===value ? <Check className="w-3 h-3 shrink-0"/> : <span className="w-3 h-3 shrink-0"/>}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Disponibilidad grid preview ───────────────────────────────────────────
function DispGrid({ disp }: { disp: DocenteDisponibilidad }) {
  const slotSet = new Set(disp.slots);
  const usedDias = DIAS.filter(d => disp.slots.some(s => s.startsWith(d+"|")));
  const usedSlots = SLOTS.filter(s => disp.slots.some(k => k.endsWith("|"+s)));
  if (usedDias.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">Sin disponibilidades registradas.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-collapse">
        <thead>
          <tr>
            <th className="px-2 py-1 bg-primary text-white font-semibold border border-primary/40 w-20">Hora</th>
            {usedDias.map(d=>(
              <th key={d} className="px-4 py-1 bg-primary text-white font-semibold border border-primary/40 min-w-[80px]">{DIAS_LABEL[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {usedSlots.map(slot=>(
            <tr key={slot}>
              <td className="px-2 py-1 bg-[#D9E0F1] border border-gray-200 font-mono font-bold text-center whitespace-nowrap">
                {slot}<br/>{SLOT_ENDS[slot]}
              </td>
              {usedDias.map(dia=>{
                const has = slotSet.has(`${dia}|${slot}`);
                return (
                  <td key={dia} className={`border border-gray-200 text-center px-2 py-1 ${has?"bg-green-100 text-green-700 font-bold":"bg-gray-50 text-gray-300"}`}>
                    {has ? "✓" : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Types for tabs ───────────────────────────────────────────────────────
type Tab = "disponibilidades" | "asignaciones" | "horario";

// ── Main ─────────────────────────────────────────────────────────────────
export default function CrearPlanificacion() {
  const [tab, setTab] = useState<Tab>("disponibilidades");

  // Persistence
  const [disps, setDisps] = useState<DocenteDisponibilidad[]>(()=>{
    try { return JSON.parse(localStorage.getItem("plan2_disps")||"[]"); } catch { return []; }
  });
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>(()=>{
    try { return JSON.parse(localStorage.getItem("plan2_assigns")||"[]"); } catch { return []; }
  });
  useEffect(()=>{ localStorage.setItem("plan2_disps", JSON.stringify(disps)); },[disps]);
  useEffect(()=>{ localStorage.setItem("plan2_assigns", JSON.stringify(asignaciones)); },[asignaciones]);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadMsgs, setUploadMsgs] = useState<{name:string;ok:boolean;msg:string}[]>([]);
  const [preview, setPreview] = useState<string|null>(null);
  const [search, setSearch] = useState("");

  // ── Drag & Drop ──────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f=>f.name.match(/\.xlsx?$/i));
    if (!arr.length) return;
    setUploading(true);
    const msgs: typeof uploadMsgs = [];
    for (const file of arr) {
      try {
        const parsed = await parseDisponibilidadExcel(file);
        const existing = disps.find(d => d.docente === parsed.docente && d.local === parsed.local);
        if (existing) {
          setDisps(prev=>prev.map(d=>d.id===existing.id?{...d,...parsed,id:d.id}:d));
          msgs.push({name:file.name, ok:true, msg:`Actualizado: ${parsed.docente} (${parsed.slots.length} slots)`});
        } else {
          setDisps(prev=>[...prev, {...parsed, id:uid()}]);
          msgs.push({name:file.name, ok:true, msg:`Cargado: ${parsed.docente} — ${parsed.slots.length} disponibilidades`});
        }
      } catch(err:any) {
        msgs.push({name:file.name, ok:false, msg:`Error al leer el archivo: ${err.message}`});
      }
    }
    setUploadMsgs(msgs);
    setUploading(false);
  }, [disps]);

  // ── Assignment form ──────────────────────────────────────────────────
  const emptyAsgn = { docenteId:"", docente:"", curso:"", carrera:"", ciclo:"", seccion:"", tipo:"T", dia:"", horaInicio:"", horaFin:"", local:"" };
  const [asgnForm, setAsgnForm] = useState(emptyAsgn);
  const [asgnEdit, setAsgnEdit] = useState<string|null>(null);
  const [asgnErr, setAsgnErr] = useState("");
  const [asgnWarn, setAsgnWarn] = useState("");

  const selectedDisp = useMemo(()=>disps.find(d=>d.id===asgnForm.docenteId)||null,[disps,asgnForm.docenteId]);
  const slotSet = useMemo(()=>new Set(selectedDisp?.slots||[]),[selectedDisp]);

  function slotAvailable(dia:string, hora:string) { return slotSet.has(`${dia}|${hora}`); }

  function checkConflict(form: typeof emptyAsgn, excludeId?: string) {
    const errs:string[]=[], warns:string[]=[];
    if (!form.docenteId||!form.dia||!form.horaInicio||!form.horaFin) return {errs,warns};
    if (!slotAvailable(form.dia, form.horaInicio)) {
      warns.push(`${form.docente} no marcó disponibilidad para ${DIAS_LABEL[form.dia]} ${form.horaInicio}.`);
    }
    const conflict = asignaciones.find(a=>
      a.id!==excludeId && a.docenteId===form.docenteId && a.dia===form.dia &&
      overlaps(a.horaInicio,a.horaFin,form.horaInicio,form.horaFin)
    );
    if (conflict) errs.push(`CRUCE: ${form.docente} ya tiene "${conflict.curso}" (${conflict.carrera}${conflict.ciclo}${conflict.seccion}) el ${DIAS_LABEL[form.dia]} ${conflict.horaInicio}–${conflict.horaFin}.`);
    return {errs,warns};
  }

  function upd(patch: Partial<typeof emptyAsgn>) {
    const next={...asgnForm,...patch};
    if (patch.docenteId) {
      const d=disps.find(x=>x.id===patch.docenteId);
      if(d) next.docente=d.docente, next.local=d.local;
    }
    setAsgnForm(next);
    const {errs,warns}=checkConflict(next, asgnEdit||undefined);
    setAsgnErr(errs[0]||""); setAsgnWarn(warns[0]||"");
  }

  function saveAsgn() {
    const {docenteId,docente,curso,carrera,ciclo,seccion,dia,horaInicio,horaFin}=asgnForm;
    if(!docenteId||!curso.trim()||!carrera.trim()||!ciclo.trim()||!seccion.trim()||!dia||!horaInicio||!horaFin){
      setAsgnErr("Completa todos los campos obligatorios."); return;
    }
    if(timeToMin(horaInicio)>=timeToMin(horaFin)){
      setAsgnErr("La hora de fin debe ser posterior al inicio."); return;
    }
    const{errs}=checkConflict(asgnForm,asgnEdit||undefined);
    if(errs.length){setAsgnErr(errs[0]);return;}
    if(asgnEdit){
      setAsignaciones(prev=>prev.map(a=>a.id===asgnEdit?{...a,...asgnForm}:a));
      setAsgnEdit(null);
    } else {
      setAsignaciones(prev=>[...prev,{id:uid(),...asgnForm}]);
    }
    setAsgnForm(emptyAsgn); setAsgnErr(""); setAsgnWarn("");
  }

  function startEditAsgn(a:Asignacion){
    setAsgnEdit(a.id);
    const{id:_,...rest}=a;
    setAsgnForm(rest); setAsgnErr(""); setAsgnWarn("");
    setTab("asignaciones");
  }

  const crucesTotal = useMemo(()=>{
    let c=0;
    asignaciones.forEach(a=>{
      const has=asignaciones.some(b=>b.id!==a.id&&b.docenteId===a.docenteId&&b.dia===a.dia&&overlaps(b.horaInicio,b.horaFin,a.horaInicio,a.horaFin));
      if(has) c++;
    });
    return c;
  },[asignaciones]);

  const docenteOptions = useMemo(()=>
    disps.map(d=>({value:d.id,label:d.docente+(d.local?` (${d.local})`:"")})
  ),[disps]);

  const filteredDisps = useMemo(()=>
    disps.filter(d=>!search||d.docente.toLowerCase().includes(search.toLowerCase())||d.local.toLowerCase().includes(search.toLowerCase()))
  ,[disps,search]);

  // ── Grid (horario) ───────────────────────────────────────────────────
  const activeDias = useMemo(()=>{
    const s=new Set(asignaciones.map(a=>a.dia));
    return DIAS.filter(d=>s.has(d));
  },[asignaciones]);
  const activeSlots = useMemo(()=>{
    const used=new Set<string>();
    asignaciones.forEach(a=>{
      const si=SLOTS.indexOf(a.horaInicio), ei=SLOTS.indexOf(a.horaFin);
      if(si>=0) for(let i=si;i<Math.max(si+1,ei);i++) used.add(SLOTS[i]);
    });
    return used.size>0 ? SLOTS.filter((_,i)=>{
      const arr=Array.from(used).map(s=>SLOTS.indexOf(s)).sort((a,b)=>a-b);
      return i>=Math.max(0,arr[0]-1)&&i<=Math.min(SLOTS.length-1,arr[arr.length-1]+1);
    }) : [];
  },[asignaciones]);

  const gridCells = useMemo(()=>{
    const m=new Map<string,{a:Asignacion;cruce:boolean}[]>();
    asignaciones.forEach(a=>{
      const cruce=asignaciones.some(b=>b.id!==a.id&&b.docenteId===a.docenteId&&b.dia===a.dia&&overlaps(b.horaInicio,b.horaFin,a.horaInicio,a.horaFin));
      const k=`${a.dia}|${a.horaInicio}`;
      if(!m.has(k)) m.set(k,[]);
      m.get(k)!.push({a,cruce});
    });
    return m;
  },[asignaciones]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <FileSpreadsheet className="w-5 h-5 text-primary"/>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Crear Planificación</h1>
            <p className="text-sm text-muted-foreground">Semestre 2026-1 · Sube las disponibilidades Excel y asigna cursos</p>
          </div>
        </div>
        {crucesTotal>0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-bold">
            <AlertTriangle className="w-4 h-4"/>
            {crucesTotal} cruce{crucesTotal>1?"s":""} detectado{crucesTotal>1?"s":""}
          </div>
        )}
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {label:"Docentes cargados", value:disps.length, Icon:User, c:"text-blue-600 bg-blue-50"},
          {label:"Slots de disponibilidad", value:disps.reduce((a,d)=>a+d.slots.length,0), Icon:Calendar, c:"text-green-600 bg-green-50"},
          {label:"Asignaciones", value:asignaciones.length, Icon:BookOpen, c:"text-purple-600 bg-purple-50"},
        ].map(s=>(
          <Card key={s.label} className="border-border/60">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.c}`}>
                <s.Icon className="w-5 h-5"/>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {([
          {id:"disponibilidades" as Tab, label:"Disponibilidades", Icon:Upload},
          {id:"asignaciones" as Tab,     label:"Asignaciones",     Icon:BookOpen},
          {id:"horario" as Tab,          label:"Vista de Horario", Icon:LayoutGrid},
        ]).map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              tab===t.id?"bg-primary text-white shadow-sm":"text-muted-foreground hover:text-foreground"}`}>
            <t.Icon className="w-4 h-4"/>
            {t.label}
            {t.id==="horario"&&crucesTotal>0&&(
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{crucesTotal}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ TAB: DISPONIBILIDADES ════════════════════════════════════════ */}
      {tab==="disponibilidades" && (
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={e=>{e.preventDefault();setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={e=>{e.preventDefault();setDragging(false);processFiles(e.dataTransfer.files);}}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
              dragging?"border-primary bg-primary/5":"border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20"}`}
            onClick={()=>{ const inp=document.createElement("input"); inp.type="file"; inp.accept=".xlsx,.xls"; inp.multiple=true; inp.onchange=e=>{processFiles((e.target as HTMLInputElement).files!)}; inp.click(); }}
          >
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3"/>
            <p className="text-base font-semibold text-foreground">
              {uploading ? "Procesando archivos..." : "Arrastra los archivos Excel aquí o haz clic para seleccionar"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Formato: <span className="font-mono">DISPONIBILIDAD HORARIA DOCENTE</span> · Acepta múltiples archivos .xlsx
            </p>
          </div>

          {/* Upload messages */}
          {uploadMsgs.length>0 && (
            <div className="space-y-1.5">
              {uploadMsgs.map((m,i)=>(
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${m.ok?"bg-green-50 border border-green-200 text-green-700":"bg-red-50 border border-red-200 text-red-700"}`}>
                  {m.ok ? <CheckCircle2 className="w-4 h-4 shrink-0"/> : <XCircle className="w-4 h-4 shrink-0"/>}
                  <span className="font-mono text-xs text-muted-foreground">{m.name}</span>
                  <span>{m.msg}</span>
                </div>
              ))}
              <button className="text-xs text-muted-foreground underline" onClick={()=>setUploadMsgs([])}>Limpiar mensajes</button>
            </div>
          )}

          {/* Teacher list */}
          {disps.length>0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-primary"/>
                    Docentes cargados
                    <Badge className="bg-primary/10 text-primary border-0 font-semibold">{disps.length}</Badge>
                  </CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground"/>
                    <Input className="pl-8 h-8 text-sm" placeholder="Buscar docente..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 text-left font-medium">Docente</th>
                        <th className="px-3 py-2.5 text-left font-medium w-28">Local</th>
                        <th className="px-3 py-2.5 text-left font-medium w-24">Slots</th>
                        <th className="px-3 py-2.5 text-left font-medium">Grado / Título</th>
                        <th className="px-3 py-2.5 text-left font-medium w-36">Archivo</th>
                        <th className="px-3 py-2.5 text-center font-medium w-24">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDisps.map(d=>(
                        <React.Fragment key={d.id}>
                          <tr className="border-b hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-xs">{d.docente}</td>
                            <td className="px-3 py-2.5 text-xs">{d.local||<span className="text-muted-foreground italic">—</span>}</td>
                            <td className="px-3 py-2.5">
                              <Badge className="bg-green-100 text-green-700 border-0 font-semibold text-[11px]">{d.slots.length}</Badge>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.grado || d.titulo || "—"}</td>
                            <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground truncate max-w-[140px]" title={d.fileName}>{d.fileName}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={()=>setPreview(preview===d.id?null:d.id)}
                                  title="Ver disponibilidad"
                                  className={`p-1.5 rounded transition-colors ${preview===d.id?"bg-primary/10 text-primary":"hover:bg-muted text-muted-foreground"}`}>
                                  <Eye className="w-3.5 h-3.5"/>
                                </button>
                                <button onClick={()=>setDisps(prev=>prev.filter(x=>x.id!==d.id))} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5"/>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {preview===d.id && (
                            <tr>
                              <td colSpan={6} className="px-4 py-4 bg-muted/5 border-b">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-xs font-bold text-primary">{d.docente}</span>
                                  {d.local && <Badge className="bg-primary/10 text-primary border-0 text-[10px]">{d.local}</Badge>}
                                  <span className="text-xs text-muted-foreground">· {d.slots.length} slots disponibles</span>
                                </div>
                                <DispGrid disp={d}/>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {filteredDisps.length===0 && (
                        <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No hay docentes que coincidan con la búsqueda.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══ TAB: ASIGNACIONES ═══════════════════════════════════════════ */}
      {tab==="asignaciones" && (
        <div className="grid grid-cols-[380px_1fr] gap-5">
          {/* Form */}
          <Card className="border-border/60 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {asgnEdit?<><Edit2 className="w-4 h-4 text-primary"/>Editar</>:<><Plus className="w-4 h-4 text-primary"/>Nueva Asignación</>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {disps.length===0 ? (
                <div className="text-xs text-muted-foreground p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600"/>
                  Primero sube los archivos Excel de disponibilidad en la pestaña anterior.
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Docente *</label>
                    <Sel value={asgnForm.docenteId} onChange={v=>upd({docenteId:v})} options={docenteOptions} placeholder="Seleccionar docente..."/>
                  </div>

                  {selectedDisp && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">
                      <span className="font-bold">{selectedDisp.docente}</span>
                      {selectedDisp.local && <span className="ml-1.5 text-blue-600">({selectedDisp.local})</span>}
                      <span className="ml-1.5 text-blue-600">— {selectedDisp.slots.length} slots disponibles</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Carrera *</label>
                      <Input placeholder="IC" value={asgnForm.carrera} onChange={e=>upd({carrera:e.target.value.toUpperCase()})} className="uppercase"/>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Ciclo *</label>
                      <Input placeholder="1" value={asgnForm.ciclo} onChange={e=>upd({ciclo:e.target.value})}/>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Secc. *</label>
                      <Input placeholder="A" value={asgnForm.seccion} onChange={e=>upd({seccion:e.target.value.toUpperCase()})} className="uppercase"/>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Curso *</label>
                    <Input placeholder="Ej: Cálculo I" value={asgnForm.curso} onChange={e=>upd({curso:e.target.value})}/>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Tipo</label>
                    <Sel value={asgnForm.tipo} onChange={v=>upd({tipo:v})}
                      options={[{value:"T",label:"Teoría (T)"},{value:"P",label:"Práctica (P)"},{value:"TP",label:"Teoría-Práctica (TP)"}]}/>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Día *</label>
                    <Sel value={asgnForm.dia} onChange={v=>upd({dia:v,horaInicio:"",horaFin:""})} options={DIAS.map(d=>({value:d,label:DIAS_LABEL[d]}))} placeholder="Seleccionar día..."/>
                  </div>

                  {asgnForm.dia && selectedDisp && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Hora Inicio *</label>
                        <Sel value={asgnForm.horaInicio} onChange={v=>upd({horaInicio:v,horaFin:SLOT_ENDS[v]||""})}
                          options={SLOTS.map(s=>({
                            value:s,
                            label: slotAvailable(asgnForm.dia,s) ? `✓ ${s}` : s,
                          }))} placeholder="Inicio"/>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Hora Fin *</label>
                        <Sel value={asgnForm.horaFin} onChange={v=>upd({horaFin:v})}
                          options={SLOTS.filter(s=>!asgnForm.horaInicio||timeToMin(s)>timeToMin(asgnForm.horaInicio)).map(s=>({value:s,label:s}))}
                          placeholder="Fin"/>
                      </div>
                    </div>
                  )}

                  {asgnErr && (
                    <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>{asgnErr}
                    </div>
                  )}
                  {!asgnErr && asgnWarn && (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>{asgnWarn}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button onClick={saveAsgn} disabled={!!asgnErr} className="flex-1 gap-2">
                      <Check className="w-4 h-4"/>
                      {asgnEdit?"Guardar cambios":"Agregar asignación"}
                    </Button>
                    {asgnEdit && (
                      <Button variant="outline" onClick={()=>{setAsgnEdit(null);setAsgnForm(emptyAsgn);setAsgnErr("");setAsgnWarn("");}}>
                        <X className="w-4 h-4"/>
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary"/>
                Asignaciones
                <Badge className="bg-primary/10 text-primary border-0 font-semibold">{asignaciones.length}</Badge>
                {crucesTotal>0 && <Badge className="bg-red-100 text-red-700 border-0 font-semibold"><AlertTriangle className="w-3 h-3 mr-1"/>{crucesTotal} cruces</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {asignaciones.length===0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">No hay asignaciones aún.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-medium">Docente</th>
                      <th className="px-3 py-2.5 text-left font-medium">Curso</th>
                      <th className="px-3 py-2.5 text-left font-medium w-24">Car/Cic/Sec</th>
                      <th className="px-3 py-2.5 text-left font-medium w-24">Día</th>
                      <th className="px-3 py-2.5 text-left font-medium w-28">Horario</th>
                      <th className="px-3 py-2.5 text-center font-medium w-16">Estado</th>
                      <th className="px-3 py-2.5 text-center font-medium w-16">Acc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...asignaciones].sort((a,b)=>a.docente.localeCompare(b.docente)||DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)).map(a=>{
                      const cruce=asignaciones.some(b=>b.id!==a.id&&b.docenteId===a.docenteId&&b.dia===a.dia&&overlaps(b.horaInicio,b.horaFin,a.horaInicio,a.horaFin));
                      return (
                        <tr key={a.id} className={`border-b last:border-0 hover:bg-muted/10 transition-colors ${cruce?"bg-red-50":""}`}>
                          <td className="px-4 py-2.5 text-xs font-medium">{a.docente}</td>
                          <td className="px-3 py-2.5 text-xs">{a.curso}</td>
                          <td className="px-3 py-2.5 text-xs font-mono"><span className="font-bold text-primary">{a.carrera}</span> {a.ciclo}{a.seccion}</td>
                          <td className="px-3 py-2.5 text-xs">{DIAS_LABEL[a.dia]}</td>
                          <td className="px-3 py-2.5 font-mono text-xs">{a.horaInicio}–{a.horaFin}</td>
                          <td className="px-3 py-2.5 text-center">
                            {cruce ? <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">CRUCE</Badge>
                                   : <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">OK</Badge>}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={()=>startEditAsgn(a)} className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                              <button onClick={()=>setAsignaciones(prev=>prev.filter(x=>x.id!==a.id))} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══ TAB: HORARIO ════════════════════════════════════════════════ */}
      {tab==="horario" && (
        <div className="space-y-4">
          {asignaciones.length===0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Agrega asignaciones para ver el horario.</div>
          ) : (
            <>
              {crucesTotal>0 && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0"/>
                  <span><strong>{crucesTotal} cruce{crucesTotal>1?"s":""}</strong> detectado{crucesTotal>1?"s":""}. Las celdas en rojo indican docentes asignados simultáneamente. Corríge en la pestaña <strong>Asignaciones</strong>.</span>
                </div>
              )}
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block"/>Sin cruce</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block"/>Con cruce</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block"/>Dentro de disponibilidad</span>
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full border-collapse text-[11px] min-w-[600px]">
                  <thead>
                    <tr className="bg-primary text-white">
                      <th className="border border-primary/40 px-3 py-2 text-center font-semibold w-20">Hora</th>
                      {activeDias.map(d=>(
                        <th key={d} className="border border-primary/40 px-3 py-2 text-center font-semibold">{DIAS_LABEL[d]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeSlots.map(slot=>(
                      <tr key={slot}>
                        <td className="border border-gray-200 bg-[#D9E0F1] px-2 py-1.5 text-center font-mono text-[9px] whitespace-nowrap font-bold">
                          {slot}<br/>{SLOT_ENDS[slot]}
                        </td>
                        {activeDias.map(dia=>{
                          const cells = gridCells.get(`${dia}|${slot}`) ?? [];
                          if (cells.length>0) {
                            return (
                              <td key={dia} className="border border-gray-200 p-0.5 align-top">
                                <div className="flex flex-col gap-0.5">
                                  {cells.map((cell,ci)=>(
                                    <div key={ci} className={`rounded p-1 text-center ${cell.cruce?"bg-red-100 border border-red-300":"bg-blue-50 border border-blue-200"}`}>
                                      <div className="font-bold text-[9px] text-gray-800 truncate">{cell.a.curso}</div>
                                      <div className="text-[8px] text-gray-600 truncate">{cell.a.docente.split(" ").slice(0,2).join(" ")}</div>
                                      <div className="text-[8px] font-mono text-gray-500">{cell.a.carrera} {cell.a.ciclo}{cell.a.seccion}</div>
                                      {cell.cruce && <div className="text-[8px] text-red-600 font-bold">⚠ CRUCE</div>}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            );
                          }
                          const spanned = asignaciones.some(a=>{
                            if(a.dia!==dia) return false;
                            const si=SLOTS.indexOf(a.horaInicio), ei=SLOTS.indexOf(a.horaFin), ci=SLOTS.indexOf(slot);
                            return si>=0 && ci>si && ci<ei;
                          });
                          if(spanned) return null;
                          return <td key={dia} className="border border-gray-100 bg-white"/>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
