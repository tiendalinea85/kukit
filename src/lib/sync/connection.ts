// Detección de conexión.
//
// `navigator.onLine` solo detecta la interfaz de red (puede reportar online con
// una red sin internet real). Para robustez se combina con un heartbeat HTTP
// ligero contra el backend: si el heartbeat falla, se declara offline.
//
// La lógica es inyectable (sin `window`/`navigator`) para poder probarla en Node.

export interface ConnectionMonitorOptions {
  /** Lee el estado reportado por el navegador. */
  navigatorOnline?: () => boolean;
  /** Implementación de fetch (inyectable para pruebas). */
  fetchImpl?: typeof fetch;
  /** URL de salud del backend. Si es null, solo se usa navigator.onLine. */
  heartbeatUrl?: string | null;
  /** Intervalo del heartbeat periódico. */
  heartbeatIntervalMs?: number;
  /** Tiempo máximo de espera de una respuesta del heartbeat. */
  heartbeatTimeoutMs?: number;
  /** Cabeceras (p. ej. apikey/Authorization de Supabase). */
  heartbeatHeaders?: Record<string, string>;
}

export interface ConnectionState {
  online: boolean;
  checkedAt: string | null;
  latencyMs: number | null;
}

export interface ConnectionMonitor {
  start(): void;
  stop(): void;
  getState(): ConnectionState;
  onChange(cb: (state: ConnectionState) => void): () => void;
}

export const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 5_000;

export function createConnectionMonitor(options: ConnectionMonitorOptions = {}): ConnectionMonitor {
  const navigatorOnline = options.navigatorOnline ?? (() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const fetchImpl = options.fetchImpl ?? (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined);
  const heartbeatUrl = options.heartbeatUrl ?? null;
  const intervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const timeoutMs = options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
  const headers = options.heartbeatHeaders;

  let heartbeatOk: boolean | null = null;
  let checkedAt: string | null = null;
  let latencyMs: number | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  const listeners = new Set<(state: ConnectionState) => void>();

  function state(): ConnectionState {
    const base = navigatorOnline();
    // En la app instalada (iOS PWA) `navigator.onLine` puede reportar offline
    // aunque haya internet (y viceversa). El heartbeat HTTP es la fuente de
    // verdad: si el navegador dice offline pero el heartbeat responde OK,
    // se considera online; si el heartbeat falla, offline (aunque navigator
    // siga diciendo online).
    const online = heartbeatOk === false ? false : base || heartbeatOk === true;
    return { online, checkedAt, latencyMs };
  }

  function emit(): void {
    const s = state();
    for (const cb of listeners) cb(s);
  }

  async function heartbeat(): Promise<void> {
    if (stopped || !heartbeatUrl || !fetchImpl) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();
    try {
      const res = await fetchImpl(heartbeatUrl, {
        method: "HEAD",
        headers,
        signal: controller.signal,
        cache: "no-store",
      });
      heartbeatOk = res.ok;
    } catch {
      heartbeatOk = false;
    } finally {
      clearTimeout(timer);
      checkedAt = new Date().toISOString();
      latencyMs = Math.round(performance.now() - started);
    }
    emit();
  }

  function onNetworkEvent(): void {
    // Re-evaluar con un heartbeat (no confiar en navigator.onLine: en iOS
    // PWA los eventos online/offline pueden no dispararse o reportar mal).
    heartbeatOk = null;
    void heartbeat();
    emit();
  }

  function onVisibilityChange(): void {
    // iOS PWA suspende timers en background; al volver al foreground se
    // re-evalúa la conexión con un heartbeat para reanudar la sincronización.
    const state = typeof document !== "undefined" ? document.visibilityState : "visible";
    if (state === "visible" || state === undefined) {
      heartbeatOk = null;
      void heartbeat();
    }
  }

  return {
    start() {
      stopped = false;
      if (typeof window !== "undefined") {
        window.addEventListener("online", onNetworkEvent);
        window.addEventListener("offline", onNetworkEvent);
        window.addEventListener("pageshow", onVisibilityChange);
      }
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisibilityChange);
      }
      if (heartbeatUrl && fetchImpl) {
        interval = setInterval(() => void heartbeat(), intervalMs);
        void heartbeat();
      } else {
        emit();
      }
    },
    stop() {
      stopped = true;
      if (interval) clearInterval(interval);
      interval = null;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onNetworkEvent);
        window.removeEventListener("offline", onNetworkEvent);
        window.removeEventListener("pageshow", onVisibilityChange);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    },
    getState: state,
    onChange(cb) {
      listeners.add(cb);
      cb(state());
      return () => listeners.delete(cb);
    },
  };
}
