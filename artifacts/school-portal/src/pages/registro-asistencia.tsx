import { useState, useEffect, useRef } from "react";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

const SECCIONES = ["A","B","C","D","E","F","G","H","I","J","K","L","M"];
const DIAS_SEMANA = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

// Get today in Peru time (UTC-5, no DST)
function getPeruToday() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const peru = new Date(utc + (-5 * 60 * 60000));
  const y = peru.getFullYear();
  const m = String(peru.getMonth() + 1).padStart(2, "0");
  const d = String(peru.getDate()).padStart(2, "0");
  const dayName = DIAS_SEMANA[peru.getDay()];
  return { fecha: `${y}-${m}-${d}`, dia: dayName };
}

const { fecha: TODAY, dia: TODAY_DIA } = getPeruToday();

const CURSOS_MAP: Record<string, Record<string, string[]>> = {
  "ADMINISTRACION DE EMPRESAS": {
    "1": ["Cultura Ambiental","Filosofía y Ética","Introduccion a la Administración","Matemática","Métodos de Estudio Universitario","Redacción y Comunicación"],
    "2": ["Cultura inclusiva","Economía","Matemática Financiera","Metodología de la Investigación","Realidad Nacional y Globalizacion","Redacción académica"],
  },
  "ARQUITECTURA": {
    "1": ["Filosofía y ética","Geometría descriptiva","Introducción a la arquitectura","Matemáticas aplicadas","Métodos de estudio universitario","Redacción y comunicación"],
    "2": ["Administración y Emprendimiento","Cálculo","Dibujo Arquitectónico I","Física I","Metodología de la Investigación","Realidad Nacional y Globalización"],
  },
  "CONTABILIDAD": {
    "1": ["Contabilidad General","Cultura Ambiental","Filosofia y Etica","Matematica","Metodos de Estudio Universitario","Redaccion y Comunicacion"],
    "2": ["Contabilidad Financiera","Cultura Inclusiva","Economía","Matemática II","Metodología de la Investigación","Realidad nacional y Globalizacion"],
  },
  "DERECHO": {
    "1": ["Cultura ambiental","Filosofía y Ética","Introducción al Derecho","Matemática I","Métodos de estudio universitario","Redacción y Comunicación"],
    "2": ["Administración y Emprendimiento","Cultura inclusiva","Expresión oral y liderazgo","Matemática II","Metodología de la Investigación","Realidad nacional y Globalización"],
  },
  "ENFERMERÍA": {
    "1": ["Biologia","Filosofía y Ética","Introducción a la enfermería","Matemática I","Métodos de estudio universitario","Redacción y Comunicación"],
    "2": ["Administración y emprendimiento","Anatomia y fisiologia","Cultura inclusiva","Matemática II","Metodología de la investigación","Realidad nacional y Globalizacion"],
  },
  "FARMACIA Y BIOQUÍMICA": {
    "1": ["Biología General","Filosofía y Ética","Introducción a la Tecnología Médica","Matemática","Métodos de estudio universitario","Redacción y Comunicación"],
    "2": ["Administración y emprendimiento","Anatomía","Cultura Ambiental","Cultura inclusiva","Metodología de la investigación","Realidad nacional y Globalización"],
  },
  "INGENIERIA CIVIL": {
    "1": ["Dibujo de ingeniería I","Filosofía y ética","Introducción a las ingenierías","Matemáticas para Ingenieros","Métodos de estudio universitario","Redacción y comunicación"],
    "2": ["Administración y Emprendimiento","Cálculo I","Dibujo de ingeniería II","Física","Metodología de la Investigación","Realidad Nacional y Globalización"],
  },
  "INGENIERIA DE SISTEMAS": {
    "1": ["Dibujo de Ingeniería","Filosofía y Ética","Introducción a las Ingenierías","Matemáticas para Ingenieros","Métodos de Estudio Universitario","Redacción y Comunicación"],
    "2": ["Administración y Emprendimiento","Cultura Inclusiva","Cálculo I","Física I","Métodologia de la Investigación","Realidad Nacional y Globalización"],
  },
  "INGENIERIA INDUSTRIAL": {
    "1": ["Cultura Ambiental","Filosofía y Ética","Introducción a las Ingenierías","Matemáticas","Métodos de estudio universitario","Redacción y Comunicación"],
    "2": ["Administración General","Cultura inclusiva","Cálculo I","Dibujo de Ingeniería","Metodología de la Investigación","Realidad Nacional y Globalización"],
  },
  "MEDICINA HUMANA": {
    "1": ["Biología","Filosofía y Ética","Introducción a la medicina","Matemática I","Métodos de estudio universitario","Redacción y Comunicación"],
    "2": ["Administración y emprendimiento","Anatomía","Cultura Ambiental","Matemática II","Metodología de la Investigación","Realidad nacional y Globalización"],
  },
  "OBSTETRICIA": {
    "1": ["Cultura ambiental","Filosofía y Ética","Introducción a la obstetricia","Matemática I","Métodos de estudio universitario","Redacción y Comunicación"],
    "2": ["Administración general","Anatomía y fisiología","Cultura inclusiva","Matemática II","Metodología de la Investigación","Realidad nacional y Globalización"],
  },
  "OPTOMETRÍA": {
    "1": ["Biologia General","Filosofía y Ética","Introducción a la Tecnología Médica","Matemática","Métodos de estudio universitario","Redacción y Comunicación"],
    "2": ["Administración y emprendimiento","Anatomía Humana","Cultura Ambiental","Cultura inclusiva","Metodología de la investigación","Realidad nacional y Globalización"],
  },
  "PSICOLOGÍA": {
    "1": ["Biología","Filosofía y Ética","Introducción a la psicología","Matemática I","Métodos de estudio universitario","Redacción y Comunicación"],
    "2": ["Administración y emprendimiento","Anatomía y fisiología","Cultura inclusiva","Matemática II","Metodología de la Investigación","Realidad nacional y Globalización"],
  },
  "TERAPIA DEL LENGUAJE": {
    "1": ["Biología General","Filosofía y Ética","Introducción a la Tecnología Médica","Matemática","Métodos de estudio universitario","Redacción y Comunicación"],
  },
  "TERAPIA FÍSICA Y REHABILITACIÓN": {
    "1": ["Biologia General","Filosofía y Ética","Introducción a la Tecnología Médica","Matemática","Métodos de estudio universitario","Redacción y Comunicación"],
  },
};

