import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, MapPin, Clock, User, GraduationCap } from "lucide-react";

type PlanRow = {
  docente: string;
  dia: string;
  hora: string;
  horaFin: string;
  seccion: string;
  carrera: string;
  carreraFull: string;
  local: string;
  modalidad: string;
  ciclo: string;
  curso: string;
  horasAcad: number;
};

type Cruce = {
  facultad: "FICA" | "FCS";
  docente: string;
  dia: string;
  hora: string;
  horaFin: string;
  filas: PlanRow[];
};

const DIA_ORDER: Record<string, number> = {
  LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6, DOMINGO: 7,
};

const LOCAL_COLOR: Record<string, string> = {
  PRINCIPAL: "bg-blue-100 text-blue-800",
  FILIAL:    "bg-orange-100 text-orange-800",
  SUNAMPE:   "bg-teal-100 text-teal-800",
  HUAURA:    "bg-purple-100 text-purple-800",
  PORUMA:    "bg-emerald-100 text-emerald-800",
};

const FACULTAD_COLOR: Record<string, string> = {
  FICA: "bg-blue-600",
  FCS:  "bg-rose-600",
};

const CARRERA_FULL: Record<string, string> = {
  AE: "Admin. Empresas", AF: "Admin. y Finanzas", AR: "Arquitectura",
  CA: "Contabilidad", DE: "Derecho", IC: "Ing. Civil",
  IN: "Ing. Industrial", IS: "Ing. Sistemas",
  EN: "Enfermería", MH: "Med. Humana", OB: "Obstetricia", PS: "Psicología",
  T1: "TM Laboratorio", T2: "TM Optometría", T3: "TM Terapia Lenguaje", T4: "TM Terapia Física",
};

function findCruces(data: PlanRow[], facultad: "FICA" | "FCS"): Cruce[] {
  const map = new Map<string, PlanRow[]>();
  data
    .filter(r => r.ciclo === "1" || r.ciclo === "2")
    .forEach(r => {
      if (!r.docente?.trim()) return;
      const key = `${r.docente.trim()}|${r.dia}|${r.hora}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });

  const cruces: Cruce[] = [];
  map.forEach((rows, key) => {
    const contables = rows.filter(r => Math.round(Number(r.horasAcad) || 0) > 0);
    const carreras  = [...new Set(contables.map(r => r.carrera))];
    const locales   = [...new Set(contables.map(r => r.local))];
    if (contables.length > 1 && (carreras.length > 1 || locales.length > 1)) {
      const [docente, dia, hora] = key.split("|");
      cruces.push({
        facultad,
        docente,
        dia,
        hora,
        horaFin: rows[0].horaFin,
        filas: contables,
      });
    }
  });

  return cruces.sort((a, b) => {
    const da = DIA_ORDER[a.dia] || 9, db = DIA_ORDER[b.dia] || 9;
    if (da !== db) return da - db;
    return a.hora.localeCompare(b.hora);
  });
}

export default function HorarioCruce() {
  const [ficaData, setFicaData] = useState<PlanRow[]>([]);
  const [fcsData,  setFcsData]  = useState<PlanRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}planificacion-fica-2026-1.json`).then(r => r.json()),
      fetch(`${base}planificacion-fcs-2026-1.json`).then(r => r.json()),
    ]).then(([fica, fcs]) => {
      setFicaData(fica);
      setFcsData(fcs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const cruces = useMemo(() => [
    ...findCruces(ficaData, "FICA"),
    ...findCruces(fcsData,  "FCS"),
  ], [ficaData, fcsData]);

  const ficaCruces = cruces.filter(c => c.facultad === "FICA");
  const fcsCruces  = cruces.filter(c => c.facultad === "FCS");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm gap-2">
        <span className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
        Cargando planificación...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-100">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Cruce de Planificación</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Planificación 2026-1 · Ciclos 1 y 2 · Docentes con asignaciones simultáneas en distintas carreras o sedes
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-border rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Total Cruces</p>
          <p className="text-3xl font-bold text-amber-600">{cruces.length}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs text-blue-600 font-medium mb-1">FICA</p>
          <p className="text-3xl font-bold text-blue-700">{ficaCruces.length}</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs text-rose-600 font-medium mb-1">FCS</p>
          <p className="text-3xl font-bold text-rose-700">{fcsCruces.length}</p>
        </div>
      </div>

      {/* Lista de cruces */}
      {cruces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <BookOpen className="w-12 h-12 opacity-20" />
          <p className="text-sm">No se encontraron cruces en la planificación</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cruces.map((cruce, i) => (
            <div key={i} className="bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${FACULTAD_COLOR[cruce.facultad]}`}>
                      {cruce.facultad}
                    </span>
                    <span className="font-semibold text-sm text-foreground truncate">
                      {cruce.docente}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 bg-white border border-border rounded-lg px-2.5 py-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-medium">{cruce.dia}</span>
                  <span>{cruce.hora} – {cruce.horaFin}</span>
                </div>
              </div>

              {/* Filas en conflicto */}
              <div className="divide-y divide-border">
                {cruce.filas.map((f, j) => (
                  <div key={j} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">{j + 1}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-semibold">
                        {f.seccion}
                      </span>
                      <div className="flex items-center gap-1 text-xs">
                        <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{f.carrera}</span>
                        <span className="text-muted-foreground">— {CARRERA_FULL[f.carrera] ?? f.carreraFull ?? f.carrera}</span>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${LOCAL_COLOR[f.local] ?? "bg-gray-100 text-gray-700"}`}>
                        {f.local}
                      </span>
                      <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        {f.modalidad}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      Ciclo {f.ciclo}
                    </div>
                  </div>
                ))}
              </div>

              {/* Nota del curso */}
              <div className="px-4 py-2 bg-gray-50 border-t border-border text-xs text-muted-foreground flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Curso: <strong className="text-foreground">{cruce.filas[0].curso}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
