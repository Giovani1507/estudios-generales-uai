// El navegador bloquea audio automático a menos que se "desbloquee"
// durante un evento de usuario (clic). Este módulo maneja ese desbloqueo.

let unlockedContext: AudioContext | null = null;

export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    unlockedContext = new Ctx();
    unlockedContext.resume().catch(() => {});
  } catch {}
}

export async function playAudioBuffer(arrayBuffer: ArrayBuffer) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = unlockedContext ?? new Ctx();
    await ctx.resume();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.connect(ctx.destination);
    source.start(0);
  } catch (e) {
    console.error("[audio] error reproduciendo:", e);
  }
}
