// Manejo de audio: desbloqueo de contexto + pre-carga de TTS

let unlockedContext: AudioContext | null = null;
let pendingAudio: Promise<ArrayBuffer | null> | null = null;

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return "Buenos días";
  if (h >= 12 && h < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Llama esto en el evento de clic del login para:
 *  1. Desbloquear el AudioContext (requiere gesto del usuario)
 *  2. Empezar a pre-cargar el audio TTS en paralelo con el login
 */
export function unlockAndPrefetchTts() {
  // 1. Desbloquear AudioContext
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      unlockedContext = new Ctx();
      unlockedContext.resume().catch(() => {});
    }
  } catch {}

  // 2. Pre-cargar audio en paralelo (sin nombre aún, lo personalizamos al reproducir)
  const saludo = getGreeting();
  const text = `¡${saludo}! ¡Bienvenido al Portal Académico de la Universidad Autónoma de Ica!`;
  pendingAudio = fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
    .then(r => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
}

/** Llama esto cuando ya sabes el nombre del usuario.
 *  Si el audio pre-cargado ya está listo, lo reproduce inmediatamente.
 *  Si aún está cargando, espera y reproduce. */
export async function playWelcome(fullName: string) {
  const firstName = (fullName || "").split(" ")[0];
  const saludo = getGreeting();
  const text = `¡${saludo}, ${firstName}! ¡Bienvenido al Portal Académico de la Universidad Autónoma de Ica!`;

  let buffer: ArrayBuffer | null = null;

  if (pendingAudio) {
    // Usar el audio pre-cargado (ya lleva ventaja)
    buffer = await pendingAudio;
    pendingAudio = null;
  }

  // Si el pre-cargado falló o no existe, generamos uno personalizado
  if (!buffer) {
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (r.ok) buffer = await r.arrayBuffer();
    } catch {}
  }

  if (!buffer) return;
  await playAudioBuffer(buffer);
}

export async function playAudioBuffer(arrayBuffer: ArrayBuffer) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = unlockedContext ?? new Ctx();
    await ctx.resume();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.connect(ctx.destination);
    source.start(0);
  } catch (e) {
    console.error("[audio]", e);
  }
}
