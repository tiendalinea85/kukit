import type {
  SyncEngineState,
  SyncTransportEntity,
} from "../../types/sync.ts";
import type { ConnectionMonitor } from "./connection.ts";
import { countOutbox, isoNow, logSyncEvent, recoverStaleOps, requeueOperation, listFailedOps, reconcilePendingEntities } from "./outbox.ts";
import { runPush, type PushRunResult } from "./push.ts";
import { runPull, type PullRunResult } from "./pull.ts";
import { setLastSyncAt } from "./state.ts";
import type { OutboxCounts } from "./outbox.ts";

// Motor de sincronización: orquesta push + pull con reintentos, backoff y
// recuperación de fallos.
//
// - Arranque: recupera operaciones estancadas ("syncing" → "pending").
// - Conectividad: reacciona a cambios de conexión (reconexión → sincroniza).
// - Automático: intervalo periódico + reintento programado al retry más cercano.
// - Manual: runSync() puede invocarse desde la UI (guard antirreentrada).
// - Estados expuestos al UI: offline / syncing / synced / error.

export interface SyncEngineDeps {
  transport: SyncTransportEntity[] | (() => SyncTransportEntity[]);
  connection: ConnectionMonitor;
  onStateChange?: (state: SyncEngineState) => void;
  autoSyncIntervalMs?: number;
  now?: () => string;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
}

export interface SyncEngine {
  start(): void;
  stop(): void;
  runSync(opts?: { reason?: string }): Promise<void>;
  syncNow(): Promise<void>;
  retryFailedNow(): Promise<void>;
  getSnapshot(): SyncEngineState;
}

function countToState(counts: OutboxCounts): SyncEngineState["status"] {
  if (counts.failed > 0 || counts.conflict > 0) return "error";
  if (counts.pending > 0 || counts.syncing > 0) return "syncing";
  return "synced";
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const getTransport = (): SyncTransportEntity[] =>
    typeof deps.transport === "function" ? deps.transport() : deps.transport;
  const nowFn = deps.now ?? isoNow;
  const setTimeoutImpl = deps.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = deps.clearTimeoutImpl ?? clearTimeout;

  let started = false;
  let inFlight: Promise<void> | null = null;
  let autoInterval: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let snapshot: SyncEngineState = {
    online: false,
    status: "idle",
    lastSyncedAt: null,
    lastError: null,
    pendingCount: 0,
    syncingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    lastPushAt: null,
    lastPullAt: null,
    history: [],
  };

  function publish(patch: Partial<SyncEngineState>): void {
    snapshot = { ...snapshot, ...patch };
    deps.onStateChange?.(snapshot);
  }

  async function refreshCounts(): Promise<void> {
    const counts = await countOutbox();
    publish({
      pendingCount: counts.pending,
      syncingCount: counts.syncing,
      failedCount: counts.failed,
      conflictCount: counts.conflict,
    });
  }

  function clearRetryTimer(): void {
    if (retryTimer) {
      clearTimeoutImpl(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleRetry(): void {
    clearRetryTimer();
    void (async () => {
      const next = await nextScheduledRetry();
      if (!next) return;
      const delay = Math.max(0, next - Date.now());
      if (delay <= 0) {
        void runSync({ reason: "retry-vencido" });
        return;
      }
      retryTimer = setTimeoutImpl(() => {
        retryTimer = null;
        void runSync({ reason: "retry-backoff" });
      }, Math.min(delay, 60_000));
    })();
  }

  async function nextScheduledRetry(): Promise<number | null> {
    const now = Date.now();
    const failed = await listFailedOps();
    let next: number | null = null;
    for (const op of failed) {
      if (op.state !== "failed" || !op.retryAt) continue;
      const t = new Date(op.retryAt).getTime();
      if (t > now && (next === null || t < next)) next = t;
    }
    return next;
  }

  async function runSync(opts: { reason?: string } = {}): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const startedAt = nowFn();
        await logSyncEvent(
          { level: "info", event: "sync_started", message: `Inicio de sincronización (${opts.reason ?? "manual"})` },
          startedAt,
        );
        await recoverStaleOps({ now: startedAt });
        await reconcilePendingEntities(startedAt);

        if (!deps.connection.getState().online) {
          publish({ status: "offline", lastError: "Sin conexión a internet" });
          await refreshCounts();
          return;
        }

        publish({ status: "syncing", lastError: null });

        let pushResult: PushRunResult | null = null;
        let pullResult: PullRunResult | null = null;
        let pushErr: string | null = null;
        let pullErr: string | null = null;

        try {
          pushResult = await runPush(getTransport(), { now: startedAt });
        } catch (err) {
          pushErr = err instanceof Error ? err.message : "Error en push";
        }
        try {
          pullResult = await runPull(getTransport(), { now: startedAt });
        } catch (err) {
          pullErr = err instanceof Error ? err.message : "Error en pull";
        }

        const counts = await countOutbox();
        const lastSync = nowFn();

        publish({
          status: countToState(counts),
          lastSyncedAt: lastSync,
          lastPushAt: pushResult ? lastSync : snapshot.lastPushAt,
          lastPullAt: pullResult ? lastSync : snapshot.lastPullAt,
          pendingCount: counts.pending,
          syncingCount: counts.syncing,
          failedCount: counts.failed,
          conflictCount: counts.conflict,
          lastError: pushErr ?? pullErr,
        });

        if (!pushErr && !pullErr) await setLastSyncAt(lastSync);

        if (counts.failed > 0 || counts.conflict > 0 || counts.pending > 0) {
          scheduleRetry();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error de sincronización";
        try {
          await logSyncEvent(
            { level: "error", event: "sync_failed", message: msg, errorType: "unknown" },
            nowFn(),
          );
        } catch {
          // El log no debe romper el flujo de sincronización.
        }
        publish({ status: "error", lastError: msg });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  async function retryFailedNow(): Promise<void> {
    const failed = await listFailedOps();
    for (const op of failed) {
      if (op.state === "failed" || op.state === "conflict") {
        await requeueOperation(op.id, nowFn());
      }
    }
    await runSync({ reason: "manual-retry" });
  }

  return {
    start() {
      if (started) return;
      started = true;

      void (async () => {
        try {
          await recoverStaleOps({ now: nowFn() });
          await refreshCounts();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Error al recuperar operaciones";
          publish({ status: "error", lastError: msg });
        }
      })();

      deps.connection.onChange((state) => {
        publish({ online: state.online });
        if (state.online) void runSync({ reason: "reconexion" });
        else {
          clearRetryTimer();
          publish({ status: "offline", lastError: "Sin conexión a internet" });
        }
      });

      const autoMs = deps.autoSyncIntervalMs ?? 60_000;
      autoInterval = setInterval(() => {
        if (deps.connection.getState().online) void runSync({ reason: "auto" });
      }, autoMs);
    },
    stop() {
      started = false;
      clearRetryTimer();
      if (autoInterval) clearInterval(autoInterval);
      autoInterval = null;
    },
    runSync,
    syncNow: () => runSync({ reason: "manual" }),
    retryFailedNow,
    getSnapshot: () => snapshot,
  };
}