const CARRERAS = Object.keys(CURSOS_MAP).sort();

const emptyForm = {
  apellidos: "",
  nombres: "",
  docente: "",
  carrera: "",
  ciclo: "",
  curso: "",
  seccion: "",
  dia: TODAY_DIA,
  fecha: TODAY,
};

export default function RegistroAsistencia() {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [docentes, setDocentes] = useState<string[]>([]);
  const [docenteSuggestions, setDocenteSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const docenteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    Promise.all([
      fetch(`${base}/planificacion-fica-2026-1.json`).then((r) => r.json()),
      fetch(`${base}/planificacion-fcs-2026-1.json`).then((r) => r.json()),
    ]).then(([fica, fcs]: [{ ciclo: string; docente: string }[][], { ciclo: string; docente: string }[][]]) => {
      const all = [...(fica as any[]), ...(fcs as any[])];
      const fromCiclos12 = all.filter((r) => r.ciclo === "1" || r.ciclo === "2");
      const names = [...new Set(fromCiclos12.map((r) => r.docente).filter(Boolean))].sort();
      setDocentes(names);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (docenteRef.current && !docenteRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleDocenteChange = (val: string) => {
    const upper = val.toUpperCase();
    setForm((f) => ({ ...f, docente: upper }));
    if (upper.trim().length >= 2) {
      const q = upper.trim();
      const matches = docentes.filter((d) => d.includes(q)).slice(0, 8);
      setDocenteSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectDocente = (name: string) => {
    setForm((f) => ({ ...f, docente: name }));
    setShowSuggestions(false);
  };
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const cursosDisponibles = (form.carrera && form.ciclo)
    ? (CURSOS_MAP[form.carrera]?.[form.ciclo] ?? [])
    : [];

  const handleCarreraChange = (val: string) => {
    setForm((f) => ({ ...f, carrera: val, ciclo: "", curso: "" }));
  };

  const handleCicloChange = (val: string) => {
    setForm((f) => ({ ...f, ciclo: val, curso: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const [k, v] of Object.entries(form)) {
      if (!v.trim()) {
        setError("Por favor completa todos los campos.");
        return;
      }
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/asistencia/registros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al registrar");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Error al enviar. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">¡Asistencia Registrada!</h2>
          <p className="text-sm text-gray-500 mb-5">Tu asistencia fue registrada correctamente.</p>
          <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-1.5">
            <p><span className="font-medium text-gray-600">Estudiante:</span> {form.apellidos}, {form.nombres}</p>
            <p><span className="font-medium text-gray-600">Docente:</span> {form.docente}</p>
            <p><span className="font-medium text-gray-600">Carrera:</span> {form.carrera}</p>
            <p><span className="font-medium text-gray-600">Ciclo / Sec.:</span> {form.ciclo} — {form.seccion}</p>
            <p><span className="font-medium text-gray-600">Curso:</span> {form.curso}</p>
            <p><span className="font-medium text-gray-600">Día:</span> {form.dia} · {form.fecha}</p>
          </div>
          <button
            onClick={() => { setForm(emptyForm); setSubmitted(false); }}
            className="mt-5 w-full py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 font-medium"
          >
            Registrar otra asistencia
          </button>
          <p className="text-xs text-gray-400 mt-3">Puedes cerrar esta ventana.</p>
        </div>
      </div>
    );
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/30 focus:border-[#001F5F] bg-white transition-shadow";
  const labelCls = "block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8"
      style={{ background: "linear-gradient(135deg, #001F5F 0%, #002a80 45%, #0a3a8f 100%)" }}>

      {/* Card principal */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="relative bg-[#001F5F] px-6 pt-7 pb-6 overflow-hidden">
          {/* fondo decorativo */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "14px 14px" }} />
          <div className="relative flex items-center gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <img
                src={`${import.meta.env.BASE_URL}escudo.png`}
                alt="Escudo UAI"
                className="w-12 h-12 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}logo.png`;
                }}
              />
            </div>
            <div>
              <p className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-widest mb-0.5">Universidad Autónoma de Ica</p>
              <h1 className="text-white font-extrabold text-lg leading-tight">Registro de Asistencia</h1>
              <p className="text-white/60 text-xs mt-0.5">Semestre Académico 2026-I</p>
            </div>
          </div>
          {/* Banda dorada inferior */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#C9A84C]" />
        </div>

        {/* ── Fecha/Día Banner ── */}
        <div className="flex bg-[#001F5F]/5 border-b border-gray-100">
          <div className="flex-1 flex items-center gap-2 px-5 py-3 border-r border-gray-100">
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Día</p>
              <p className="text-sm font-bold text-[#001F5F]">{TODAY_DIA}</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2 px-5 py-3">
            <span className="w-2 h-2 rounded-full bg-[#C9A84C] flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Fecha</p>
              <p className="text-sm font-bold text-[#001F5F]">{TODAY}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* ── Sección: Datos del Estudiante ── */}
          <div className="rounded-2xl border border-[#001F5F]/15 overflow-hidden">
            <div className="bg-[#001F5F] px-4 py-2.5 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-white text-xs font-bold uppercase tracking-wider">Datos del Estudiante</span>
            </div>
            <div className="p-4 space-y-3 bg-gray-50/50">
              <div>
                <label className={labelCls}>Apellidos <span className="text-red-500">*</span></label>
                <input type="text" value={form.apellidos}
                  onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value.toUpperCase() }))}
                  placeholder="EJ: GARCÍA RAMOS"
                  className={`${inputCls} uppercase`} required />
              </div>
              <div>
                <label className={labelCls}>Nombres <span className="text-red-500">*</span></label>
                <input type="text" value={form.nombres}
                  onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value.toUpperCase() }))}
                  placeholder="EJ: JUAN CARLOS"
                  className={`${inputCls} uppercase`} required />
              </div>
            </div>
          </div>

          {/* ── Sección: Datos de la Clase ── */}
          <div className="rounded-2xl border border-[#C9A84C]/40">
            <div className="bg-[#C9A84C] px-4 py-2.5 flex items-center gap-2 rounded-t-2xl">
              <svg className="w-4 h-4 text-[#001F5F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-[#001F5F] text-xs font-bold uppercase tracking-wider">Datos de la Clase</span>
            </div>
            <div className="p-4 space-y-3 bg-gray-50/50">

              {/* Carrera */}
              <div>
                <label className={labelCls}>Carrera <span className="text-red-500">*</span></label>
                <select value={form.carrera} onChange={(e) => handleCarreraChange(e.target.value)} required className={inputCls}>
                  <option value="">Seleccionar carrera</option>
                  {CARRERAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Ciclo + Sección */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Ciclo <span className="text-red-500">*</span></label>
                  <select value={form.ciclo} onChange={(e) => handleCicloChange(e.target.value)} required
                    disabled={!form.carrera} className={`${inputCls} disabled:bg-gray-100 disabled:text-gray-400`}>
                    <option value="">Ciclo</option>
                    {["1", "2"].filter((c) => CURSOS_MAP[form.carrera]?.[c]).map((c) => (
                      <option key={c} value={c}>Ciclo {c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Sección <span className="text-red-500">*</span></label>
                  <select value={form.seccion} onChange={(e) => setForm((f) => ({ ...f, seccion: e.target.value }))}
                    required className={inputCls}>
                    <option value="">Sección</option>
                    {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Curso */}
              <div>
                <label className={labelCls}>Curso <span className="text-red-500">*</span></label>
                <select value={form.curso} onChange={(e) => setForm((f) => ({ ...f, curso: e.target.value }))}
                  required disabled={cursosDisponibles.length === 0}
                  className={`${inputCls} disabled:bg-gray-100 disabled:text-gray-400`}>
                  <option value="">{cursosDisponibles.length === 0 ? "Selecciona carrera y ciclo primero" : "Seleccionar curso"}</option>
                  {cursosDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Docente — autocomplete */}
              <div ref={docenteRef} className="relative">
                <label className={labelCls}>Docente <span className="text-red-500">*</span></label>
                <input type="text" value={form.docente}
                  onChange={(e) => handleDocenteChange(e.target.value)}
                  onFocus={() => {
                    if (form.docente.trim().length >= 2) {
                      const matches = docentes.filter((d) => d.includes(form.docente.trim())).slice(0, 8);
                      setDocenteSuggestions(matches);
                      setShowSuggestions(matches.length > 0);
                    }
                  }}
                  placeholder="Escribe apellido del docente…"
                  autoComplete="off"
                  className={`${inputCls} uppercase`} required />
                {showSuggestions && (
                  <ul className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-xl mt-1.5 max-h-52 overflow-y-auto">
                    {docenteSuggestions.map((name) => {
                      const q = form.docente.trim();
                      const idx = name.indexOf(q);
                      return (
                        <li key={name} onMouseDown={() => selectDocente(name)}
                          className="px-4 py-2.5 cursor-pointer hover:bg-[#001F5F]/5 text-sm text-gray-800 border-b border-gray-50 last:border-0 flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] flex-shrink-0" />
                          <span>
                            {idx >= 0 ? (
                              <>
                                {name.slice(0, idx)}
                                <mark className="bg-[#C9A84C]/35 text-[#001F5F] font-bold rounded px-0.5 not-italic">{name.slice(idx, idx + q.length)}</mark>
                                {name.slice(idx + q.length)}
                              </>
                            ) : name}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" /></svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full font-bold rounded-2xl py-3.5 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg,#001F5F 0%,#002f8f 100%)", color: "#fff" }}>
            {submitting
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Registrando...</span>
              : "✓ Registrar mi Asistencia"}
          </button>

          <p className="text-center text-[11px] text-gray-400 pb-1">
            Todos los campos son obligatorios para completar el registro.
          </p>
        </form>
      </div>

      <p className="text-white/40 text-[10px] mt-5">© 2026 Universidad Autónoma de Ica — Sistema de Control Académico</p>
    </div>
  );
}
