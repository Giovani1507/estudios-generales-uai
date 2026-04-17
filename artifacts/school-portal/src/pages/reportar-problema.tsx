import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

const CARRERAS = [
  "ADMINISTRACIÓN DE EMPRESAS",
  "ARQUITECTURA",
  "CONTABILIDAD",
  "DERECHO",
  "ENFERMERÍA",
  "FARMACIA Y BIOQUÍMICA",
  "INGENIERIA CIVIL",
  "INGENIERIA DE SISTEMAS",
  "MEDICINA HUMANA",
  "PSICOLOGÍA",
  "ESTOMATOLOGÍA",
  "TECNOLOGIA MEDICA",
  "OBSTETRICIA",
];

const PROBLEMAS = [
  { value: "plataforma", label: "Problemas de plataforma" },
  { value: "cursos_no_aparecen", label: "No aparecen mis cursos" },
  { value: "no_aparece_lista_docente", label: "No aparezco en la lista del docente" },
  { value: "aula_virtual", label: "Aula virtual" },
  { value: "otros", label: "Otros" },
] as const;

export default function ReportarProblema() {
  const [apellidosNombres, setApellidosNombres] = useState("");
  const [carrera, setCarrera] = useState("");
  const [ciclo, setCiclo] = useState<"1" | "2" | "">("");
  const [seccion, setSeccion] = useState("");
  const [problema, setProblema] = useState<string>("");
  const [descripcion, setDescripcion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setApellidosNombres("");
    setCarrera("");
    setCiclo("");
    setSeccion("");
    setProblema("");
    setDescripcion("");
    setSuccess(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!apellidosNombres.trim() || !carrera || !ciclo || !seccion.trim() || !problema) {
      setError("Completa todos los campos.");
      return;
    }
    if (problema === "otros" && !descripcion.trim()) {
      setError("Describe brevemente tu problema.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/api/student-problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apellidosNombres: apellidosNombres.trim(),
          carrera,
          ciclo,
          seccion: seccion.trim().toUpperCase(),
          problema,
          descripcion: descripcion.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al enviar el reporte");
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Error al enviar el reporte");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">¡Reporte enviado!</h2>
          <p className="text-sm text-slate-600 mb-6">
            Tu reporte ha sido recibido. El equipo académico lo revisará pronto.
          </p>
          <button
            onClick={reset}
            className="w-full h-11 rounded-lg font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)" }}
          >
            Enviar otro reporte
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 px-6 pt-6 pb-7">
          <div className="flex justify-center mb-3">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Universidad Autónoma de Ica"
              className="object-contain"
              style={{ maxWidth: "200px", maxHeight: "60px" }}
            />
          </div>
          <div className="text-center mb-5">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "#0a1f5c" }}>
              Reporte de Problemas
            </h1>
            <p className="text-xs mt-1 text-slate-500">
              Cuéntanos qué problema estás teniendo con el portal o tus cursos.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Apellidos y Nombres">
              <input
                type="text"
                value={apellidosNombres}
                onChange={(e) => setApellidosNombres(e.target.value)}
                placeholder="Ej. Pérez Gómez Juan"
                className={inputCls}
                required
              />
            </Field>

            <Field label="Carrera">
              <select
                value={carrera}
                onChange={(e) => setCarrera(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Selecciona tu carrera</option>
                {CARRERAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Ciclo">
                <select
                  value={ciclo}
                  onChange={(e) => setCiclo(e.target.value as "1" | "2" | "")}
                  className={inputCls}
                  required
                >
                  <option value="">—</option>
                  <option value="1">Ciclo 1</option>
                  <option value="2">Ciclo 2</option>
                </select>
              </Field>
              <Field label="Sección">
                <input
                  type="text"
                  maxLength={3}
                  value={seccion}
                  onChange={(e) => setSeccion(e.target.value.toUpperCase())}
                  placeholder="A"
                  className={inputCls + " uppercase"}
                  required
                />
              </Field>
            </div>

            <Field label="Tipo de problema">
              <div className="space-y-2">
                {PROBLEMAS.map((p) => (
                  <label
                    key={p.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      problema === p.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="problema"
                      value={p.value}
                      checked={problema === p.value}
                      onChange={() => setProblema(p.value)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-sm text-slate-800">{p.label}</span>
                  </label>
                ))}
              </div>
            </Field>

            {problema === "otros" && (
              <Field label="Describe tu problema">
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={4}
                  placeholder="Cuéntanos con detalle qué está pasando…"
                  className={inputCls + " resize-none"}
                  required
                />
              </Field>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 mt-2 rounded-lg font-semibold text-white shadow-md disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)" }}
            >
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Enviando…
                </span>
              ) : (
                "Enviar reporte"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Universidad Autónoma de Ica · 2026
        </p>
      </div>
    </div>
  );
}

const inputCls =
  "w-full h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:border-blue-500 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-800 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
