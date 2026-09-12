import { db } from "../db.ts";
import type {
  OutboxOperation,
  OutboxState,
  SyncErrorInfo,
  SyncErrorType,
  SyncLogEntry,
  SyncLogEvent,
  SyncLogLevel,
} from "../../types/sync.ts";
import { computeBackoffDelay } from "./backoff.ts";

// Cola local (outbox) de operaciones pendientes de sincronizar.
//
// Garantías:
//   - UNA operación por (entidad, entidadId): el re-encolado de un cambio nuevo
//     actualiza la operación existente (deduplicación) en lugar de crear una
//     duplicada → los reintentos nunca duplican registros.
//   - Idempotencia por hash de payload: si la operación cambió mientras estaba
//     en vuelo, el completado vuelve a encolarla.
//   - Recuperación de fallos: operaciones estancadas en "syncing" (app cerrada
//     a mitad de sincronización) vuelven a "pending" al arrancar.

export const SYNC_ENTITY_TABLES = [
  "expenses",
  "categories",
  "types",
  "investments",
  "investmentCategories",
  "customers",
  "products",
  "inventoryMovements",
  "sales",
  "saleDetails",
  "purchases",
  "purchaseDetails",
  "garments",
  "sizes",
  "garmentColors",
  "materials",
  "productionOrders",
  "productionMaterials",
  "crops",
  "farmLots",
  "agroInputs",
  "applications",
  "labors",
  "harvests",
  "vehicleBrands",
  "vehicleModels",
  "autoParts",
  "partCompatibilities",
  "species",
  "breedingLots",
  "animals",
  "feedings",
  "reproductions",
  "livestockProductions",
] as const;

export type SyncEntity = (typeof SYNC_ENTITY_TABLES)[number];

function entityTable(entity: string): { update(id: string, changes: { syncStatus: OutboxState }): Promise<number> } | null {
  if (!(SYNC_ENTITY_TABLES as readonly string[]).includes(entity)) return null;
  const table = db[entity as SyncEntity] as unknown as {
    update(id: string, changes: { syncStatus: OutboxState }): Promise<number>;
  };
  return table ?? null;
}

/** Stringify canónico (claves ordenadas) para comparar payloads de forma estable. */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys
    .map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`)
    .join(",");
  return `{${parts}}`;
}

/** Hash estable (djb2) del payload canónico. */
export function hashPayload(payload: Record<string, unknown>): string {
  const str = canonicalStringify(payload);
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(36)}${str.length.toString(36)}`;
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function isoNow(): string {
  return new Date().toISOString();
}

export async function logSyncEvent(
  entry: Omit<SyncLogEntry, "id" | "ts">,
  now: string = isoNow(),
): Promise<void> {
  await db.syncLog.add({ id: uuid(), ts: now, ...entry });
}

export async function clearSyncLog(): Promise<void> {
  await db.syncLog.clear();
}

/**
 * Encola una operación con deduplicación.
 * - Si ya existe una operación `pending`/`failed` para (entity, entityId),
 *   se actualiza el payload y vuelve a `pending` (nuevo intento limpio).
 * - Si está `syncing` se actualiza el payload; el completado detectará el
 *   cambio de hash y volverá a encolar (no se pierde ninguna escritura).
 */
export async function enqueueOperation(input: {
  entity: string;
  entityId: string;
  workspaceId?: string;
  op: OutboxOperation["op"];
  payload: Record<string, unknown>;
  now?: string;
}): Promise<OutboxOperation> {
  const now = input.now ?? isoNow();
  const wsId = input.workspaceId ?? "";
  const existing = await db.syncOutbox.where("[entity+entityId]").equals([input.entity, input.entityId]).first();

  if (existing) {
    const updated: Partial<OutboxOperation> = {
      op: input.op,
      payload: input.payload,
      payloadHash: hashPayload(input.payload),
      workspaceId: wsId,
      updatedAt: now,
    };
    if (existing.state !== "syncing") {
      updated.state = "pending";
      updated.attempts = 0;
      updated.lastError = null;
      updated.lastErrorType = null;
      updated.retryAt = null;
    }
    await db.syncOutbox.update(existing.id, updated);
    return { ...existing, ...updated } as OutboxOperation;
  }

  const op: OutboxOperation = {
    id: uuid(),
    entity: input.entity,
    entityId: input.entityId,
    workspaceId: wsId,
    op: input.op,
    payload: input.payload,
    payloadHash: hashPayload(input.payload),
    state: "pending",
    attempts: 0,
    lastError: null,
    lastErrorType: null,
    createdAt: now,
    updatedAt: now,
    lastAttemptAt: null,
    retryAt: null,
  };
  await db.syncOutbox.add(op);
  return op;
}

