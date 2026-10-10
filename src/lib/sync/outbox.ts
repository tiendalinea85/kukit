import { newId } from "@/utils/id";
import type { Table } from "dexie";
import { db } from "../db.ts";
import type {
  OutboxOperation,
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
  "expenseDetails",
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
  "customIcons",
] as const;

export type SyncEntity = (typeof SYNC_ENTITY_TABLES)[number];

function entityTable(entity: string): Table<Record<string, unknown>, string> | null {
  if (!(SYNC_ENTITY_TABLES as readonly string[]).includes(entity)) return null;
  return db[entity as SyncEntity] as unknown as Table<Record<string, unknown>, string>;
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
  return newId();
}

export function isoNow(): string {
  return new Date().toISOString();
}

// Poda del log de sincronización. Evidencia de crecimiento: `syncLog` solo se
// escribe (cada ciclo añade `sync_started`, un `push_ok` por operación, eventos
// de pull y de reconciliación) con auto-sincronización cada 60 s, y hoy nadie
// lo lee en la app; sin límite acumula ~1.400 filas/día. Se conservan como
// mucho SYNC_LOG_MAX_ENTRIES entradas y las emitidas en los últimos
// SYNC_LOG_MAX_AGE_MS.
export const SYNC_LOG_MAX_ENTRIES = 1_000;
export const SYNC_LOG_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// La poda se ejecuta de forma amortiguada: un `count()` por cada 25 escritos en
// vez de uno por cada evento, para no penalizar el push.
const TRIM_EVERY_N_WRITES = 25;
let writesSinceTrim = 0;

export async function logSyncEvent(
  entry: Omit<SyncLogEntry, "id" | "ts">,
  now: string = isoNow(),
): Promise<void> {
  await db.syncLog.add({ id: uuid(), ts: now, ...entry });
  if (++writesSinceTrim < TRIM_EVERY_N_WRITES) return;
  writesSinceTrim = 0;
  try {
    await trimSyncLog(now);
  } catch {
    // La poda es mantenimiento: jamás debe romper la sincronización (se
    // reintentará en los próximos escritos).
  }
}

