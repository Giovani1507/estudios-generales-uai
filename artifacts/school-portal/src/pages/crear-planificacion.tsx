import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Trash2, Edit2, Check, X, AlertTriangle, User,
  BookOpen, LayoutGrid, ChevronDown, Wand2,
  FileSpreadsheet, Eye, Plus, CheckCircle2, XCircle,
  Search, ListChecks, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Types ────────────────────────────────────────────────────────────────────
type SlotKey = string; // "DIA|07:40"

type DocenteDisp = {
  id: string;
  docente: string;
  local: string;
  grado: string;
  titulo: string;
  slots: SlotKey[];
  fileName: string;
};

type CursoTemplate = {
  id: string;
  carrera: string;
  ciclo: string;
  seccion: string;
  curso: string;
  tipo: string;          // T | P | TP
  horasSesion: number;   // horas académicas por sesión (p.ej. 2, 4, 6)
  sesionesSemanales: number; // nro de sesiones por semana (normalmente 1)
};

type Asignacion = {
  id: string;
  cursoTemplateId?: string; // link to catalog
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
  autoAsignado?: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────
const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_LABEL: Record<string,string> = {
  LUNES:"Lunes",MARTES:"Martes",MIERCOLES:"Miércoles",
  JUEVES:"Jueves",VIERNES:"Viernes",SABADO:"Sábado",
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
const HEADER_TO_DIA: Record<string,string> = {
  lunes:"LUNES",martes:"MARTES","mi\u00e9rcoles":"MIERCOLES",
  miercoles:"MIERCOLES",jueves:"JUEVES",viernes:"VIERNES",
  "s\u00e1bado":"SABADO",sabado:"SABADO",
};

function uid() { return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function timeToMin(t:string) { const[h,m]=t.split(":").map(Number); return h*60+(m||0); }
function overlaps(aS:string,aE:string,bS:string,bE:string) {
  return timeToMin(aS)<timeToMin(bE)&&timeToMin(bS)<timeToMin(aE);
}

// ── Parse Excel ───────────────────────────────────────────────────────────
async function parseDisponibilidadExcel(file:File): Promise<Omit<DocenteDisp,"id">> {
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data,{type:"array"});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows:any[][] = XLSX.utils.sheet_to_json(ws,{header:1,defval:""});

        let docente="",local="",grado="",titulo="";
        for (const row of rows) {
          const flat=row.map((c:any)=>String(c).trim());
          for (let ci=0;ci<flat.length;ci++) {
            const cell=flat[ci];
            if(/apellidos|nombres/i.test(cell)&&!docente) {
              for (let k=ci+1;k<flat.length;k++) { if(flat[k]&&!/disponible|local|grado|t[íi]tulo/i.test(flat[k])){docente=flat[k];break;} }
            }
            if(/^local:/i.test(cell)&&!local) { for(let k=ci+1;k<flat.length;k++){if(flat[k]){local=flat[k];break;}} }
            if(/grado:/i.test(cell)&&!grado) { for(let k=ci+1;k<flat.length;k++){if(flat[k]){grado=flat[k];break;}} }
            if(/t[íi]tulo/i.test(cell)&&!titulo) { for(let k=ci+1;k<flat.length;k++){if(flat[k]){titulo=flat[k];break;}} }
          }
        }

        let headerRow=-1;
        const colToDia:Record<number,string>={};
        let horaCol=-1;
        for (let ri=0;ri<rows.length;ri++) {
          const row=rows[ri].map((c:any)=>String(c).trim().toLowerCase());
          if(row.some(c=>c==="lunes"||c==="martes")) {
            headerRow=ri;
            for(let ci=0;ci<row.length;ci++){
              const mapped=HEADER_TO_DIA[row[ci]];
              if(mapped) colToDia[ci]=mapped;
              if(row[ci]==="hora") horaCol=ci;
            }
            break;
          }
        }

        const slots:SlotKey[]=[];
        if(headerRow>=0) {
          for(let ri=headerRow+1;ri<rows.length;ri++) {
            const row=rows[ri].map((c:any)=>String(c).trim());
            const horaRaw=horaCol>=0?row[horaCol]:row.find(c=>/^\d{2}:\d{2}/.test(c))||"";
            const horaInicio=horaRaw.split(/[\r\n]/)[0].trim().slice(0,5);
            if(!horaInicio||!SLOTS.includes(horaInicio)) continue;
            for(const[ci,dia] of Object.entries(colToDia)){
              if(/disponible/i.test(row[Number(ci)])) slots.push(`${dia}|${horaInicio}`);
            }
          }
        }

        resolve({docente:docente||file.name.replace(/\.xlsx?$/,""),local,grado,titulo,slots,fileName:file.name});
      } catch(err){ reject(err); }
    };
    reader.onerror=()=>reject(new Error("No se pudo leer el archivo."));
    reader.readAsArrayBuffer(file);
  });
}

