import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, AlertCircle, CreditCard, GraduationCap,
  Search, Loader2, BookOpen, Clock, LayoutGrid, User
} from "lucide-react";

type LookupStatus = "idle" | "loading" | "found" | "notfound";
type SubmitStatus = "idle" | "loading" | "success" | "error" | "duplicate";

interface Ingresante {
  dni:              string;
  apellidosNombres: string;
  codigoEstudiante: string | null;
  carrera:          string | null;
  sede:             string | null;
  modalidadIngreso: string | null;
  modalidadEstudio: string | null;
  turno:            string | null;
  seccion:          string | null;
}

const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

function Badge({ label, value, color }: { label: string; value: string | null; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value || "—"}</span>
    </div>
  );
}

export default function RegistroEstudiante() {
  const [dni, setDni]                 = useState("");
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [ingresante, setIngresante]   = useState<Ingresante | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clean = dni.replace(/\D/g, "");
    if (clean.length !== 8) {
      setLookupStatus("idle");
      setIngresante(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLookupStatus("loading");
      try {
        const res = await fetch(`${base}/api/students/lookup?dni=${clean}`);
        if (res.ok) {
          const data = await res.json();
          if (data.encontrado) {
            setIngresante(data);
            setLookupStatus("found");
          } else {
            setIngresante(null);
            setLookupStatus("notfound");
          }
        } else {
          setIngresante(null);
          setLookupStatus("notfound");
        }
      } catch {
        setIngresante(null);
        setLookupStatus("notfound");
      }
    }, 400);
  }, [dni]);

  async function handleSubmit() {
    const clean = dni.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setSubmitStatus("loading");
    try {
      const res = await fetch(`${base}/api/students/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni: clean }),
      });
      if (res.status === 409) { setSubmitStatus("duplicate"); return; }
      if (!res.ok) throw new Error();
      setSubmitStatus("success");
    } catch {
      setSubmitStatus("error");
    }
  }

  /* ── Success screen ── */
  if (submitStatus === "success") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "linear-gradient(160deg, #001F5F 0%, #0d3a8c 40%, #1a5fb4 70%, #2f80d6 100%)" }}
      >
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-12 flex flex-col items-center text-center max-w-sm w-full">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: "#dcfce7", border: "2px solid #bbf7d0" }}
          >
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">¡Registro exitoso!</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">
            Tu registro ha sido recibido. Pronto se te asignará un horario.
          </p>
          {ingresante && (
            <div className="w-full bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100 text-left">
              <p className="text-xs font-bold text-blue-700 mb-1">{ingresante.apellidosNombres}</p>
              <p className="text-xs text-blue-500">{ingresante.carrera}</p>
              {ingresante.turno && ingresante.seccion && (
                <p className="text-xs text-blue-400 mt-0.5">Turno {ingresante.turno} · Sección {ingresante.seccion}</p>
              )}
            </div>
          )}
          <div className="mt-4 w-full bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
            <p className="text-xs font-semibold text-gray-700">Universidad Autónoma de Ica</p>
            <p className="text-xs text-gray-400 mt-0.5">Semestre Académico 2026-1</p>
          </div>
        </div>
      </div>
    );
  }

  const dniClean   = dni.replace(/\D/g, "");
  const canSubmit  = dniClean.length === 8 && (lookupStatus === "found" || lookupStatus === "notfound");

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "linear-gradient(160deg, #001F5F 0%, #0d3a8c 40%, #1a5fb4 70%, #2f80d6 100%)" }}
    >
      <div className="w-full max-w-md">

        {/* Logo & Title */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", border: "1.5px solid rgba(255,255,255,0.3)" }}
          >
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-2xl font-black tracking-tight text-center">
            Registro de Estudiante
          </h1>
          <p className="text-white/60 text-xs mt-1.5 text-center bg-white/10 rounded-full px-4 py-1">
            Estudiantes sin horario asignado · 2026-1
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="h-1.5" style={{ background: "linear-gradient(90deg, #001F5F 0%, #2f80d6 50%, #001F5F 100%)" }} />

          <div className="px-7 py-8 flex flex-col gap-5">

            {/* DNI input */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                <CreditCard className="w-3.5 h-3.5" />
                DNI <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={dni}
                  onChange={e => { setDni(e.target.value.replace(/\D/g, "").slice(0, 8)); setSubmitStatus("idle"); }}
                  placeholder="Ej: 74123456"
                  inputMode="numeric"
                  maxLength={8}
                  className="w-full h-12 px-4 pr-11 rounded-xl border-2 border-gray-100 bg-gray-50 text-base font-bold focus:outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-gray-300 tracking-widest"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {lookupStatus === "loading" && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
                  {lookupStatus === "found"   && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  {lookupStatus === "notfound" && dniClean.length === 8 && <AlertCircle className="w-5 h-5 text-amber-400" />}
                  {lookupStatus === "idle"    && <Search className="w-5 h-5 text-gray-300" />}
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 ml-1">
                Ingresa tu DNI de 8 dígitos para verificar tus datos
              </p>
            </div>

            {/* Preview card — found */}
            {lookupStatus === "found" && ingresante && (
              <div className="rounded-2xl border-2 border-green-200 bg-green-50 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-green-600">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span className="text-white text-xs font-bold uppercase tracking-wide">Datos encontrados</span>
                </div>
                <div className="px-4 py-4 flex flex-col gap-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-green-200 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Apellidos y Nombres</p>
                      <p className="text-sm font-bold text-gray-900 leading-tight">{ingresante.apellidosNombres}</p>
                      {ingresante.codigoEstudiante && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 bg-white border border-green-200 rounded-full px-2.5 py-0.5">
                          <span className="text-[9px] font-bold text-green-700 uppercase tracking-wide">Cód. Estudiante</span>
                          <span className="text-xs font-black text-green-800 tracking-wider">{ingresante.codigoEstudiante}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-green-100 pt-3">
                    <div className="flex items-start gap-2">
                      <BookOpen className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Carrera</p>
                        <p className="text-xs font-semibold text-gray-800">{ingresante.carrera || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className={`w-4 h-4 rounded-full shrink-0 mt-0.5 flex items-center justify-center ${ingresante.turno ? "bg-blue-100" : "bg-gray-100"}`}>
                        <Clock className="w-3 h-3 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Turno</p>
                        <p className="text-xs font-semibold text-gray-800">{ingresante.turno || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <LayoutGrid className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Sección</p>
                        <p className="text-xs font-semibold text-gray-800">{ingresante.seccion || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <GraduationCap className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Modalidad</p>
                        <p className="text-xs font-semibold text-gray-800">{ingresante.modalidadEstudio || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Warning — not found */}
            {lookupStatus === "notfound" && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-700">DNI no encontrado en la lista de ingresantes</p>
                  <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
                    Tu DNI no está en la data de ingresantes con pago. Puedes continuar el registro de todas formas.
                  </p>
                </div>
              </div>
            )}

            {/* Error / duplicate */}
            {submitStatus === "error" && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Ocurrió un error. Por favor intenta de nuevo.
              </div>
            )}
            {submitStatus === "duplicate" && (
              <div className="flex items-center gap-2.5 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-yellow-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Este DNI ya fue registrado anteriormente.
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitStatus === "loading"}
              className="w-full h-12 rounded-xl font-black text-white text-sm tracking-wide transition-all disabled:opacity-50 shadow-lg active:scale-[0.98]"
              style={{ background: canSubmit ? "linear-gradient(135deg, #001F5F 0%, #2f80d6 100%)" : "#9ca3af" }}
            >
              {submitStatus === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registrando…
                </span>
              ) : lookupStatus === "found"
                ? "Confirmar mi registro"
                : dniClean.length === 8
                  ? "Registrarme de todas formas"
                  : "Ingresa tu DNI para continuar"
              }
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