/**
 * Reclama el siguiente lote de operaciones listas (estado pending y retryAt
 * vencido o nulo), marcándolas `syncing` en una transacción para evitar
 * reclamaciones concurrentes.
 */
const SYNC_PUSH_RANK: Record<string, number> = {
  categories: 0,
  types: 1,
  investmentCategories: 2,
  customers: 3,
  products: 4,
  garmentColors: 5,
  sizes: 6,
  vehicleBrands: 7,
  vehicleModels: 8,
  species: 9,
  materials: 10,
  agroInputs: 11,
  garments: 12,
  crops: 13,
  farmLots: 14,
  breedingLots: 15,
  animals: 16,
  expenses: 20,
  investments: 21,
  purchases: 22,
  sales: 23,
  productionOrders: 24,
  applications: 25,
  labors: 26,
  harvests: 27,
  autoParts: 28,
  feedings: 29,
  reproductions: 30,
  livestockProductions: 31,
  inventoryMovements: 40,
  purchaseDetails: 41,
  saleDetails: 42,
  productionMaterials: 43,
  partCompatibilities: 44,
};

function pushRank(entity: string): number {
  return SYNC_PUSH_RANK[entity] ?? 99;
}

/**
 * Reclama el siguiente lote de operaciones listas (estado pending y retryAt
 * vencido o nulo), marcándolas `syncing` en una transacción para evitar
 * reclamaciones concurrentes. Ordena por dependencias de claves foráneas del
 * servidor (categorías/tipos/clientes/productos primero; cabeceras antes que
 * detalles) y, dentro del mismo nivel, por antigüedad.
 */
export async function claimNextBatch(
  limit: number,
  now: string = isoNow(),
): Promise<OutboxOperation[]> {
  const tx = db.transaction("rw", db.syncOutbox, async () => {
    const pending = await db.syncOutbox.where("state").equals("pending").toArray();
    const ready = pending.filter(
      (op) => !op.retryAt || new Date(op.retryAt).getTime() <= new Date(now).getTime(),
    );
    ready.sort((a, b) => {
      const rank = pushRank(a.entity) - pushRank(b.entity);
      if (rank !== 0) return rank;
      return (a.updatedAt ?? a.createdAt).localeCompare(b.updatedAt ?? b.createdAt);
    });
    const selected = ready.slice(0, limit);
    for (const op of selected) {
      await db.syncOutbox.update(op.id, {
        state: "syncing",
        lastAttemptAt: now,
      });
    }
    return selected.map((op) => ({
      ...op,
      state: "syncing" as const,
      lastAttemptAt: now,
    }));
  });
  return tx;
}

/**
 * Completado idempotente: marca la operación como `synced` y el registro como
 * `synced`. Si el payload cambió mientras estaba en vuelo (hash distinto),
 * vuelve a encolarla como `pending` para no perder la escritura.
 */
export async function completeOperation(
  op: OutboxOperation,
  now: string = isoNow(),
): Promise<boolean> {
  const current = await db.syncOutbox.get(op.id);
  if (!current) return true;

  if (current.payloadHash !== op.payloadHash) {
    await db.syncOutbox.update(op.id, {
      state: "pending",
      attempts: 0,
      lastError: null,
      lastErrorType: null,
      retryAt: null,
      updatedAt: now,
    });
    return false;
  }

  await db.syncOutbox.update(op.id, {
    state: "synced",
    updatedAt: now,
    lastError: null,
    lastErrorType: null,
  });
  const table = entityTable(op.entity);
  if (table) await table.update(op.entityId, { syncStatus: "synced" });
  return true;
}