/** Elimina entradas vencidas y las que superen el tope, dejando las más nuevas. */
export async function trimSyncLog(now: string = isoNow()): Promise<number> {
  let removed = 0;

  const cutoff = new Date(new Date(now).getTime() - SYNC_LOG_MAX_AGE_MS).toISOString();
  const expired = await db.syncLog.where("ts").below(cutoff).primaryKeys();
  if (expired.length) {
    await db.syncLog.bulkDelete(expired);
    removed += expired.length;
  }

  const total = await db.syncLog.count();
  if (total > SYNC_LOG_MAX_ENTRIES) {
    const excess = total - SYNC_LOG_MAX_ENTRIES;
    const oldest = await db.syncLog.orderBy("ts").limit(excess).primaryKeys();
    if (oldest.length) {
      await db.syncLog.bulkDelete(oldest);
      removed += oldest.length;
    }
  }

  return removed;
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
  // Lectura + escritura en la MISMA transacción: dos encolados simultáneos de
  // una misma entidad deben ver la fila del otro. Separados en dos pasos,
  // ambos leerían "no existe" y se crearían DOS operaciones para un mismo
  // cambio (una quedaría huérfana y el push la reenviaría sin motivo).
  return db.transaction("rw", db.syncOutbox, async () => {
    const existing = await db.syncOutbox.where("[entity+entityId]").equals([input.entity, input.entityId]).first();

    if (existing) {
      const updated: Partial<OutboxOperation> = {
        op: input.op,
        payload: input.payload,
        payloadHash: hashPayload(input.payload),
        // El payload cambió: la huella de la fila reclamada ya no describe lo que
        // se envía, así que se descarta (la vuelve a tomar el próximo claim).
        claimedRowHash: null,
        updatedAt: now,
      };
      // No se pisa un workspace conocido con vacío: un llamador que no lo trae
      // (p. ej. la reconciliación antigua) no debe borrar el que ya había.
      const wsId = input.workspaceId ?? existing.workspaceId;
      if (wsId) updated.workspaceId = wsId;
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
      workspaceId: input.workspaceId ?? "",
      op: input.op,
      payload: input.payload,
      payloadHash: hashPayload(input.payload),
      claimedRowHash: null,
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
  });
}

/**
 * Reclama el siguiente lote de operaciones listas (estado pending y retryAt
 * vencido o nulo), marcándolas `syncing` en una transacción para evitar
 * reclamaciones concurrentes.
 */
const SYNC_PUSH_RANK: Record<string, number> = {
  customIcons: 0,
  categories: 1,
  types: 2,
  investmentCategories: 3,
  customers: 4,
  products: 5,
  garmentColors: 6,
  sizes: 7,
  vehicleBrands: 8,
  vehicleModels: 9,
  species: 10,
  materials: 11,
  agroInputs: 12,
  garments: 13,
  crops: 14,
  farmLots: 15,
  breedingLots: 16,
  animals: 17,
  expenses: 20,
  expenseDetails: 20.5,
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
  // El alcance incluye todas las tablas de entidad: dentro de LA MISMA
  // transacción se lee la huella (hash) de la fila reclamada. Esa huella es la
  // base del compare-and-set de `completeOperation`; leerla fuera del claim
  // dejaría una ventana en la que una edición no se detectaría.
  const tx = db.transaction(
    "rw",
    [db.syncOutbox, ...SYNC_ENTITY_TABLES.map((entity) => db[entity])],
    async () => {
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
      const claimed: OutboxOperation[] = [];
      for (const op of selected) {
        const table = entityTable(op.entity);
        const row = table
          ? ((await table.get(op.entityId)) as Record<string, unknown> | undefined)
          : undefined;
        const claimedRowHash = row ? hashPayload(row) : null;
        await db.syncOutbox.update(op.id, {
          state: "syncing",
          lastAttemptAt: now,
          claimedRowHash,
        });
        claimed.push({ ...op, state: "syncing", lastAttemptAt: now, claimedRowHash });
      }
      return claimed;
    },
  );
  return tx;
}

/**
 * Completado idempotente (compare-and-set): marca la operación y el registro
 * como `synced` SOLO si nada cambió desde el reclamo. En caso contrario se
 * refresca el payload desde la fila actual y vuelve a `pending`:
 *
 *   - el payload del outbox cambió (hubo un `enqueueOperation` en vuelo) →
 *     hash distinto;
 *   - la fila local cambió sin pasar por `enqueueOperation` (los servicios solo
 *     marcan `syncStatus`) → `claimedRowHash` distinto del hash actual.
 *
 * Devuelve `true` solo cuando el push quedó reflejado en el registro.
 */
export async function completeOperation(
  op: OutboxOperation,
  now: string = isoNow(),
): Promise<boolean> {
  const table = entityTable(op.entity);
  const scope: Array<Table<OutboxOperation, string> | Table<Record<string, unknown>, string>> = table
    ? [db.syncOutbox, table]
    : [db.syncOutbox];
  const tx = db.transaction("rw", scope, async (): Promise<boolean> => {
    const current = await db.syncOutbox.get(op.id);
    if (!current) return true;

    const requeue = async (payload: Record<string, unknown>): Promise<false> => {
      await db.syncOutbox.update(op.id, {
        payload,
        payloadHash: hashPayload(payload),
        state: "pending",
        attempts: 0,
        lastError: null,
        lastErrorType: null,
        retryAt: null,
        claimedRowHash: null,
        updatedAt: now,
      });
      return false;
    };

    if (current.payloadHash !== op.payloadHash) return await requeue(current.payload);

    if (table && op.claimedRowHash) {
      const row = (await table.get(op.entityId)) as Record<string, unknown> | undefined;
      if (row && hashPayload(row) !== op.claimedRowHash) return await requeue(row);
    }

    await db.syncOutbox.update(op.id, {
      state: "synced",
      updatedAt: now,
      lastError: null,
      lastErrorType: null,
      claimedRowHash: null,
    });
    if (table) await table.update(op.entityId, { syncStatus: "synced" });
    return true;
  });
  return tx;
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
 * Dependencias por clave foránea: antes de empujar un registro, su referencia
 * debe existir en el servidor, o el FK devolvería 23503 reintentable sin fin
 * (p. ej. un gasto cuya categoría por defecto quedó en `local` y nunca se
 * encoló). El orden de push ya pone las maestras delante; aquí solo se asegura
 * que la referencia local esté encolada.
 */
const DEPENDENCIES: Partial<Record<SyncEntity, Array<{ entity: SyncEntity; field: string }>>> = {
  expenses: [{ entity: "categories", field: "categoryId" }],
  expenseDetails: [{ entity: "products", field: "productId" }],
  saleDetails: [{ entity: "products", field: "productId" }],
  purchaseDetails: [{ entity: "products", field: "productId" }],
  investments: [{ entity: "investmentCategories", field: "categoryId" }],
};

async function enqueueDependencies(
  entity: string,
  row: Record<string, unknown>,
  now: string,
): Promise<void> {
  const deps = DEPENDENCIES[entity as SyncEntity];
  if (!deps) return;
  for (const dep of deps) {
    const depId = row[dep.field];
    if (typeof depId !== "string" || !depId) continue;
    const depTable = db[dep.entity] as unknown as
      | { get(id: string): Promise<Record<string, unknown> | undefined> }
      | undefined;
    if (!depTable) continue;
    const depRow = await depTable.get(depId);
    if (!depRow || depRow.deleted) continue;
    if (depRow.syncStatus === "synced") continue;
    const existing = await db.syncOutbox
      .where("[entity+entityId]")
      .equals([dep.entity, depId])
      .first();
    if (existing && existing.state !== "synced" && existing.payloadHash === hashPayload(depRow)) {
      continue;
    }
    await enqueueOperation({
      entity: dep.entity,
      entityId: depId,
      workspaceId: typeof depRow.workspaceId === "string" ? depRow.workspaceId : undefined,
      op: "upsert",
      payload: depRow,
      now,
    });
  }
}

/**
 * Reconciliación: encola en el outbox los registros marcados como `pending`
 * que aún no tienen operación (compatibilidad con servicios que solo marcan
 * `syncStatus`). Garantiza que ningún cambio pendiente quede sin enviar.
 *
 * Si YA existe una operación solo se salta cuando sigue viva y su payload
 * describe exactamente la fila actual. En cualquier otro caso se refresca el
 * payload desde la fila ACTUAL: una operación `synced` con la fila otra vez
 * `pending`, o una operación vieja con la fila ya editada, dejarían en el
 * servidor una versión antigua (o la marcarían `synced` sin haberse enviado).
 * Al refrescar se conserva el estado de la operación: no se resetea el backoff
 * de un `failed` ni se reabre un `conflict` (eso requiere decisión del usuario).
 *
 * El retorno cuenta solo operaciones nuevas; los refrescos se informan en el
 * log (`reconciled`) para no confundirlos con duplicados.
 */
export async function reconcilePendingEntities(now: string = isoNow()): Promise<number> {
  let enqueued = 0;
  let refreshed = 0;
  for (const entity of SYNC_ENTITY_TABLES) {
    const table = db[entity] as unknown as {
      where(key: string): { equals(v: string): { toArray(): Promise<Array<Record<string, unknown>>> } };
    };
    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = await table.where("syncStatus").equals("pending").toArray();
    } catch {
      continue; // Índice o tabla no disponible.
    }
    for (const row of rows) {
      const entityId = typeof row.id === "string" ? row.id : "";
      if (!entityId) continue;
      const workspaceId = typeof row.workspaceId === "string" ? row.workspaceId : undefined;
      // Las referencias deben estar encoladas aunque el propio registro ya lo esté.
      await enqueueDependencies(entity, row, now);
      const existing = await db.syncOutbox.where("[entity+entityId]").equals([entity, entityId]).first();

      if (existing) {
        if (existing.state !== "synced" && existing.payloadHash === hashPayload(row)) continue;
        if (existing.state === "synced") {
          // La fila volvió a `pending` tras haberse enviado: hace falta una
          // operación nueva (se conserva el tipo de la anterior).
          await enqueueOperation({ entity, entityId, workspaceId, op: existing.op, payload: row, now });
        } else {
          // Solo se actualiza el contenido: el estado (pending/failed/conflict)
          // y el backoff se conservan para no reintentar antes de tiempo ni
          // reabrir conflictos que requieren decisión del usuario.
          await db.syncOutbox.update(existing.id, {
            payload: row,
            payloadHash: hashPayload(row),
            claimedRowHash: null,
            updatedAt: now,
          });
        }
        refreshed++;
        continue;
      }

      await enqueueOperation({ entity, entityId, workspaceId, op: "upsert", payload: row, now });
      enqueued++;
    }
  }
  if (enqueued > 0 || refreshed > 0) {
    await logSyncEvent({
      level: "info",
      event: "reconciled",
      message:
        `${enqueued} registros pendientes encolados` +
        (refreshed ? ` · ${refreshed} payloads refrescados desde la fila actual` : ""),
    }, now);
  }
  return enqueued;
}

export type { SyncErrorType, SyncLogEvent, SyncLogLevel };
