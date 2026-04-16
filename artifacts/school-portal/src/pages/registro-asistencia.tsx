import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

interface Sesion {
  id: number;
  docente: string;
  curso: string;
  carrera: string;
  ciclo: string;
  seccion: string;
  dia: string;
  fecha: string;
}

export default function RegistroAsistencia() {
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const sesionId = params.get("id");

  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");

  const [apellidos, setApellidos] = useState("");
  const [nombres, setNombres] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sesionId) {
      setSessionError("Código QR inválido. No se encontró el ID de sesión.");
      setLoadingSession(false);
      return;
    }
    fetch(`${apiBase}/api/asistencia/sesiones/${sesionId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Sesión no encontrada");
        return r.json();
      })
      .then((data) => {
        setSesion(data);
        setLoadingSession(false);
      })
      .catch(() => {
        setSessionError("No se pudo cargar la sesión. Verifica que el QR sea válido.");
        setLoadingSession(false);
      });
  }, [sesionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apellidos.trim() || !nombres.trim()) {
      setError("Por favor completa apellidos y nombres.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/asistencia/sesiones/${sesionId}/registros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apellidos: apellidos.trim(), nombres: nombres.trim() }),
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

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#001F5F] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">QR Inválido</h2>
          <p className="text-sm text-gray-500">{sessionError}</p>
        </div>
      </div>
    );
  }

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
          <p className="text-sm text-gray-500 mb-4">
            {nombres} {apellidos}, tu asistencia fue registrada correctamente.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-1">
            <p><span className="font-medium text-gray-600">Curso:</span> {sesion?.curso}</p>
            <p><span className="font-medium text-gray-600">Docente:</span> {sesion?.docente}</p>
            <p><span className="font-medium text-gray-600">Día:</span> {sesion?.dia}</p>
            <p><span className="font-medium text-gray-600">Sección:</span> {sesion?.seccion}</p>
          </div>
          <p className="text-xs text-gray-400 mt-4">Puedes cerrar esta ventana.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
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

        {/* Session info */}
        <div className="bg-[#C9A84C]/10 border-b border-[#C9A84C]/30 px-6 py-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Docente</p>
              <p className="font-semibold text-gray-800 text-sm">{sesion?.docente}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Curso</p>
              <p className="font-semibold text-gray-800 text-sm">{sesion?.curso}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Carrera</p>
              <p className="font-semibold text-gray-800 text-sm">{sesion?.carrera}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Ciclo / Sección</p>
              <p className="font-semibold text-gray-800 text-sm">{sesion?.ciclo} — {sesion?.seccion}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Día / Fecha</p>
              <p className="font-semibold text-gray-800 text-sm">{sesion?.dia} · {sesion?.fecha}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Apellidos <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value.toUpperCase())}
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
              value={nombres}
              onChange={(e) => setNombres(e.target.value.toUpperCase())}
              placeholder="Ej: JUAN CARLOS"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001F5F]/40 focus:border-[#001F5F] uppercase"
              required
            />
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
          <p className="text-center text-xs text-gray-400">
            Solo necesitas registrarte una vez por clase.
          </p>
        </form>
      </div>
    </div>
  );
}