export interface FailOptions {
  error: SyncErrorInfo;
  now?: string;
}

/** Marca la operación como `failed` y programa el siguiente reintento. */
export async function failOperation(
  op: OutboxOperation,
  opts: FailOptions,
): Promise<void> {
  const now = opts.now ?? isoNow();
  const attempts = op.attempts + 1;
  const retryAt = opts.error.retryable
    ? new Date(now).getTime() + computeBackoffDelay(attempts)
    : null;

  await db.syncOutbox.update(op.id, {
    state: "failed",
    attempts,
    lastError: opts.error.message,
    lastErrorType: opts.error.type,
    retryAt: retryAt ? new Date(retryAt).toISOString() : null,
    updatedAt: now,
    lastAttemptAt: now,
  });
  const table = entityTable(op.entity);
  if (table) await table.update(op.entityId, { syncStatus: "failed" });

  await logSyncEvent({
    level: "error",
    event: "push_failed",
    entity: op.entity,
    entityId: op.entityId,
    message: opts.error.message,
    errorType: opts.error.type,
    attempts,
  }, now);
}

/** Marca la operación y el registro como `conflict` (divergencia LWW). */
export async function markConflict(
  op: OutboxOperation,
  error: SyncErrorInfo,
  now: string = isoNow(),
): Promise<void> {
  await db.syncOutbox.update(op.id, {
    state: "conflict",
    attempts: op.attempts + 1,
    lastError: error.message,
    lastErrorType: "conflict",
    updatedAt: now,
    lastAttemptAt: now,
    retryAt: null,
  });
  const table = entityTable(op.entity);
  if (table) await table.update(op.entityId, { syncStatus: "conflict" });

  await logSyncEvent({
    level: "warn",
    event: "push_conflict",
    entity: op.entity,
    entityId: op.entityId,
    message: error.message,
    errorType: "conflict",
    attempts: op.attempts + 1,
  }, now);
}

/** Marca como `conflict` la operación del outbox de una (entidad, entidadId). */
export async function markOutboxConflictByEntity(
  entity: string,
  entityId: string,
  message: string,
  now: string = isoNow(),
): Promise<void> {
  const op = await db.syncOutbox.where("[entity+entityId]").equals([entity, entityId]).first();
  if (op && (op.state === "pending" || op.state === "failed" || op.state === "syncing")) {
    await db.syncOutbox.update(op.id, {
      state: "conflict",
      attempts: op.attempts + 1,
      lastError: message,
      lastErrorType: "conflict",
      updatedAt: now,
      lastAttemptAt: now,
      retryAt: null,
    });
  }
  await logSyncEvent({
    level: "warn",
    event: "conflict_detected",
    entity,
    entityId,
    message,
    errorType: "conflict",
  }, now);
}

/**
 * Recuperación de fallos: operaciones estancadas en `syncing` (app cerrada a
 * mitad de sincronización) o en `failed` con retry vencido vuelven a `pending`.
 * También resetea el `syncStatus` de los registros que quedaron en `syncing`.
 */
