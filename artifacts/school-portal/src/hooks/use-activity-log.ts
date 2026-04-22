import { useEffect, useRef } from "react";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

export type ActivityType =
  | "ingreso_apartado"
  | "descarga"
  | "edicion"
  | "eliminacion"
  | "check"
  | "justificacion_registro"
  | "justificacion_check"
  | "justificacion_uncheck"
  | "justificacion_eliminacion";

export function logActivity(type: ActivityType | string, detail?: string): void {
  void fetch(`${apiBase}/api/activity/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ type, detail: detail ?? null }),
  }).catch(() => {});
}

/**
 * Registra automáticamente una entrada a un apartado al montar el componente.
 * El log solo se envía una vez por montaje, aunque haya re-renders.
 */
export function useLogPageEntry(apartado: string): void {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    logActivity("ingreso_apartado", apartado);
  }, [apartado]);
}
