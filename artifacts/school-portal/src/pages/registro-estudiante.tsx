import { useState } from "react";
import { GraduationCap, CheckCircle2, AlertCircle } from "lucide-react";

const CARRERAS = [
  "Administración de Empresas",
  "Administración y Finanzas",
  "Arquitectura",
  "Contabilidad",
  "Derecho",
  "Enfermería",
  "Ingeniería Civil",
  "Ingeniería Industrial",
  "Ingeniería de Sistemas",
  "Medicina Humana",
  "Obstetricia",
  "Psicología",
  "Tecnología Médica I",
  "Tecnología Médica II",
  "Tecnología Médica III",
  "Tecnología Médica IV",
];

const CICLOS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

type Status = "idle" | "loading" | "success" | "error";

export default function RegistroEstudiante() {
  const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
  const [form, setForm] = useState({
    apellidos: "",
    nombres: "",
    dni: "",
    carrera: "",
    ciclo: "",
    matriculado: "" as "" | "si" | "no",
  });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.apellidos || !form.nombres || !form.dni || !form.carrera || !form.matriculado) {
      setErrorMsg("Por favor completa todos los campos obligatorios.");
      return;
    }
    if (!/^\d{8}$/.test(form.dni)) {
      setErrorMsg("El DNI debe tener exactamente 8 dígitos.");
      return;
    }
    setErrorMsg("");
    setStatus("loading");
    try {
      const res = await fetch(`${base}/api/students/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apellidos:   form.apellidos,
          nombres:     form.nombres,
          dni:         form.dni,
          carrera:     form.carrera,
          ciclo:       form.ciclo || null,
          matriculado: form.matriculado === "si",
        }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "linear-gradient(145deg, #c8d9f5 0%, #dde8fa 40%, #f0f5fd 70%, #ffffff 100%)" }}
      >
        <div className="bg-white rounded-2xl shadow-md px-10 py-12 flex flex-col items-center text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">¡Registro exitoso!</h2>
          <p className="text-gray-500 text-sm mb-1">
            Tus datos han sido registrados correctamente.
          </p>
          <p className="text-gray-400 text-xs mt-4">Universidad Autónoma de Ica · 2026-1</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "linear-gradient(145deg, #c8d9f5 0%, #dde8fa 40%, #f0f5fd 70%, #ffffff 100%)" }}
    >
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md overflow-hidden">
        {/* Header */}
        <div
          className="px-8 py-7 flex flex-col items-center text-center"
          style={{ background: "linear-gradient(135deg, #001F5F 0%, #2f5aa6 100%)" }}
        >
          <img
            src={`${base}logo.png`}
            alt="UAI"
            className="object-contain mb-3"
            style={{ height: 44, filter: "brightness(0) invert(1)", opacity: 0.9 }}
          />
          <h1 className="text-white font-bold text-lg leading-tight">Registro de Estudiante</h1>
          <p className="text-white/60 text-xs mt-1">Universidad Autónoma de Ica · 2026-1</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-7 flex flex-col gap-4">
          {/* Apellidos */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Apellidos <span className="text-red-500">*</span>
            </label>
            <input
              name="apellidos"
              value={form.apellidos}
              onChange={handleChange}
              placeholder="Ej: García López"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
          </div>

          {/* Nombres */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Nombres <span className="text-red-500">*</span>
            </label>
            <input
              name="nombres"
              value={form.nombres}
              onChange={handleChange}
              placeholder="Ej: Juan Carlos"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
          </div>

          {/* DNI */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
              DNI <span className="text-red-500">*</span>
            </label>
            <input
              name="dni"
              value={form.dni}
              onChange={handleChange}
              placeholder="8 dígitos"
              maxLength={8}
              inputMode="numeric"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
          </div>

          {/* Carrera */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Carrera <span className="text-red-500">*</span>
            </label>
            <select
              name="carrera"
              value={form.carrera}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            >
              <option value="">Seleccionar carrera…</option>
              {CARRERAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Ciclo */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Ciclo
            </label>
            <select
              name="ciclo"
              value={form.ciclo}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            >
              <option value="">Seleccionar ciclo…</option>
              {CICLOS.map(c => <option key={c} value={c}>Ciclo {c}</option>)}
            </select>
          </div>

          {/* Matriculado */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">
              ¿Está matriculado? <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {[
                { value: "si", label: "Sí, estoy matriculado", color: "#16a34a" },
                { value: "no", label: "No estoy matriculado", color: "#dc2626" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, matriculado: opt.value as "si" | "no" }))}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all"
                  style={{
                    borderColor: form.matriculado === opt.value ? opt.color : "#e5e7eb",
                    background: form.matriculado === opt.value ? opt.color + "18" : "#f9fafb",
                    color: form.matriculado === opt.value ? opt.color : "#6b7280",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {(errorMsg || status === "error") && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg || "Ocurrió un error. Intenta de nuevo."}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full h-11 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #001F5F 0%, #2f5aa6 100%)" }}
          >
            {status === "loading" ? "Enviando…" : "Registrar mis datos"}
          </button>

          <p className="text-center text-gray-400 text-[10px]">
            Tus datos serán utilizados únicamente con fines académicos internos.
          </p>
        </form>
      </div>
    </div>
  );
}
