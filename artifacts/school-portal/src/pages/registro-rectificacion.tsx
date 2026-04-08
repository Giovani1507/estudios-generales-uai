import { useState, useRef } from "react";
import { CheckCircle2, Upload, X, Loader2, Camera } from "lucide-react";

const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
const NAVY = "#001F5F";
const GOLD = "#C9A84C";

type Status = "idle" | "loading" | "success" | "error";

const ATENDIDO_OPTIONS = ["GIOVANNI", "VALERY"];

export default function RegistroRectificacion() {
  const [apellidosNombres, setApellidosNombres] = useState("");
  const [celular, setCelular] = useState("");
  const [atendidoPor, setAtendidoPor] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleFoto(file: File) {
    if (!file.type.startsWith("image/")) { setErrorMsg("Solo se aceptan imágenes"); return; }
    if (file.size > 5 * 1024 * 1024) { setErrorMsg("La imagen no debe superar 5 MB"); return; }
    setErrorMsg("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setFoto(result);
      setFotoPreview(result);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apellidosNombres.trim()) { setErrorMsg("Ingresa tus apellidos y nombres"); return; }
    if (!celular.trim() || celular.replace(/\D/g, "").length < 9) { setErrorMsg("Ingresa un número de celular válido (9 dígitos)"); return; }
    if (!atendidoPor) { setErrorMsg("Selecciona quién te atendió"); return; }
    if (!foto) { setErrorMsg("Adjunta la foto de tu comprobante de pago"); return; }

    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${base}/api/rectificaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apellidosNombres: apellidosNombres.trim().toUpperCase(),
          celular: celular.trim(),
          atendidoPor,
          fotoPago: foto,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al registrar");
      }
      setStatus("success");
    } catch (err) {
      setErrorMsg(String(err).replace("Error: ", ""));
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
        style={{ background: "linear-gradient(160deg, #001F5F 0%, #0a3080 60%, #0f4099 100%)" }}>
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-5 text-center">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">¡Registro Exitoso!</h2>
            <p className="text-sm text-gray-500 mt-1">Tu solicitud de rectificación fue registrada correctamente.</p>
          </div>
          <div className="w-full bg-gray-50 rounded-2xl p-4 text-left space-y-2 text-sm">
            <div><span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Nombre</span><p className="font-semibold text-gray-800">{apellidosNombres.toUpperCase()}</p></div>
            <div><span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Celular</span><p className="font-semibold text-gray-800">{celular}</p></div>
            <div><span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Atendido por</span><p className="font-semibold" style={{ color: NAVY }}>{atendidoPor}</p></div>
          </div>
          <p className="text-xs text-gray-400">Puedes cerrar esta ventana.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-8"
      style={{ background: "linear-gradient(160deg, #001F5F 0%, #0a3080 60%, #0f4099 100%)" }}>

      {/* Header */}
      <div className="w-full max-w-sm flex flex-col items-center gap-3 mb-6">
        <img src={`${base}/logo-uai.png`} alt="UAI" className="h-16 object-contain drop-shadow-lg" onError={e => (e.currentTarget.style.display = "none")} />
        <div className="text-center">
          <h1 className="text-white font-black text-xl tracking-tight">Registro de Rectificación</h1>
          <p className="text-white/60 text-xs mt-0.5">Universidad Autónoma de Ica · 2026</p>
        </div>
        <div className="h-px w-24 rounded-full opacity-30" style={{ background: GOLD }} />
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-5">

        {/* Apellidos y Nombres */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>
            Apellidos y Nombres completos <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Ej: GARCÍA López JUAN CARLOS"
            value={apellidosNombres}
            onChange={e => setApellidosNombres(e.target.value.toUpperCase())}
            className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-blue-400 transition-colors bg-gray-50"
            autoCapitalize="characters"
            required
          />
        </div>

        {/* Celular */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>
            Número de Celular <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            placeholder="Ej: 987654321"
            value={celular}
            onChange={e => setCelular(e.target.value.replace(/\D/g, "").slice(0, 12))}
            className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-blue-400 transition-colors bg-gray-50"
            inputMode="numeric"
            required
          />
        </div>

        {/* Atendido por */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>
            Atendido por <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ATENDIDO_OPTIONS.map(op => (
              <button
                key={op}
                type="button"
                onClick={() => setAtendidoPor(op)}
                className={`py-3.5 rounded-2xl border-2 text-sm font-bold tracking-wide transition-all ${
                  atendidoPor === op
                    ? "border-transparent text-white shadow-md"
                    : "border-gray-100 bg-gray-50 text-gray-500 hover:border-blue-200"
                }`}
                style={atendidoPor === op ? { background: NAVY } : {}}
              >
                {op}
              </button>
            ))}
          </div>
        </div>

        {/* Foto de pago */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>
            Foto del comprobante de pago <span className="text-red-500">*</span>
          </label>

          {/* Input galería (sin capture) */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFoto(f); e.target.value = ""; }}
          />
          {/* Input cámara */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFoto(f); e.target.value = ""; }}
          />

          {fotoPreview ? (
            <div className="rounded-2xl overflow-hidden border-2 border-green-200 bg-green-50">
              <img src={fotoPreview} alt="Comprobante" className="w-full max-h-52 object-contain" />
              <div className="flex items-center justify-between px-3 py-2 bg-green-100">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-semibold text-green-700">Foto adjuntada</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >Cambiar</button>
                  <button
                    type="button"
                    onClick={() => { setFoto(null); setFotoPreview(null); }}
                    className="text-xs text-red-500 font-semibold hover:underline"
                  >Quitar</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {/* Cámara */}
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl p-4 hover:border-blue-300 hover:bg-blue-50/30 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-xs font-semibold text-gray-500 text-center leading-tight">Tomar foto</p>
              </button>
              {/* Galería */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl p-4 hover:border-blue-300 hover:bg-blue-50/30 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-xs font-semibold text-gray-500 text-center leading-tight">Subir desde galería</p>
              </button>
            </div>
          )}
          <p className="text-[10px] text-gray-400 text-center">JPG, PNG · máx. 5 MB</p>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
            <X className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-600 font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full py-4 rounded-2xl text-white font-bold text-base tracking-wide shadow-lg transition-all active:scale-95 disabled:opacity-60"
          style={{ background: status === "loading" ? "#666" : `linear-gradient(135deg, ${NAVY} 0%, #1e40af 100%)` }}
        >
          {status === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Registrando...
            </span>
          ) : (
            "Enviar Registro"
          )}
        </button>

        <p className="text-center text-xs text-gray-400 -mt-2">
          Al enviar, confirmas que los datos ingresados son correctos.
        </p>
      </form>

      <p className="mt-6 text-white/30 text-xs">Portal Académico UAI © 2026</p>
    </div>
  );
}
