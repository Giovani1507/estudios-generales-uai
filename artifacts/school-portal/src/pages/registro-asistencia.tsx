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
    fetch(`${base}/docentes-registro-2026-1.json`)
      .then((r) => r.json())
      .then((data: { nombre: string }[]) => {
        const names = data.map((d) => d.nombre).filter(Boolean).sort();
        setDocentes(names);
      })
      .catch(() => {});
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 py-8">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#001F5F] px-6 py-5">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}logo-sidebar.png`}
              alt="UAI"
              className="h-10 object-contain filter brightness-0 invert"
            />
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Registro de Asistencia</h1>
              <p className="text-white/70 text-xs">Universidad Autónoma de Ica</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            Completa todos los campos para registrar tu asistencia de hoy.
          </p>

          {/* ── Datos del estudiante ── */}
          <div>
            <p className="text-xs font-bold text-[#001F5F] uppercase tracking-wider mb-3">Datos del Estudiante</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Apellidos <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.apellidos}
                  onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value.toUpperCase() }))}
                  placeholder="Ej: GARCÍA RAMOS"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Nombres <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nombres}
                  onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value.toUpperCase() }))}
                  placeholder="Ej: JUAN CARLOS"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] uppercase"
                  required
                />
              </div>
            </div>
          </div>

          {/* ── Datos de la clase ── */}
          <div>
            <p className="text-xs font-bold text-[#001F5F] uppercase tracking-wider mb-3">Datos de la Clase</p>
            <div className="space-y-3">

              {/* Carrera */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Carrera <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.carrera}
                  onChange={(e) => handleCarreraChange(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F]"
                >
                  <option value="">Seleccionar carrera</option>
                  {CARRERAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Ciclo + Sección */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Ciclo <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.ciclo}
                    onChange={(e) => handleCicloChange(e.target.value)}
                    required
                    disabled={!form.carrera}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">Ciclo</option>
                    {["1", "2"].filter((c) => CURSOS_MAP[form.carrera]?.[c]).map((c) => (
                      <option key={c} value={c}>Ciclo {c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Sección <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.seccion}
                    onChange={(e) => setForm((f) => ({ ...f, seccion: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F]"
                  >
                    <option value="">Sección</option>
                    {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Curso — dinámico */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Curso <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.curso}
                  onChange={(e) => setForm((f) => ({ ...f, curso: e.target.value }))}
                  required
                  disabled={cursosDisponibles.length === 0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {cursosDisponibles.length === 0
                      ? "Selecciona carrera y ciclo primero"
                      : "Seleccionar curso"}
                  </option>
                  {cursosDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Docente — autocomplete */}
              <div ref={docenteRef} className="relative">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Docente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.docente}
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] uppercase"
                  required
                />
                {showSuggestions && (
                  <ul className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto">
                    {docenteSuggestions.map((name) => {
                      const q = form.docente.trim();
                      const idx = name.indexOf(q);
                      return (
                        <li key={name}
                          onMouseDown={() => selectDocente(name)}
                          className="px-3 py-2.5 cursor-pointer hover:bg-[#001F5F]/5 text-sm text-gray-800 border-b border-gray-50 last:border-0 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] flex-shrink-0" />
                          {idx >= 0 ? (
                            <>
                              {name.slice(0, idx)}
                              <mark className="bg-[#C9A84C]/30 text-[#001F5F] font-semibold rounded px-0.5">{name.slice(idx, idx + q.length)}</mark>
                              {name.slice(idx + q.length)}
                            </>
                          ) : name}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Día + Fecha — automáticos, solo lectura */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Día</label>
                  <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-700 font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                    {TODAY_DIA}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Fecha</label>
                  <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-700 font-semibold">
                    {TODAY}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#001F5F] hover:bg-[#001F5F]/90 text-white font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Registrando..." : "Registrar mi Asistencia"}
          </button>
        </form>
      </div>
    </div>
  );
}
