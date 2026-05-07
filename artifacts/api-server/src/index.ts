import app from "./app";
import { seedDefaultUsers, seedIngresantes } from "./lib/seed.js";
import { runFullSync, loginToIntranet } from "./routes/sincronizar-asistencias.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/* ─── Sync automático cada 6 horas ─── */
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 horas

async function scheduledSync() {
  if (!process.env.INTRANET_USERNAME || !process.env.INTRANET_PASSWORD) {
    console.log("[scheduler] INTRANET_USERNAME/PASSWORD no configurados, sync automático desactivado.");
    return;
  }
  try {
    console.log("[scheduler] Iniciando sync automático de asistencias...");
    const result = await runFullSync();
    console.log(`[scheduler] Sync completado: +${result.created} creados, ~${result.updated} actualizados, ${result.failed} fallidos, ${result.skipped} omitidos.`);
  } catch (err: any) {
    console.error("[scheduler] Error en sync automático:", err.message);
  }
}

(async () => {
  await seedDefaultUsers();
  await seedIngresantes();
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  // Pre-login al arrancar si hay credenciales
  if (process.env.INTRANET_USERNAME && process.env.INTRANET_PASSWORD) {
    try {
      await loginToIntranet();
      console.log("[startup] Cookie de intranet obtenida automáticamente.");
    } catch (err: any) {
      console.warn("[startup] No se pudo hacer pre-login a la intranet:", err.message);
    }
  }

  // Primer sync al arrancar (luego de 30s para que todo esté listo)
  setTimeout(scheduledSync, 30_000);
  // Sync periódico cada 6 horas
  setInterval(scheduledSync, SYNC_INTERVAL_MS);
})();
