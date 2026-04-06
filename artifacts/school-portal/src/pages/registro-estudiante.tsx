import { useState } from "react";
import { CheckCircle2, AlertCircle, Phone, User, BookOpen, GraduationCap } from "lucide-react";

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

type Status = "idle" | "loading" | "success" | "error";

export default function RegistroEstudiante() {
  const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
  const [form, setForm] = useState({
    apellidos: "",
    nombres: "",
    telefono: "",
    carrera: "",
    ciclo: "" as "" | "1" | "2",
    matriculado: "" as "" | "si" | "no",
  });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.apellidos || !form.nombres || !form.telefono || !form.carrera || !form.ciclo || !form.matriculado) {
      setErrorMsg("Por favor completa todos los campos obligatorios.");
      return;
    }
    if (!/^\d{9,15}$/.test(form.telefono.replace(/\s/g, ""))) {
      setErrorMsg("El número de teléfono debe tener entre 9 y 15 dígitos.");
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
          telefono:    form.telefono.replace(/\s/g, ""),
          carrera:     form.carrera,
          ciclo:       form.ciclo,
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
        style={{ background: "linear-gradient(160deg, #001F5F 0%, #0d3a8c 40%, #1a5fb4 70%, #2f80d6 100%)" }}
      >
        <div className="relative w-full max-w-sm">
          <div className="absolute inset-0 rounded-3xl" style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }} />
          <div className="relative bg-white rounded-3xl shadow-2xl px-8 py-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
              style={{ background: "linear-gradient(135deg, #16a34a22 0%, #16a34a33 100%)", border: "2px solid #16a34a44" }}>
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">¡Registro exitoso!</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Tus datos han sido registrados correctamente en el sistema.
            </p>
            <div className="mt-6 w-full bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100">
              <p className="text-xs font-semibold text-blue-700">Universidad Autónoma de Ica</p>
              <p className="text-xs text-blue-500 mt-0.5">Semestre Académico 2026-1</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "linear-gradient(160deg, #001F5F 0%, #0d3a8c 40%, #1a5fb4 70%, #2f80d6 100%)" }}
    >
      <div className="w-full max-w-md">

        {/* Logo & Title */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", border: "1.5px solid rgba(255,255,255,0.3)" }}>
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-2xl font-black tracking-tight text-center">
            Registro de Estudiante
          </h1>
          <p className="text-white/60 text-sm mt-1 text-center">Universidad Autónoma de Ica · 2026-1</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Accent bar */}
          <div className="h-1.5" style={{ background: "linear-gradient(90deg, #001F5F 0%, #2f80d6 50%, #001F5F 100%)" }} />

          <div className="px-7 py-8 flex flex-col gap-5">

            {/* Apellidos */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                <User className="w-3.5 h-3.5" />
                Apellidos <span className="text-red-500">*</span>
              </label>
              <input
                name="apellidos"
                value={form.apellidos}
                onChange={handleChange}
                placeholder="Ej: García López"
                className="w-full h-11 px-4 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm font-medium focus:outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-gray-300"
              />
            </div>

            {/* Nombres */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                <User className="w-3.5 h-3.5" />
                Nombres <span className="text-red-500">*</span>
              </label>
              <input
                name="nombres"
                value={form.nombres}
                onChange={handleChange}
                placeholder="Ej: Juan Carlos"
                className="w-full h-11 px-4 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm font-medium focus:outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-gray-300"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                <Phone className="w-3.5 h-3.5" />
                Número de Teléfono <span className="text-red-500">*</span>
              </label>
              <input
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="Ej: 987 654 321"
                inputMode="tel"
                className="w-full h-11 px-4 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm font-medium focus:outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-gray-300"
              />
            </div>

            {/* Carrera */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                <BookOpen className="w-3.5 h-3.5" />
                Carrera <span className="text-red-500">*</span>
              </label>
              <select
                name="carrera"
                value={form.carrera}
                onChange={handleChange}
                className="w-full h-11 px-4 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm font-medium focus:outline-none focus:border-blue-400 focus:bg-white transition-all text-gray-700"
              >
                <option value="">Seleccionar carrera…</option>
                {CARRERAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Ciclo — solo 1 o 2 */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">
                Ciclo <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(["1", "2"] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, ciclo: c }))}
                    className="h-12 rounded-xl text-sm font-bold border-2 transition-all"
                    style={{
                      borderColor: form.ciclo === c ? "#001F5F" : "#e5e7eb",
                      background: form.ciclo === c ? "#001F5F" : "#f9fafb",
                      color: form.ciclo === c ? "#ffffff" : "#9ca3af",
                    }}
                  >
                    Ciclo {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Matriculado */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">
                ¿Está matriculado? <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "si", label: "Sí, matriculado", color: "#16a34a" },
                  { value: "no", label: "No matriculado", color: "#dc2626" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, matriculado: opt.value as "si" | "no" }))}
                    className="h-12 rounded-xl text-xs font-bold border-2 transition-all"
                    style={{
                      borderColor: form.matriculado === opt.value ? opt.color : "#e5e7eb",
                      background: form.matriculado === opt.value ? opt.color + "15" : "#f9fafb",
                      color: form.matriculado === opt.value ? opt.color : "#9ca3af",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {(errorMsg || status === "error") && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg || "Ocurrió un error. Intenta de nuevo."}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={status === "loading"}
              className="w-full h-12 rounded-xl font-black text-white text-sm tracking-wide transition-all disabled:opacity-60 shadow-lg active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #001F5F 0%, #2f80d6 100%)" }}
            >
              {status === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando…
                </span>
              ) : "Registrar mis datos"}
            </button>

            <p className="text-center text-gray-300 text-[10px] leading-relaxed">
              Tus datos serán utilizados únicamente con fines académicos internos · UAI 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
