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

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

type Sugerencia = {
  seccion: PlanRow;
  dia: string;
  hora: string;
  horaFin: string;
  nivel: "alta" | "media";
  motivo: string;
};

function generarSugerencia(cruce: Cruce, allData: PlanRow[]): Sugerencia | null {
  const carreras    = [...new Set(cruce.filas.map(r => r.carrera))];
  const locales     = [...new Set(cruce.filas.map(r => r.local))];
  const modalidades = [...new Set(cruce.filas.map(r => r.modalidad))];

  const nivel: "alta" | "media" = (locales.length > 1 || modalidades.length > 1) ? "alta" : "media";
  const motivo = locales.length > 1
    ? `Sedes distintas (${locales.join(" / ")}) — inviable en presencial`
    : modalidades.length > 1
      ? `Modalidades distintas (${modalidades.join(" / ")}) para programas ${carreras.join(" / ")}`
      : `Programas distintos (${carreras.join(" / ")}) en mismo horario`;

  // Sección a mover: preferir virtual, luego la segunda fila
  const seccion = cruce.filas.find(f => f.modalidad?.toUpperCase().includes("VIRTUAL"))
    ?? cruce.filas.find(f => f.modalidad?.toUpperCase().includes("HYBRID") || f.modalidad?.toUpperCase().includes("HÍBRIDO"))
    ?? cruce.filas[1]
    ?? cruce.filas[0];

  const durMin = timeToMin(seccion.horaFin) - timeToMin(seccion.hora);

  // Conjunto de franjas válidas del dataset (universo real de horas UAI)
  const dayOrder: Record<string, number> = {
    LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6, DOMINGO: 7,
  };
  const validSlots = [...new Set(allData.map(r => `${r.dia}|${r.hora}`))].sort((a, b) => {
    const [da, ha] = a.split("|");
    const [db, hb] = b.split("|");
    return ((dayOrder[da] || 9) - (dayOrder[db] || 9)) || (timeToMin(ha) - timeToMin(hb));
  });

  // Franjas ocupadas por el docente (todo el semestre)
  const busyDocente = new Set(
    allData
      .filter(r => r.docente?.trim() === cruce.docente)
      .map(r => `${r.dia}|${r.hora}`)
  );

  // Franjas ocupadas por la sección que se quiere mover (para no generar otro cruce a los alumnos)
  const busySeccion = new Set(
    allData
      .filter(r => r.seccion === seccion.seccion && r.carrera === seccion.carrera)
      .map(r => `${r.dia}|${r.hora}`)
  );

  // Primera franja libre para ambos (docente Y sección)
  const free = validSlots.find(s => !busyDocente.has(s) && !busySeccion.has(s));
  if (!free) return null;

  const [dia, hora] = free.split("|");
  const horaFin = minToTime(timeToMin(hora) + durMin);

  return { seccion, dia, hora, horaFin, nivel, motivo };
}

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

              {/* Propuesta de solución */}
              {(() => {
                const allData = cruce.facultad === "FICA" ? ficaData : fcsData;
                const sug = generarSugerencia(cruce, allData);
                if (!sug) return null;
                const styles = sug.nivel === "alta"
                  ? { bar: "bg-red-500", bg: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-700", icon: "text-red-500", label: "Prioridad Alta" }
                  : { bar: "bg-amber-500", bg: "bg-amber-50 border-amber-200", badge: "bg-amber-100 text-amber-700", icon: "text-amber-500", label: "Prioridad Media" };
                return (
                  <div className={`flex gap-0 border-t ${styles.bg}`}>
                    <div className={`w-1 shrink-0 ${styles.bar} rounded-bl-xl`} />
                    <div className="flex-1 px-4 py-3 space-y-2">
                      {/* Encabezado */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${styles.icon}`} />
                        <span className="text-xs font-semibold text-foreground">Propuesta de solución</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${styles.badge}`}>
                          {styles.label}
                        </span>
                      </div>
                      {/* Motivo */}
                      <p className="text-xs text-muted-foreground">{sug.motivo}</p>
                      {/* Propuesta concreta */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Mover sección</span>
                        <span className="font-mono text-xs bg-white border border-border px-1.5 py-0.5 rounded font-bold text-foreground">
                          {sug.seccion.seccion}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({sug.seccion.carrera} · {sug.seccion.modalidad}) al:
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-white border border-border rounded-lg px-2.5 py-1 text-xs font-semibold text-foreground">
                          <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                          {sug.dia} &nbsp;{sug.hora} – {sug.horaFin}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
