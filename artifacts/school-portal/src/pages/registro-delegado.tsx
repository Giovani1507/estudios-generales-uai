import { useState } from "react";
import { CheckCircle2, Users, Loader2, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";
const GOLD = "#C9A84C";

const CARRERAS = [
  "ADMINISTRACIÓN DE EMPRESAS",
  "ADMINISTRACIÓN Y FINANZAS",
  "ARQUITECTURA",
  "CONTABILIDAD",
  "DERECHO",
  "ENFERMERÍA",
  "ESTOMATOLOGÍA",
  "FARMACIA Y BIOQUÍMICA",
  "INGENIERÍA CIVIL",
  "INGENIERÍA DE SISTEMAS",
  "INGENIERÍA INDUSTRIAL",
  "MEDICINA HUMANA",
  "OBSTETRICIA",
  "OPTOMETRÍA",
  "TERAPIA DEL LENGUAJE",
  "TERAPIA FÍSICA Y REHABILITACIÓN",
];

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #001F5F 0%, #003399 100%)" }}
    >
      <div className="text-center max-w-sm w-full space-y-8 flex flex-col items-center">
        <div className="relative">
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center mx-auto shadow-2xl"
            style={{ background: GOLD }}
          >
            <Star className="w-14 h-14 text-white" fill="white" />
          </div>
          <span
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap shadow"
            style={{ background: "#003399", border: "2px solid " + GOLD }}
          >
            UAI · 2026-I
          </span>
        </div>

        <div className="space-y-3 pt-4">
          <p className="text-yellow-300 font-bold text-lg tracking-widest uppercase">
            ¡Bienvenido, UAINO!
          </p>
          <h1 className="text-white font-extrabold leading-tight" style={{ fontSize: "2rem" }}>
            Sé el líder de<br />tu salón
          </h1>
          <p className="text-blue-200 text-sm leading-relaxed px-4">
            Regístrate como <span className="text-yellow-300 font-semibold">Delegado</span> de tu sección y
            representa a tus compañeros este ciclo.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full px-4 pt-2">
          <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 text-left">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: GOLD }}>
              <span className="text-white font-bold text-xs">1</span>
            </div>
            <p className="text-blue-100 text-sm">Llena el formulario con tus datos</p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 text-left">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: GOLD }}>
              <span className="text-white font-bold text-xs">2</span>
            </div>
            <p className="text-blue-100 text-sm">Tu registro queda guardado al instante</p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 text-left">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: GOLD }}>
              <span className="text-white font-bold text-xs">3</span>
            </div>
            <p className="text-blue-100 text-sm">La coordinación se contactará contigo</p>
          </div>
        </div>

        <Button
          onClick={onStart}
          className="w-full h-14 font-bold text-base rounded-2xl shadow-xl flex items-center justify-center gap-2"
          style={{ background: GOLD, color: NAVY }}
        >
          Registrarme como Delegado
          <ChevronRight className="w-5 h-5" />
        </Button>

        <p className="text-blue-300 text-xs pb-4">Solo Ciclo 1 y Ciclo 2 · Universidad Autónoma de Ica</p>
      </div>
    </div>
  );
}

export default function RegistroDelegado() {
  const [step, setStep] = useState<"welcome" | "form">("welcome");
  const [form, setForm] = useState({
    apellidosNombres: "",
    carrera: "",
    ciclo: "",
    seccion: "",
    numero: "",
    correo: "",
  });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.apellidosNombres.trim()) { setError("Ingresa tus apellidos y nombres."); return; }
    if (!form.carrera)                 { setError("Selecciona tu carrera."); return; }
    if (!form.ciclo)                   { setError("Selecciona tu ciclo."); return; }
    if (!form.seccion.trim())          { setError("Ingresa tu sección."); return; }

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/delegados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al registrar");
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (step === "welcome") return <WelcomeScreen onStart={() => setStep("form")} />;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #001F5F 0%, #003399 100%)" }}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#dcfce7" }}>
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-xl font-bold" style={{ color: NAVY }}>¡Registro exitoso!</h2>
          <p className="text-sm text-slate-500">
            Tu registro como delegado ha sido guardado correctamente. La coordinación se pondrá en contacto contigo.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left text-sm space-y-1">
            <p><span className="font-semibold text-slate-600">Nombre:</span> {form.apellidosNombres.toUpperCase()}</p>
            <p><span className="font-semibold text-slate-600">Carrera:</span> {form.carrera}</p>
            <p><span className="font-semibold text-slate-600">Ciclo:</span> {form.ciclo}</p>
            <p><span className="font-semibold text-slate-600">Sección:</span> {form.seccion.toUpperCase()}</p>
          </div>
          <Button
            className="w-full text-white"
            style={{ background: NAVY }}
            onClick={() => { setSuccess(false); setStep("welcome"); setForm({ apellidosNombres: "", carrera: "", ciclo: "", seccion: "", numero: "", correo: "" }); }}
          >
            Registrar otro delegado
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: "linear-gradient(135deg, #001F5F 0%, #003399 100%)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-8 pt-8 pb-5 text-center" style={{ background: NAVY }}>
          <div className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: GOLD }}>
            <Users className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Registro de Delegados</h1>
          <p className="text-blue-200 text-sm mt-1">Universidad Autónoma de Ica · 2026-I</p>
          <div className="flex justify-center gap-2 mt-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white border border-white/30">Ciclo 1</span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white border border-white/30">Ciclo 2</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">Apellidos y Nombres <span className="text-red-500">*</span></Label>
            <Input
              value={form.apellidosNombres}
              onChange={set("apellidosNombres")}
              placeholder="Ej: GARCÍA PÉREZ JUAN CARLOS"
              className="h-10"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">Carrera Profesional <span className="text-red-500">*</span></Label>
            <select
              value={form.carrera}
              onChange={set("carrera")}
              className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Seleccionar carrera —</option>
              {CARRERAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Ciclo <span className="text-red-500">*</span></Label>
              <select
                value={form.ciclo}
                onChange={set("ciclo")}
                className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Ciclo —</option>
                <option value="1">Ciclo 1</option>
                <option value="2">Ciclo 2</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Sección <span className="text-red-500">*</span></Label>
              <Input
                value={form.seccion}
                onChange={set("seccion")}
                placeholder="Ej: A"
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">Número de Celular</Label>
            <Input
              value={form.numero}
              onChange={set("numero")}
              placeholder="Ej: 987654321"
              type="tel"
              className="h-10"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">Correo Electrónico</Label>
            <Input
              value={form.correo}
              onChange={set("correo")}
              placeholder="Ej: juan@correo.com"
              type="email"
              className="h-10"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-11 text-white font-semibold text-sm"
            style={{ background: NAVY }}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</>
            ) : (
              <><Users className="w-4 h-4 mr-2" /> Registrarme como Delegado</>
            )}
          </Button>

          <p className="text-center text-xs text-slate-400 pb-2">
            Solo delegados de Ciclo 1 y Ciclo 2 · UAI 2026-I
          </p>
        </form>
      </div>
    </div>
  );
}