// ── Auto-assign algorithm ─────────────────────────────────────────────────
function runAutoAssign(
  catalogo: CursoTemplate[],
  disps: DocenteDisp[],
  existingAsignaciones: Asignacion[],
): { nuevas: Asignacion[]; sinDocente: CursoTemplate[] } {
  const nuevas: Asignacion[] = [...existingAsignaciones];
  const sinDocente: CursoTemplate[] = [];

  // Already assigned course templates
  const assignedTemplates = new Set(existingAsignaciones.map(a=>a.cursoTemplateId).filter(Boolean));

  for (const ct of catalogo) {
    if(assignedTemplates.has(ct.id)) continue; // already assigned

    let assigned = false;
    for (const disp of disps) {
      if(assigned) break;
      const slotSet = new Set(disp.slots);
      // Build currently occupied slots for this teacher (from nuevas)
      const occupied = new Set<string>();
      nuevas.filter(a=>a.docenteId===disp.id).forEach(a=>{
        const si=SLOTS.indexOf(a.horaInicio), ei=SLOTS.indexOf(a.horaFin);
        for(let i=si;i<ei;i++) DIAS.forEach(d=>{ if(d===a.dia) occupied.add(`${d}|${SLOTS[i]}`); });
      });

      // Try each day and start slot
      for(const dia of DIAS) {
        if(assigned) break;
        for(let si=0;si<=SLOTS.length-ct.horasSesion;si++){
          // Check ct.horasSesion consecutive slots available and not occupied
          let ok=true;
          for(let i=si;i<si+ct.horasSesion;i++){
            const k=`${dia}|${SLOTS[i]}`;
            if(!slotSet.has(k)||occupied.has(k)){ok=false;break;}
          }
          if(!ok) continue;

          const horaInicio=SLOTS[si];
          const horaFin=SLOTS[si+ct.horasSesion] || SLOT_ENDS[SLOTS[si+ct.horasSesion-1]] || "";
          if(!horaFin) continue;

          // Check conflict with existing assignments of this teacher
          const conflict=nuevas.some(a=>
            a.docenteId===disp.id&&a.dia===dia&&
            overlaps(a.horaInicio,a.horaFin,horaInicio,horaFin)
          );
          if(conflict) continue;

          // Assign!
          const asgn: Asignacion = {
            id:uid(), cursoTemplateId:ct.id,
            docenteId:disp.id, docente:disp.docente,
            curso:ct.curso, carrera:ct.carrera, ciclo:ct.ciclo, seccion:ct.seccion,
            tipo:ct.tipo, dia, horaInicio, horaFin, local:disp.local,
            autoAsignado:true,
          };
          nuevas.push(asgn);
          assignedTemplates.add(ct.id);
          // Mark slots occupied
          for(let i=si;i<si+ct.horasSesion;i++) occupied.add(`${dia}|${SLOTS[i]}`);
          assigned=true;
          break;
        }
      }
    }
    if(!assigned) sinDocente.push(ct);
  }

  return { nuevas: nuevas.filter(a=>!existingAsignaciones.find(e=>e.id===a.id)), sinDocente };
}

