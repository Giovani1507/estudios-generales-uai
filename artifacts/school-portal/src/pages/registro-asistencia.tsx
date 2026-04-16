import { useState } from "react";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const emptyForm = {
  apellidos: "",
  nombres: "",
  docente: "",
  curso: "",
  carrera: "",
  ciclo: "",
  seccion: "",
  dia: "",
  fecha: new Date().toISOString().slice(0, 10),
};

export default function RegistroAsistencia() {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
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
          <p className="text-sm text-gray-500 mb-5">
            Tu asistencia fue registrada correctamente.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-1.5">
            <p><span className="font-medium text-gray-600">Estudiante:</span> {form.apellidos}, {form.nombres}</p>
            <p><span className="font-medium text-gray-600">Docente:</span> {form.docente}</p>
            <p><span className="font-medium text-gray-600">Curso:</span> {form.curso}</p>
            <p><span className="font-medium text-gray-600">Carrera:</span> {form.carrera}</p>
            <p><span className="font-medium text-gray-600">Ciclo / Sec.:</span> {form.ciclo} — {form.seccion}</p>
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

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            Completa todos los campos para registrar tu asistencia de hoy.
          </p>

          {/* Datos del estudiante */}
          <div>
            <p className="text-xs font-bold text-[#001F5F] uppercase tracking-wider mb-2">Datos del Estudiante</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Apellidos <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.apellidos}
                  onChange={(e) => handleChange("apellidos", e.target.value)}
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
                  onChange={(e) => handleChange("nombres", e.target.value)}
                  placeholder="Ej: JUAN CARLOS"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] uppercase"
                  required
                />
              </div>
            </div>
          </div>

          {/* Datos de la clase */}
          <div>
            <p className="text-xs font-bold text-[#001F5F] uppercase tracking-wider mb-2">Datos de la Clase</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Docente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.docente}
                  onChange={(e) => handleChange("docente", e.target.value)}
                  placeholder="Apellidos y nombres del docente"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Curso <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.curso}
                  onChange={(e) => handleChange("curso", e.target.value)}
                  placeholder="Nombre del curso"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Carrera <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.carrera}
                  onChange={(e) => handleChange("carrera", e.target.value)}
                  placeholder="Ej: INGENIERÍA CIVIL"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] uppercase"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Ciclo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.ciclo}
                    onChange={(e) => handleChange("ciclo", e.target.value)}
                    placeholder="Ej: III"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Sección <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.seccion}
                    onChange={(e) => handleChange("seccion", e.target.value)}
                    placeholder="Ej: A"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] uppercase"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Día <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.dia}
                    onChange={(e) => handleChange("dia", e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F]"
                  >
                    <option value="">Seleccionar</option>
                    {DIAS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Fecha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => handleChange("fecha", e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F]"
                  />
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
