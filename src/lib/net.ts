// Utilidades de red: timeouts y fast-paths offline para llamadas a Supabase.
// Sin un timeout, una petición a un backend inalcanzable puede colgar la UI
// (spinners a pantalla completa) hasta que el SO abandona el socket.

export const DEFAULT_TIMEOUT_MS = 8000;

/** Rechaza con un timeout si la promesa no resuelve a tiempo (no aborta la petición). */
export function withTimeout<T>(promise: Promise<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout tras ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** true si el navegador reporta que no hay interfaz de red activa. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}