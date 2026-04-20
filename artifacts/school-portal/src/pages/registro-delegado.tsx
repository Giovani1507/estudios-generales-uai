import { useState } from "react";
import { CheckCircle2, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const BASE_URL = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
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

export default function RegistroDelegado() {
  const [form, setForm] = useState({
    tipo: "DELEGADO",
    apellidosNombres: "",
    carrera: "",
    ciclo: "",
    seccion: "",
    numero: "",
    correo: "",
    sede: "",
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
    if (!form.sede)                    { setError("Selecciona tu sede."); return; }

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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #001F5F 0%, #003399 100%)" }}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
          <img src={`${BASE_URL}/logo-uai.png`} alt="UAI" className="h-14 mx-auto object-contain" />
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#dcfce7" }}>
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-xl font-bold" style={{ color: NAVY }}>¡Registro exitoso!</h2>
          <p className="text-sm text-slate-500">
            Tu registro como delegado ha sido guardado correctamente. La coordinación se pondrá en contacto contigo.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left text-sm space-y-1">
            <p>
              <span className="font-semibold text-slate-600">Tipo: </span>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={form.tipo === "SUB DELEGADO"
                  ? { background: "#fef9c3", color: "#854d0e" }
                  : { background: "#dbeafe", color: "#1e40af" }}
              >
                {form.tipo}
              </span>
            </p>
            <p><span className="font-semibold text-slate-600">Nombre:</span> {form.apellidosNombres.toUpperCase()}</p>
            <p><span className="font-semibold text-slate-600">Carrera:</span> {form.carrera}</p>
            <p><span className="font-semibold text-slate-600">Ciclo:</span> {form.ciclo}</p>
            <p><span className="font-semibold text-slate-600">Sección:</span> {form.seccion.toUpperCase()}</p>
            <p><span className="font-semibold text-slate-600">Sede:</span> {form.sede}</p>
          </div>
          <Button
            className="w-full text-white"
            style={{ background: NAVY }}
            onClick={() => { setSuccess(false); setForm({ tipo: "DELEGADO", apellidosNombres: "", carrera: "", ciclo: "", seccion: "", numero: "", correo: "", sede: "" }); }}
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
        <div className="px-8 pt-7 pb-5 text-center" style={{ background: NAVY }}>
          <img
            src={`${BASE_URL}/logo-uai.png`}
            alt="Universidad Autónoma de Ica"
            className="h-16 mx-auto object-contain mb-4"
          />
          <div
            className="inline-block px-3 py-0.5 rounded-full text-xs font-bold mb-3"
            style={{ background: GOLD, color: NAVY }}
          >
            EE.GG · Estudios Generales
          </div>
          <h1 className="text-lg font-bold text-white leading-tight">Registro de Delegados</h1>
          <p className="text-blue-200 text-xs mt-1">Universidad Autónoma de Ica · 2026-I</p>
          <div className="flex justify-center gap-2 mt-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white border border-white/30">Ciclo 1</span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white border border-white/30">Ciclo 2</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-600">Tipo de Registro <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-2 gap-2">
              {(["DELEGADO", "SUB DELEGADO"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo: t }))}
                  className="h-12 rounded-xl border-2 font-bold text-sm transition-all"
                  style={form.tipo === t
                    ? { background: NAVY, borderColor: NAVY, color: "white" }
                    : { background: "white", borderColor: "#e2e8f0", color: "#64748b" }}
                >
                  {t === "DELEGADO" ? "👑 Delegado" : "⭐ Sub Delegado"}
                </button>
              ))}
            </div>
          </div>

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
            <Label className="text-xs font-semibold text-slate-600">Sede <span className="text-red-500">*</span></Label>
            <select
              value={form.sede}
              onChange={set("sede")}
              className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Seleccionar sede —</option>
              <option value="SEDE SUNAMPE">Sede Sunampe</option>
              <option value="FILIAL HUAURA">Filial Huaura</option>
              <option value="FILIAL PORUMA">Filial Poruma</option>
            </select>
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
