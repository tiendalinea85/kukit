import { buildSupabaseTransport } from "../sync-supabase.ts";
import { onAuthStateChange } from "../supabase.ts";
import { createConnectionMonitor } from "./connection.ts";
import { createSyncEngine, type SyncEngine } from "./engine.ts";
import { countOutbox, listFailedOps } from "./outbox.ts";
import { useSyncStore } from "./store.ts";

// API pública de sincronización.
//
// - `startSyncEngine()` inicia detección de conexión + sincronización automática
//   (reconexión, intervalo, reintentos con backoff, recuperación de fallos).
// - `syncAllToSupabase()` / `pullFromSupabase()` ejecutan una pasada push+pull.
// - `useSyncStore` expone el estado (online, syncing, pendientes, errores).

export { useSyncStore } from "./store.ts";
export type { SyncEngineState } from "../../types/sync";

let engine: SyncEngine | null = null;
let started = false;
let authUnsub: (() => void) | null = null;

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

function ensureEngine(): SyncEngine {
  if (engine) return engine;

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  const connection = createConnectionMonitor({
    heartbeatUrl: url ? `${url}/auth/v1/health` : null,
    heartbeatHeaders: anonKey
      ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
      : undefined,
  });

  engine = createSyncEngine({
    transport: () => buildSupabaseTransport(),
    connection,
    onStateChange: (state) => useSyncStore.getState().hydrate(state),
    autoSyncIntervalMs: 60_000,
  });

  useSyncStore.getState().registerEngineActions({
    manualSync: () => engine!.syncNow(),
    retryNow: () => engine!.retryFailedNow(),
  });

  return engine;
}

export function startSyncEngine(): void {
  if (started) return;
  started = true;
  ensureEngine().start();

  // Con sesión disponible (login o renovación del token) se empuja de inmediato:
  // las operaciones que quedaron esperando por falta de sesión se recuperan sin
  // esperar al siguiente ciclo automático.
  authUnsub = onAuthStateChange((user) => {
    if (user) void ensureEngine().runSync({ reason: "auth-change" });
  });
}

export function stopSyncEngine(): void {
  if (engine) engine.stop();
  if (authUnsub) {
    authUnsub();
    authUnsub = null;
  }
}

/** Push + pull en una sola pasada (guard antirreentrada). */
export function syncAllToSupabase(): Promise<void> {
  return ensureEngine().runSync({ reason: "sync-all" });
}

/** Pull incremental desde el último watermark. */
export function pullFromSupabase(): Promise<void> {
  return ensureEngine().runSync({ reason: "pull" });
}

/** Sincronización manual invocada desde la UI. */
export function runManualSync(): Promise<void> {
  return ensureEngine().syncNow();
}

/** Reintenta las operaciones fallidas/en conflicto ahora. */
export function runRetryNow(): Promise<void> {
  return ensureEngine().retryFailedNow();
}

// Diagnóstico solo en desarrollo: permite inspeccionar el outbox desde la
// consola del navegador (`await __syncDebug.failed()`, `await __syncDebug.counts()`)
// para ver POR QUÉ una operación quedó en rojo, ya que la UI solo muestra el conteo.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __syncDebug?: unknown }).__syncDebug = {
    failed: listFailedOps,
    counts: countOutbox,
  };
}
