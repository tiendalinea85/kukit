import { buildSupabaseTransport } from "../sync-supabase.ts";
import { createConnectionMonitor } from "./connection.ts";
import { createSyncEngine, type SyncEngine } from "./engine.ts";
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
}

export function stopSyncEngine(): void {
  if (engine) engine.stop();
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
