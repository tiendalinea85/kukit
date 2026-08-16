import type { SyncErrorInfo, SyncTransportEntity } from "../../types/sync.ts";
import {
  claimNextBatch,
  completeOperation,
  failOperation,
  isoNow,
  logSyncEvent,
  markConflict,
} from "./outbox.ts";
import { isPermanentError } from "./errors.ts";

// PUSH: drena el outbox hacia el servidor.
//
// - Procesa en lotes (las operaciones salen en orden de encolado).
// - Cada operación es idempotente por diseño (upsert por id, insert-on-conflict,
//   guardado condicional por revisión), por lo que los reintentos nunca duplican.
// - Errores transitorios (red/tiempo/servidor) → `failed` con backoff.
// - Errores permanentes de validación → `failed` sin reintento programado.
// - Conflictos de versión → estado `conflict` (requiere visibilidad en la UI).

export interface PushRunOptions {
  batchSize?: number;
  now?: string;
}

export interface PushRunResult {
  pushed: number;
  failed: number;
  conflicted: number;
}

export async function runPush(
  transport: SyncTransportEntity[],
  opts: PushRunOptions = {},
): Promise<PushRunResult> {
  const batchSize = opts.batchSize ?? 25;
  const now = opts.now ?? isoNow();
  const result: PushRunResult = { pushed: 0, failed: 0, conflicted: 0 };
  const byName = new Map(transport.map((t) => [t.name, t]));

  await logSyncEvent({ level: "info", event: "sync_started", message: "Inicio de push" }, now);

  while (true) {
    const ops = await claimNextBatch(batchSize, now);
    if (!ops.length) break;

    for (const op of ops) {
      const entity = byName.get(op.entity);

      // Entidad sin transporte (o ya no existe): se descarta como aplicada.
      if (!entity) {
        await completeOperation(op, now);
        continue;
      }

      let error: SyncErrorInfo | null;
      try {
        error = await entity.push(op);
      } catch (err) {
        error = classifyTransportError(err);
      }

      if (!error) {
        const applied = await completeOperation(op, now);
        if (applied) {
          result.pushed++;
          await logSyncEvent({
            level: "info",
            event: "push_ok",
            entity: op.entity,
            entityId: op.entityId,
          }, now);
        }
        continue;
      }

      if (error.type === "conflict") {
        await markConflict(op, error, now);
        result.conflicted++;
      } else if (isPermanentError(error.type)) {
        await failOperation(op, { error, now });
        result.failed++;
      } else {
        await failOperation(op, { error, now });
        result.failed++;
      }
    }
  }

  return result;
}

function classifyTransportError(err: unknown): SyncErrorInfo {
  if (err && typeof err === "object" && "type" in err) {
    const info = err as SyncErrorInfo;
    if (typeof info.type === "string" && typeof info.retryable === "boolean") {
      return info;
    }
  }
  return {
    type: "unknown",
    message: err instanceof Error ? err.message : "Error desconocido durante el push",
    retryable: true,
  };
}