export async function recoverStaleOps(opts: {
  staleAfterMs?: number;
  now?: string;
} = {}): Promise<number> {
  const now = opts.now ?? isoNow();
  const staleAfterMs = opts.staleAfterMs ?? 5 * 60_000;
  const cutoff = new Date(now).getTime() - staleAfterMs;

  const tx = db.transaction("rw", db.syncOutbox, async () => {
    const all = await db.syncOutbox.toArray();
    let recovered = 0;
    for (const op of all) {
      let shouldRecover = false;
      if (op.state === "syncing") {
        const last = op.lastAttemptAt ? new Date(op.lastAttemptAt).getTime() : 0;
        shouldRecover = last <= cutoff;
      } else if (op.state === "failed" && op.retryAt) {
        shouldRecover = new Date(op.retryAt).getTime() <= new Date(now).getTime();
      }
      if (shouldRecover) {
        await db.syncOutbox.update(op.id, {
          state: "pending",
          updatedAt: now,
        });
        recovered++;
      }
    }
    return recovered;
  });

  const recovered = await tx;
  if (recovered > 0) {
    // Los registros quedaron en "syncing" y deben volver a "pending".
    const ops = await db.syncOutbox.where("state").equals("pending").toArray();
    for (const op of ops) {
      const table = entityTable(op.entity);
      if (table) await table.update(op.entityId, { syncStatus: "pending" });
    }
    await logSyncEvent({
      level: "warn",
      event: "recovered_stale",
      message: `${recovered} operaciones estancadas recuperadas`,
    }, now);
  }
  return recovered;
}

export interface OutboxCounts {
  pending: number;
  syncing: number;
  failed: number;
  conflict: number;
}

export async function countOutbox(): Promise<OutboxCounts> {
  const [pending, syncing, failed, conflict] = await Promise.all([
    db.syncOutbox.where("state").equals("pending").count(),
    db.syncOutbox.where("state").equals("syncing").count(),
    db.syncOutbox.where("state").equals("failed").count(),
    db.syncOutbox.where("state").equals("conflict").count(),
  ]);
  return { pending, syncing, failed, conflict };
}

/** Próximo retry programado (más temprano) entre las operaciones fallidas. */
export async function nextRetryAt(now: string = isoNow()): Promise<string | null> {
  const failed = await db.syncOutbox.where("state").equals("failed").toArray();
  const pendingWithRetry = (await db.syncOutbox.where("state").equals("pending").toArray())
    .filter((op) => op.retryAt && new Date(op.retryAt).getTime() > new Date(now).getTime());
  const candidates = [...failed, ...pendingWithRetry]
    .map((op) => op.retryAt)
    .filter((v): v is string => Boolean(v));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
}

/** Lista de operaciones fallidas (para mostrarlas en la UI y reintentar). */
export async function listFailedOps(): Promise<OutboxOperation[]> {
  return db.syncOutbox.where("state").anyOf("failed", "conflict").toArray();
}

/** Reintenta ahora una operación fallida/en conflicto. */
export async function requeueOperation(id: string, now: string = isoNow()): Promise<void> {
  const op = await db.syncOutbox.get(id);
  if (!op) return;
  await db.syncOutbox.update(id, {
    state: "pending",
    attempts: 0,
    lastError: null,
    lastErrorType: null,
    retryAt: null,
    updatedAt: now,
  });
}

/**
 * Reconciliación: encola en el outbox los registros marcados como `pending`
 * que aún no tienen operación (compatibilidad con servicios que solo marcan
 * `syncStatus`). Garantiza que ningún cambio pendiente quede sin enviar.
 */
export async function reconcilePendingEntities(now: string = isoNow()): Promise<number> {
  let enqueued = 0;
  for (const entity of SYNC_ENTITY_TABLES) {
    const table = db[entity] as unknown as {
      where(key: string): { equals(v: string): { toArray(): Promise<Array<{ id: string }>> } };
    };
    let rows: Array<{ id: string }> = [];
    try {
      rows = await table.where("syncStatus").equals("pending").toArray();
    } catch {
      continue; // Índice o tabla no disponible.
    }
    for (const row of rows) {
      if (!row.id) continue;
      const existing = await db.syncOutbox.where("[entity+entityId]").equals([entity, row.id]).first();
      if (existing) continue;
      await enqueueOperation({
        entity,
        entityId: row.id,
        op: "upsert",
        payload: row as unknown as Record<string, unknown>,
        now,
      });
      enqueued++;
    }
  }
  if (enqueued > 0) {
    await logSyncEvent({
      level: "info",
      event: "reconciled",
      message: `${enqueued} registros pendientes encolados`,
    }, now);
  }
  return enqueued;
}

export type { SyncErrorType, SyncLogEvent, SyncLogLevel };