// ── Sel ────────────────────────────────────────────────────────────────────
function Sel({value,onChange,options,placeholder="Seleccionar...",className=""}:{
  value:string;onChange:(v:string)=>void;
  options:{value:string;label:string}[];
  placeholder?:string;className?:string;
}) {
  const[open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const label=options.find(o=>o.value===value)?.label??placeholder;
  return(
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className="w-full flex items-center justify-between h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors">
        <span className={value?"text-foreground":"text-muted-foreground"}>{label}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open?"rotate-180":""}`}/>
      </button>
      {open&&(
        <div className="absolute z-50 top-10 left-0 right-0 bg-popover border border-border rounded-md shadow-lg py-1 max-h-52 overflow-y-auto">
          {options.map(o=>(
            <button key={o.value} type="button" onClick={()=>{onChange(o.value);setOpen(false);}}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${o.value===value?"bg-primary/10 text-primary font-medium":""}`}>
              {o.value===value?<Check className="w-3 h-3 shrink-0"/>:<span className="w-3 h-3 shrink-0"/>}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Disp Grid ──────────────────────────────────────────────────────────────
function DispGrid({disp}:{disp:DocenteDisp}) {
  const slotSet=new Set(disp.slots);
  const usedDias=DIAS.filter(d=>disp.slots.some(s=>s.startsWith(d+"|")));
  const usedSlots=SLOTS.filter(s=>disp.slots.some(k=>k.endsWith("|"+s)));
  if(!usedDias.length) return <div className="text-xs text-muted-foreground py-4 text-center">Sin disponibilidades registradas.</div>;
  return(
    <div className="overflow-x-auto">
      <table className="text-[10px] border-collapse">
        <thead><tr>
          <th className="px-2 py-1 bg-primary text-white font-semibold border border-primary/40 w-20">Hora</th>
          {usedDias.map(d=><th key={d} className="px-4 py-1 bg-primary text-white font-semibold border border-primary/40 min-w-[80px]">{DIAS_LABEL[d]}</th>)}
        </tr></thead>
        <tbody>
          {usedSlots.map(slot=>(
            <tr key={slot}>
              <td className="px-2 py-1 bg-[#D9E0F1] border border-gray-200 font-mono font-bold text-center whitespace-nowrap">{slot}<br/>{SLOT_ENDS[slot]}</td>
              {usedDias.map(dia=>{
                const has=slotSet.has(`${dia}|${slot}`);
                return <td key={dia} className={`border border-gray-200 text-center px-2 py-1 ${has?"bg-green-100 text-green-700 font-bold":"bg-gray-50 text-gray-300"}`}>{has?"✓":"—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Types for tabs ─────────────────────────────────────────────────────────
type Tab = "disponibilidades"|"catalogo"|"asignaciones"|"horario";

// ══════════════════════════════════════════════════════════════════════════
export default function CrearPlanificacion() {
  const[tab,setTab]=useState<Tab>("disponibilidades");

  // Persistence
  const[disps,setDisps]=useState<DocenteDisp[]>(()=>{try{return JSON.parse(localStorage.getItem("plan3_disps")||"[]");}catch{return[];}});
  const[catalogo,setCatalogo]=useState<CursoTemplate[]>(()=>{try{return JSON.parse(localStorage.getItem("plan3_cat")||"[]");}catch{return[];}});
  const[asignaciones,setAsignaciones]=useState<Asignacion[]>(()=>{try{return JSON.parse(localStorage.getItem("plan3_asgn")||"[]");}catch{return[];}});
  useEffect(()=>{localStorage.setItem("plan3_disps",JSON.stringify(disps));},[disps]);
  useEffect(()=>{localStorage.setItem("plan3_cat",JSON.stringify(catalogo));},[catalogo]);
  useEffect(()=>{localStorage.setItem("plan3_asgn",JSON.stringify(asignaciones));},[asignaciones]);

  // Upload
  const[uploading,setUploading]=useState(false);
  const[uploadMsgs,setUploadMsgs]=useState<{name:string;ok:boolean;msg:string}[]>([]);
  const[preview,setPreview]=useState<string|null>(null);
  const[search,setSearch]=useState("");
  const[dragging,setDragging]=useState(false);

  // Auto-assign toast
  const[autoMsg,setAutoMsg]=useState("");

  const processFiles=useCallback(async(files:FileList|File[])=>{
    const arr=Array.from(files).filter(f=>f.name.match(/\.xlsx?$/i));
    if(!arr.length) return;
    setUploading(true);
    const msgs:typeof uploadMsgs=[];
    const newDisps=[...disps];

    for(const file of arr){
      try{
        const parsed=await parseDisponibilidadExcel(file);
        const existing=newDisps.find(d=>d.docente===parsed.docente&&d.local===parsed.local);
        let dispId="";
        if(existing){
          const updated={...existing,...parsed,id:existing.id};
          const idx=newDisps.findIndex(d=>d.id===existing.id);
          newDisps[idx]=updated;
          dispId=existing.id;
          msgs.push({name:file.name,ok:true,msg:`Actualizado: ${parsed.docente} — ${parsed.slots.length} slots`});
        } else {
          const newD={...parsed,id:uid()};
          newDisps.push(newD);
          dispId=newD.id;
          msgs.push({name:file.name,ok:true,msg:`Cargado: ${parsed.docente} — ${parsed.slots.length} slots disponibles`});
        }

        // ── Auto-assign: try to assign unassigned catalog courses to this teacher ──
        if(catalogo.length>0){
          const assignedTpls=new Set(asignaciones.map(a=>a.cursoTemplateId).filter(Boolean));
          const unassigned=catalogo.filter(ct=>!assignedTpls.has(ct.id));
          if(unassigned.length>0){
            const disp=newDisps.find(d=>d.id===dispId)!;
            const{nuevas}=runAutoAssign(unassigned,[disp],asignaciones);
            if(nuevas.length>0){
              setAsignaciones(prev=>[...prev,...nuevas]);
              msgs[msgs.length-1].msg+=` · ✓ Auto-asignado ${nuevas.length} curso(s)`;
            }
          }
        }
      } catch(err:any){
        msgs.push({name:file.name,ok:false,msg:`Error: ${err.message}`});
      }
    }
    setDisps(newDisps);
    setUploadMsgs(msgs);
    setUploading(false);
  },[disps,catalogo,asignaciones]);

  // ── Catalog form ──────────────────────────────────────────────────────
  const emptyCt:Omit<CursoTemplate,"id">={carrera:"",ciclo:"",seccion:"",curso:"",tipo:"T",horasSesion:2,sesionesSemanales:1};
  const[ctForm,setCtForm]=useState(emptyCt);
  const[ctEdit,setCtEdit]=useState<string|null>(null);
  const[ctErr,setCtErr]=useState("");

  function saveCt(){
    const{carrera,ciclo,seccion,curso}=ctForm;
    if(!carrera.trim()||!ciclo.trim()||!seccion.trim()||!curso.trim()){setCtErr("Completa todos los campos.");return;}
    setCtErr("");
    if(ctEdit){
      setCatalogo(prev=>prev.map(c=>c.id===ctEdit?{...c,...ctForm}:c));
      setCtEdit(null);
    } else {
      setCatalogo(prev=>[...prev,{id:uid(),...ctForm}]);
    }
    setCtForm(emptyCt);
  }

  // ── Manual assignment form ────────────────────────────────────────────
  const emptyAsgn={docenteId:"",docente:"",cursoTemplateId:"",curso:"",carrera:"",ciclo:"",seccion:"",tipo:"T",dia:"",horaInicio:"",horaFin:"",local:"",autoAsignado:false};
  const[asgnForm,setAsgnForm]=useState(emptyAsgn);
  const[asgnEdit,setAsgnEdit]=useState<string|null>(null);
  const[asgnErr,setAsgnErr]=useState("");
  const[asgnWarn,setAsgnWarn]=useState("");

  const selectedDisp=useMemo(()=>disps.find(d=>d.id===asgnForm.docenteId)||null,[disps,asgnForm.docenteId]);
  const slotSet=useMemo(()=>new Set(selectedDisp?.slots||[]),[selectedDisp]);
  function slotAvail(dia:string,hora:string){return slotSet.has(`${dia}|${hora}`);}

  function checkConflict(form:typeof emptyAsgn,excludeId?:string){
    const errs:string[]=[],warns:string[]=[];
    if(!form.docenteId||!form.dia||!form.horaInicio||!form.horaFin) return{errs,warns};
    if(!slotAvail(form.dia,form.horaInicio)) warns.push(`${form.docente} no marcó disponibilidad para ese horario.`);
    const conflict=asignaciones.find(a=>a.id!==excludeId&&a.docenteId===form.docenteId&&a.dia===form.dia&&overlaps(a.horaInicio,a.horaFin,form.horaInicio,form.horaFin));
    if(conflict) errs.push(`CRUCE: ${form.docente} ya tiene "${conflict.curso}" el ${DIAS_LABEL[form.dia]} ${conflict.horaInicio}–${conflict.horaFin}.`);
    return{errs,warns};
  }

  function updAsgn(patch:Partial<typeof emptyAsgn>){
    const next={...asgnForm,...patch};
    if(patch.docenteId){const d=disps.find(x=>x.id===patch.docenteId);if(d){next.docente=d.docente;next.local=d.local;}}
    if(patch.cursoTemplateId){
      const ct=catalogo.find(c=>c.id===patch.cursoTemplateId);
      if(ct){next.curso=ct.curso;next.carrera=ct.carrera;next.ciclo=ct.ciclo;next.seccion=ct.seccion;next.tipo=ct.tipo;}
    }
    setAsgnForm(next);
    const{errs,warns}=checkConflict(next,asgnEdit||undefined);
    setAsgnErr(errs[0]||"");setAsgnWarn(warns[0]||"");
  }

  function saveAsgn(){
    const{docenteId,curso,carrera,ciclo,seccion,dia,horaInicio,horaFin}=asgnForm;
    if(!docenteId||!curso.trim()||!carrera.trim()||!ciclo.trim()||!seccion.trim()||!dia||!horaInicio||!horaFin){setAsgnErr("Completa todos los campos.");return;}
    if(timeToMin(horaInicio)>=timeToMin(horaFin)){setAsgnErr("Hora fin debe ser posterior al inicio.");return;}
    const{errs}=checkConflict(asgnForm,asgnEdit||undefined);
    if(errs.length){setAsgnErr(errs[0]);return;}
    if(asgnEdit){
      setAsignaciones(prev=>prev.map(a=>a.id===asgnEdit?{...a,...asgnForm,autoAsignado:false}:a));
      setAsgnEdit(null);
    } else {
      setAsignaciones(prev=>[...prev,{id:uid(),...asgnForm}]);
    }
    setAsgnForm(emptyAsgn);setAsgnErr("");setAsgnWarn("");
  }

  // ── Full auto-assign ───────────────────────────────────────────────────
  function runFullAutoAssign(){
    if(!catalogo.length){setAutoMsg("⚠ Primero define el catálogo de cursos.");return;}
    if(!disps.length){setAutoMsg("⚠ Primero sube las disponibilidades de los docentes.");return;}
    const{nuevas,sinDocente}=runAutoAssign(catalogo,disps,asignaciones);
    if(nuevas.length>0) setAsignaciones(prev=>[...prev,...nuevas]);
    const msg=nuevas.length>0
      ? `✓ ${nuevas.length} asignación(es) creadas automáticamente.${sinDocente.length?` ${sinDocente.length} curso(s) sin docente disponible.`:""}`
      : sinDocente.length>0
        ? `⚠ No se pudo auto-asignar ${sinDocente.length} curso(s). Revisa disponibilidades.`
        : "✓ Todos los cursos ya estaban asignados.";
    setAutoMsg(msg);
    setTimeout(()=>setAutoMsg(""),6000);
  }

  // ── Conflicts ─────────────────────────────────────────────────────────
  const crucesTotal=useMemo(()=>{
    let c=0;
    asignaciones.forEach(a=>{
      if(asignaciones.some(b=>b.id!==a.id&&b.docenteId===a.docenteId&&b.dia===a.dia&&overlaps(b.horaInicio,b.horaFin,a.horaInicio,a.horaFin))) c++;
    });
    return c;
  },[asignaciones]);

  const assignedTemplateIds=useMemo(()=>new Set(asignaciones.map(a=>a.cursoTemplateId).filter(Boolean)),[asignaciones]);

  // ── Grid ──────────────────────────────────────────────────────────────
  const activeDias=useMemo(()=>{const s=new Set(asignaciones.map(a=>a.dia));return DIAS.filter(d=>s.has(d));},[asignaciones]);
  const activeSlots=useMemo(()=>{
    const used=new Set<number>();
    asignaciones.forEach(a=>{const si=SLOTS.indexOf(a.horaInicio),ei=SLOTS.indexOf(a.horaFin);if(si>=0)for(let i=si;i<Math.max(si+1,ei);i++)used.add(i);});
    if(!used.size) return[];
    const arr=Array.from(used).sort((a,b)=>a-b);
    return SLOTS.filter((_,i)=>i>=Math.max(0,arr[0]-1)&&i<=Math.min(SLOTS.length-1,arr[arr.length-1]+1));
  },[asignaciones]);
  const gridCells=useMemo(()=>{
    const m=new Map<string,{a:Asignacion;cruce:boolean}[]>();
    asignaciones.forEach(a=>{
      const cruce=asignaciones.some(b=>b.id!==a.id&&b.docenteId===a.docenteId&&b.dia===a.dia&&overlaps(b.horaInicio,b.horaFin,a.horaInicio,a.horaFin));
      const k=`${a.dia}|${a.horaInicio}`;
      if(!m.has(k)) m.set(k,[]);
      m.get(k)!.push({a,cruce});
    });
    return m;
  },[asignaciones]);

  const docenteOptions=useMemo(()=>disps.map(d=>({value:d.id,label:d.docente+(d.local?` (${d.local})`:"")})),[disps]);
  const catalogoOptions=useMemo(()=>catalogo.map(c=>({value:c.id,label:`${c.carrera} ${c.ciclo}${c.seccion} — ${c.curso} (${c.tipo})`})),[catalogo]);

  // ──────────────────────────────────────────────────────────────────────
  return(
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <FileSpreadsheet className="w-5 h-5 text-primary"/>
          </div>
          <div>
            <h1 className="text-xl font-bold">Crear Planificación</h1>
            <p className="text-sm text-muted-foreground">Semestre 2026-1 · Disponibilidades docentes + auto-asignación</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {crucesTotal>0&&(
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-bold">
              <AlertTriangle className="w-4 h-4"/>{crucesTotal} cruce{crucesTotal>1?"s":""}
            </div>
          )}
          <Button onClick={runFullAutoAssign} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Wand2 className="w-4 h-4"/>Auto-asignar todo
          </Button>
        </div>
      </div>

      {/* Auto-assign toast */}
      {autoMsg&&(
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border ${
          autoMsg.startsWith("✓")?"bg-green-50 border-green-200 text-green-700":"bg-amber-50 border-amber-200 text-amber-700"}`}>
          {autoMsg.startsWith("✓")?<CheckCircle2 className="w-4 h-4 shrink-0"/>:<AlertTriangle className="w-4 h-4 shrink-0"/>}
          {autoMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {label:"Docentes",value:disps.length,Icon:User,c:"text-blue-600 bg-blue-50"},
          {label:"Cursos en catálogo",value:catalogo.length,Icon:ListChecks,c:"text-indigo-600 bg-indigo-50"},
          {label:"Asignados",value:assignedTemplateIds.size,Icon:CheckCircle2,c:"text-green-600 bg-green-50"},
          {label:"Sin asignar",value:catalogo.filter(c=>!assignedTemplateIds.has(c.id)).length,Icon:AlertTriangle,c:"text-amber-600 bg-amber-50"},
        ].map(s=>(
          <Card key={s.label} className="border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.c}`}><s.Icon className="w-4 h-4"/></div>
              <div><div className="text-xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit flex-wrap">
        {([
          {id:"disponibilidades" as Tab,label:"1. Disponibilidades",Icon:Upload},
          {id:"catalogo" as Tab,label:"2. Catálogo de Cursos",Icon:ListChecks},
          {id:"asignaciones" as Tab,label:"3. Asignaciones",Icon:BookOpen},
          {id:"horario" as Tab,label:"4. Vista de Horario",Icon:LayoutGrid},
        ]).map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab===t.id?"bg-primary text-white shadow-sm":"text-muted-foreground hover:text-foreground"}`}>
            <t.Icon className="w-4 h-4"/>{t.label}
            {t.id==="horario"&&crucesTotal>0&&<span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{crucesTotal}</span>}
          </button>
        ))}
      </div>

      {/* ══ TAB 1: DISPONIBILIDADES ════════════════════════════════════════ */}
      {tab==="disponibilidades"&&(
        <div className="space-y-5">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-sm text-blue-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5"/>
            <div>
              <strong>Flujo recomendado:</strong> Primero define el catálogo de cursos (paso 2), luego sube los Excel de disponibilidad.
              El sistema intentará auto-asignar al cargar cada archivo.
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e=>{e.preventDefault();setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={e=>{e.preventDefault();setDragging(false);processFiles(e.dataTransfer.files);}}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${dragging?"border-primary bg-primary/5":"border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20"}`}
            onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept=".xlsx,.xls";inp.multiple=true;inp.onchange=e=>processFiles((e.target as HTMLInputElement).files!);inp.click();}}
          >
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3"/>
            <p className="text-base font-semibold">{uploading?"Procesando...":"Arrastra los Excel de disponibilidad aquí o haz clic para seleccionar"}</p>
            <p className="text-sm text-muted-foreground mt-1">Formato: DISPONIBILIDAD HORARIA DOCENTE · Múltiples archivos .xlsx</p>
            {catalogo.length>0&&<p className="text-xs text-green-600 mt-2 font-semibold">✓ El sistema auto-asignará cursos del catálogo al cargar cada archivo</p>}
          </div>

          {uploadMsgs.length>0&&(
            <div className="space-y-1.5">
              {uploadMsgs.map((m,i)=>(
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${m.ok?"bg-green-50 border border-green-200 text-green-700":"bg-red-50 border border-red-200 text-red-700"}`}>
                  {m.ok?<CheckCircle2 className="w-4 h-4 shrink-0"/>:<XCircle className="w-4 h-4 shrink-0"/>}
                  <span className="font-mono text-xs text-muted-foreground">{m.name}</span>
                  <span>{m.msg}</span>
                </div>
              ))}
              <button className="text-xs text-muted-foreground underline" onClick={()=>setUploadMsgs([])}>Limpiar</button>
            </div>
          )}

          {/* Docentes table */}
          {disps.length>0&&(
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-primary"/>Docentes cargados
                    <Badge className="bg-primary/10 text-primary border-0 font-semibold">{disps.length}</Badge>
                  </CardTitle>
                  <div className="relative w-60">
                    <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground"/>
                    <Input className="pl-8 h-8 text-sm" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Docente</th>
                    <th className="px-3 py-2.5 text-left font-medium w-28">Local</th>
                    <th className="px-3 py-2.5 text-center font-medium w-20">Slots</th>
                    <th className="px-3 py-2.5 text-center font-medium w-24">Asignados</th>
                    <th className="px-3 py-2.5 text-left font-medium">Grado</th>
                    <th className="px-3 py-2.5 text-center font-medium w-20">Ver</th>
                  </tr></thead>
                  <tbody>
                    {disps.filter(d=>!search||d.docente.toLowerCase().includes(search.toLowerCase())).map(d=>{
                      const asignados=asignaciones.filter(a=>a.docenteId===d.id).length;
                      return(
                        <React.Fragment key={d.id}>
                          <tr className="border-b hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-xs">{d.docente}</td>
                            <td className="px-3 py-2.5 text-xs">{d.local||"—"}</td>
                            <td className="px-3 py-2.5 text-center"><Badge className="bg-green-100 text-green-700 border-0 text-[11px]">{d.slots.length}</Badge></td>
                            <td className="px-3 py-2.5 text-center">
                              {asignados>0?<Badge className="bg-primary/10 text-primary border-0 text-[11px]">{asignados}</Badge>:<span className="text-muted-foreground text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.grado||d.titulo||"—"}</td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={()=>setPreview(preview===d.id?null:d.id)} className={`p-1.5 rounded transition-colors ${preview===d.id?"bg-primary/10 text-primary":"hover:bg-muted text-muted-foreground"}`}><Eye className="w-3.5 h-3.5"/></button>
                                <button onClick={()=>setDisps(prev=>prev.filter(x=>x.id!==d.id))} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                              </div>
                            </td>
                          </tr>
                          {preview===d.id&&(
                            <tr><td colSpan={6} className="px-4 py-4 bg-muted/5 border-b">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-bold text-primary">{d.docente}</span>
                                {d.local&&<Badge className="bg-primary/10 text-primary border-0 text-[10px]">{d.local}</Badge>}
                                <span className="text-xs text-muted-foreground">— {d.slots.length} slots</span>
                              </div>
                              <DispGrid disp={d}/>
                            </td></tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══ TAB 2: CATÁLOGO ═════════════════════════════════════════════ */}
      {tab==="catalogo"&&(
        <div className="grid grid-cols-[360px_1fr] gap-5">
          <Card className="border-border/60 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {ctEdit?<><Edit2 className="w-4 h-4 text-primary"/>Editar Curso</>:<><Plus className="w-4 h-4 text-primary"/>Nuevo Curso</>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Carrera *</label>
                  <Input placeholder="IC" value={ctForm.carrera} onChange={e=>setCtForm(f=>({...f,carrera:e.target.value.toUpperCase()}))} className="uppercase"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Ciclo *</label>
                  <Input placeholder="1" value={ctForm.ciclo} onChange={e=>setCtForm(f=>({...f,ciclo:e.target.value}))}/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Sección *</label>
                  <Input placeholder="A" value={ctForm.seccion} onChange={e=>setCtForm(f=>({...f,seccion:e.target.value.toUpperCase()}))} className="uppercase"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nombre del Curso *</label>
                <Input placeholder="Ej: Matemática I" value={ctForm.curso} onChange={e=>setCtForm(f=>({...f,curso:e.target.value}))}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Tipo</label>
                <Sel value={ctForm.tipo} onChange={v=>setCtForm(f=>({...f,tipo:v}))}
                  options={[{value:"T",label:"Teoría (T)"},{value:"P",label:"Práctica (P)"},{value:"TP",label:"Teoría-Práctica (TP)"}]}/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Horas por sesión</label>
                  <Sel value={String(ctForm.horasSesion)} onChange={v=>setCtForm(f=>({...f,horasSesion:Number(v)}))}
                    options={[1,2,3,4,5,6].map(n=>({value:String(n),label:`${n} hora${n>1?"s":""}`}))}/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Sesiones/semana</label>
                  <Sel value={String(ctForm.sesionesSemanales)} onChange={v=>setCtForm(f=>({...f,sesionesSemanales:Number(v)}))}
                    options={[1,2,3].map(n=>({value:String(n),label:`${n} sesión${n>1?"es":""}`}))}/>
                </div>
              </div>
              {ctErr&&<div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>{ctErr}</div>}
              <div className="flex gap-2 pt-1">
                <Button onClick={saveCt} className="flex-1 gap-2"><Check className="w-4 h-4"/>{ctEdit?"Guardar cambios":"Agregar curso"}</Button>
                {ctEdit&&<Button variant="outline" onClick={()=>{setCtEdit(null);setCtForm(emptyCt);setCtErr("");}}><X className="w-4 h-4"/></Button>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary"/>Catálogo de Cursos
                <Badge className="bg-primary/10 text-primary border-0 font-semibold">{catalogo.length}</Badge>
                {catalogo.filter(c=>!assignedTemplateIds.has(c.id)).length>0&&(
                  <Badge className="bg-amber-100 text-amber-700 border-0 font-semibold">{catalogo.filter(c=>!assignedTemplateIds.has(c.id)).length} sin asignar</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {catalogo.length===0?(
                <div className="py-12 text-center text-muted-foreground text-sm">No hay cursos en el catálogo. Agrega cursos para habilitar la auto-asignación.</div>
              ):(
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Curso</th>
                    <th className="px-3 py-2.5 text-left font-medium w-28">Car/Cic/Sec</th>
                    <th className="px-3 py-2.5 text-center font-medium w-16">Tipo</th>
                    <th className="px-3 py-2.5 text-center font-medium w-24">Horas</th>
                    <th className="px-3 py-2.5 text-center font-medium w-24">Estado</th>
                    <th className="px-3 py-2.5 text-center font-medium w-20">Acc.</th>
                  </tr></thead>
                  <tbody>
                    {catalogo.map(ct=>{
                      const assigned=assignedTemplateIds.has(ct.id);
                      const asgn=asignaciones.find(a=>a.cursoTemplateId===ct.id);
                      return(
                        <tr key={ct.id} className={`border-b last:border-0 hover:bg-muted/10 transition-colors ${assigned?"":"bg-amber-50/30"}`}>
                          <td className="px-4 py-2.5 font-semibold text-xs">{ct.curso}</td>
                          <td className="px-3 py-2.5 text-xs font-mono"><span className="font-bold text-primary">{ct.carrera}</span> {ct.ciclo}{ct.seccion}</td>
                          <td className="px-3 py-2.5 text-center"><Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">{ct.tipo}</Badge></td>
                          <td className="px-3 py-2.5 text-center text-xs">{ct.horasSesion}h × {ct.sesionesSemanales} ses.</td>
                          <td className="px-3 py-2.5 text-center">
                            {assigned
                              ?<div className="text-[10px] text-green-700 font-semibold">✓ {asgn?.docente?.split(" ")[0]}</div>
                              :<Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Pendiente</Badge>}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={()=>{setCtEdit(ct.id);const{id:_,...rest}=ct;setCtForm(rest);setCtErr("");}} className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                              <button onClick={()=>setCatalogo(prev=>prev.filter(x=>x.id!==ct.id))} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
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

      {/* ══ TAB 3: ASIGNACIONES ══════════════════════════════════════════ */}
      {tab==="asignaciones"&&(
        <div className="grid grid-cols-[380px_1fr] gap-5">
          <Card className="border-border/60 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {asgnEdit?<><Edit2 className="w-4 h-4 text-primary"/>Editar</>:<><Plus className="w-4 h-4 text-primary"/>Nueva Asignación</>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {disps.length===0?(
                <div className="text-xs text-muted-foreground p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600"/>Primero sube los Excel de disponibilidad.
                </div>
              ):(
                <>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Docente *</label>
                    <Sel value={asgnForm.docenteId} onChange={v=>updAsgn({docenteId:v})} options={docenteOptions} placeholder="Seleccionar docente..."/>
                  </div>
                  {catalogoOptions.length>0&&(
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Curso del catálogo (opcional)</label>
                      <Sel value={asgnForm.cursoTemplateId||""} onChange={v=>updAsgn({cursoTemplateId:v})} options={[{value:"",label:"— Ingresar manualmente —"},...catalogoOptions]} placeholder="Seleccionar del catálogo..."/>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Carrera *</label>
                      <Input placeholder="IC" value={asgnForm.carrera} onChange={e=>updAsgn({carrera:e.target.value.toUpperCase()})} className="uppercase"/></div>
                    <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Ciclo *</label>
                      <Input placeholder="1" value={asgnForm.ciclo} onChange={e=>updAsgn({ciclo:e.target.value})}/></div>
                    <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Secc. *</label>
                      <Input placeholder="A" value={asgnForm.seccion} onChange={e=>updAsgn({seccion:e.target.value.toUpperCase()})} className="uppercase"/></div>
                  </div>
                  <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Curso *</label>
                    <Input placeholder="Ej: Cálculo I" value={asgnForm.curso} onChange={e=>updAsgn({curso:e.target.value})}/></div>
                  <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Tipo</label>
                    <Sel value={asgnForm.tipo} onChange={v=>updAsgn({tipo:v})} options={[{value:"T",label:"Teoría"},{value:"P",label:"Práctica"},{value:"TP",label:"Teoría-Práctica"}]}/></div>
                  <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Día *</label>
                    <Sel value={asgnForm.dia} onChange={v=>updAsgn({dia:v,horaInicio:"",horaFin:""})} options={DIAS.map(d=>({value:d,label:DIAS_LABEL[d]}))} placeholder="Seleccionar día..."/></div>
                  {asgnForm.dia&&(
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Hora Inicio *</label>
                        <Sel value={asgnForm.horaInicio} onChange={v=>updAsgn({horaInicio:v,horaFin:SLOT_ENDS[v]||""})}
                          options={SLOTS.map(s=>({value:s,label:selectedDisp?(slotAvail(asgnForm.dia,s)?`✓ ${s}`:s):s}))} placeholder="Inicio"/></div>
                      <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Hora Fin *</label>
                        <Sel value={asgnForm.horaFin} onChange={v=>updAsgn({horaFin:v})}
                          options={SLOTS.filter(s=>!asgnForm.horaInicio||timeToMin(s)>timeToMin(asgnForm.horaInicio)).map(s=>({value:s,label:s}))} placeholder="Fin"/></div>
                    </div>
                  )}
                  {asgnErr&&<div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-semibold"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>{asgnErr}</div>}
                  {!asgnErr&&asgnWarn&&<div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>{asgnWarn}</div>}
                  <div className="flex gap-2 pt-1">
                    <Button onClick={saveAsgn} disabled={!!asgnErr} className="flex-1 gap-2"><Check className="w-4 h-4"/>{asgnEdit?"Guardar":"Agregar"}</Button>
                    {asgnEdit&&<Button variant="outline" onClick={()=>{setAsgnEdit(null);setAsgnForm(emptyAsgn);setAsgnErr("");setAsgnWarn("");}}><X className="w-4 h-4"/></Button>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary"/>Asignaciones
                <Badge className="bg-primary/10 text-primary border-0 font-semibold">{asignaciones.length}</Badge>
                {crucesTotal>0&&<Badge className="bg-red-100 text-red-700 border-0 font-semibold"><AlertTriangle className="w-3 h-3 mr-1"/>{crucesTotal} cruces</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {asignaciones.length===0
                ?<div className="py-12 text-center text-muted-foreground text-sm">Sin asignaciones. Usa el botón <strong>Auto-asignar todo</strong> o agrega manualmente.</div>
                :<table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Docente</th>
                    <th className="px-3 py-2.5 text-left font-medium">Curso</th>
                    <th className="px-3 py-2.5 text-left font-medium w-24">Car/Cic/Sec</th>
                    <th className="px-3 py-2.5 text-left font-medium w-24">Día</th>
                    <th className="px-3 py-2.5 text-left font-medium w-28">Horario</th>
                    <th className="px-3 py-2.5 text-center font-medium w-20">Estado</th>
                    <th className="px-3 py-2.5 text-center font-medium w-16">Acc.</th>
                  </tr></thead>
                  <tbody>
                    {[...asignaciones].sort((a,b)=>a.docente.localeCompare(b.docente)||DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)).map(a=>{
                      const cruce=asignaciones.some(b=>b.id!==a.id&&b.docenteId===a.docenteId&&b.dia===a.dia&&overlaps(b.horaInicio,b.horaFin,a.horaInicio,a.horaFin));
                      return(
                        <tr key={a.id} className={`border-b last:border-0 hover:bg-muted/10 transition-colors ${cruce?"bg-red-50":""}`}>
                          <td className="px-4 py-2.5 text-xs font-medium">
                            {a.docente}
                            {a.autoAsignado&&<span className="ml-1.5 text-[10px] bg-emerald-100 text-emerald-700 px-1 rounded font-semibold">auto</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs">{a.curso}</td>
                          <td className="px-3 py-2.5 text-xs font-mono"><span className="font-bold text-primary">{a.carrera}</span> {a.ciclo}{a.seccion}</td>
                          <td className="px-3 py-2.5 text-xs">{DIAS_LABEL[a.dia]}</td>
                          <td className="px-3 py-2.5 font-mono text-xs">{a.horaInicio}–{a.horaFin}</td>
                          <td className="px-3 py-2.5 text-center">
                            {cruce?<Badge className="bg-red-100 text-red-700 border-0 text-[10px]">CRUCE</Badge>:<Badge className="bg-green-100 text-green-700 border-0 text-[10px]">OK</Badge>}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={()=>{setAsgnEdit(a.id);const{id:_,...rest}=a;setAsgnForm({...emptyAsgn,...rest});setAsgnErr("");setAsgnWarn("");setTab("asignaciones");}} className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                              <button onClick={()=>setAsignaciones(prev=>prev.filter(x=>x.id!==a.id))} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              }
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══ TAB 4: HORARIO ══════════════════════════════════════════════ */}
      {tab==="horario"&&(
        <div className="space-y-4">
          {asignaciones.length===0
            ?<div className="py-16 text-center text-muted-foreground text-sm">Agrega asignaciones para ver el horario.</div>
            :(
              <>
                {crucesTotal>0&&<div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertTriangle className="w-4 h-4 shrink-0"/><span><strong>{crucesTotal} cruce{crucesTotal>1?"s":""}</strong> detectado{crucesTotal>1?"s":""}. Corrígelos en la pestaña Asignaciones.</span></div>}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block"/>Manual</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block"/>Auto-asignado</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block"/>Con cruce</span>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full border-collapse text-[11px] min-w-[600px]">
                    <thead><tr className="bg-primary text-white">
                      <th className="border border-primary/40 px-3 py-2 text-center font-semibold w-20">Hora</th>
                      {activeDias.map(d=><th key={d} className="border border-primary/40 px-3 py-2 text-center font-semibold">{DIAS_LABEL[d]}</th>)}
                    </tr></thead>
                    <tbody>
                      {activeSlots.map(slot=>(
                        <tr key={slot}>
                          <td className="border border-gray-200 bg-[#D9E0F1] px-2 py-1.5 text-center font-mono text-[9px] whitespace-nowrap font-bold">{slot}<br/>{SLOT_ENDS[slot]}</td>
                          {activeDias.map(dia=>{
                            const cells=gridCells.get(`${dia}|${slot}`)??[];
                            if(cells.length>0) return(
                              <td key={dia} className="border border-gray-200 p-0.5 align-top">
                                <div className="flex flex-col gap-0.5">
                                  {cells.map((cell,ci)=>(
                                    <div key={ci} className={`rounded p-1 text-center ${cell.cruce?"bg-red-100 border border-red-300":cell.a.autoAsignado?"bg-emerald-50 border border-emerald-200":"bg-blue-50 border border-blue-200"}`}>
                                      <div className="font-bold text-[9px] text-gray-800 truncate">{cell.a.curso}</div>
                                      <div className="text-[8px] text-gray-600 truncate">{cell.a.docente.split(" ").slice(0,2).join(" ")}</div>
                                      <div className="text-[8px] font-mono text-gray-500">{cell.a.carrera} {cell.a.ciclo}{cell.a.seccion}</div>
                                      {cell.cruce&&<div className="text-[8px] text-red-600 font-bold">⚠ CRUCE</div>}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            );
                            const spanned=asignaciones.some(a=>{
                              if(a.dia!==dia) return false;
                              const si=SLOTS.indexOf(a.horaInicio),ei=SLOTS.indexOf(a.horaFin),ci=SLOTS.indexOf(slot);
                              return si>=0&&ci>si&&ci<ei;
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
            )
          }
        </div>
      )}
    </div>
  );
}
