// Modelo de sincronización Offline First.
//
// Estados de sincronización por registro:
//   - local:      dato local que aún no se encola (p. ej. datos de demostración).
//   - pending:    cambio pendiente de enviar (encolado en el outbox).
//   - syncing:    enviándose en este momento.
//   - synced:     confirmado por el servidor.
//   - failed:     falló el envío (reintento con backoff o permanente si no es retryable).
//   - conflict:   divergencia local/servidor detectada (LWW + revision).
//
// El outbox es la cola local de operaciones. Cada fila de dominio mantiene su
// propio syncStatus para consultas rápidas; el outbox es la fuente de verdad
// del orden de envío, intentos e idempotencia.

export type SyncStatus = "local" | "pending" | "syncing" | "synced" | "failed" | "conflict";

export type SyncOp = "upsert" | "delete" | "append";

export type OutboxState = "pending" | "syncing" | "synced" | "failed" | "conflict";

export interface OutboxOperation {
  id: string;
  entity: string;
  entityId: string;
  workspaceId: string;
  op: SyncOp;
  payload: Record<string, unknown>;
  payloadHash: string;
  state: OutboxState;
  attempts: number;
  lastError: string | null;
  lastErrorType: SyncErrorType | null;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string | null;
  retryAt: string | null;
}

export type SyncErrorType =
  | "network"
  | "timeout"
  | "server"
  | "validation"
  | "conflict"
  | "auth"
  | "unknown";

export interface SyncErrorInfo {
  type: SyncErrorType;
  message: string;
  retryable: boolean;
}

export type SyncLogLevel = "info" | "warn" | "error";

export type SyncLogEvent =
  | "connection_change"
  | "push_ok"
  | "push_failed"
  | "push_conflict"
  | "pull_ok"
  | "pull_failed"
  | "conflict_detected"
  | "recovered_stale"
  | "reconciled"
  | "sync_started"
  | "sync_complete"
  | "sync_failed";

export interface SyncLogEntry {
  id: string;
  ts: string;
  level: SyncLogLevel;
  event: SyncLogEvent;
  entity?: string;
  entityId?: string;
  message?: string;
  errorType?: SyncErrorType;
  attempts?: number;
}

export interface SyncStateRecord {
  key: string;
  value: string;
  updatedAt: string;
}

// Estado global del motor de sincronización (expuesto al UI).
export type SyncEngineStatus = "idle" | "syncing" | "synced" | "error" | "offline";

export interface SyncEngineState {
  online: boolean;
  status: SyncEngineStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  pendingCount: number;
  syncingCount: number;
  failedCount: number;
  conflictCount: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
  history: SyncLogEntry[];
}

// Transporte: describe cómo una tabla local se refleja en el servidor.
// Las entidades de operaciones históricas (ventas, compras, movimientos) se
// tratan como registradas: el push respeta la `revision` remota y los
// movimientos de inventario son append-only (nunca se sobrescriben).
export interface SyncTransportEntity {
  name: string;
  serverTable: string;
  order: number;
  push(op: OutboxOperation): Promise<SyncErrorInfo | null>;
  pull(sinceIso: string): Promise<{
    rows: Array<Record<string, unknown>>;
    watermark: string | null;
  }>;
}
