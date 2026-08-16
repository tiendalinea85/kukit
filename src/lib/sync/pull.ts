import { db } from "../db.ts";
import type { SyncErrorInfo, SyncTransportEntity } from "../../types/sync.ts";
import { isAppendOnly, resolveConflict } from "./conflicts.ts";
import { isoNow, logSyncEvent, markOutboxConflictByEntity } from "./outbox.ts";
import { getWatermark, setWatermark } from "./state.ts";

// PULL: sincronización incremental servidor → cliente.
//
// - Cada tabla usa un watermark (cursor) basado en su columna ordenable
//   (`updated_at` o `created_at`) guardado localmente → solo trae lo nuevo.
// - Merge por LWW (Last-Write-Wins) + revisión:
//     * Local ya sincronizado → se sobreescribe si el remoto es más nuevo.
//     * Local con cambios pendientes (divergencia real) → se CONSERVA el
//       local y el registro pasa a `conflict`; nunca se descarta una operación
//       local sin enviar.
// - Movimientos de inventario (append-only): si el id ya existe localmente,
//   se considera aplicado; nunca se mezclan ni sobrescriben.
// - Los errores por tabla se aíslan: una tabla que falla no detiene el resto.

export interface PullRunResult {
  pulled: number;
  updated: number;
  conflicts: number;
  errors: number;
}

function pendingLike(status: string | undefined): boolean {
  return status === "pending" || status === "syncing" || status === "failed" || status === "conflict";
}

async function tableOf(entity: string): Promise<
  { get(id: string): Promise<unknown>; put(row: unknown): Promise<unknown>; update(id: string, changes: Record<string, unknown>): Promise<number> } | null
> {
  const table = (db as unknown as Record<string, unknown>)[entity] as
    | { get(id: string): Promise<unknown>; put(row: unknown): Promise<unknown>; update(id: string, changes: Record<string, unknown>): Promise<number> }
    | undefined;
  return table ?? null;
}

export async function runPull(
  transport: SyncTransportEntity[],
  opts: { now?: string } = {},
): Promise<PullRunResult> {
  const now = opts.now ?? isoNow();
  const result: PullRunResult = { pulled: 0, updated: 0, conflicts: 0, errors: 0 };
  const ordered = [...transport].sort((a, b) => a.order - b.order);

  for (const entity of ordered) {
    try {
      const since = await getWatermark(entity.name);
      const { rows, watermark } = await entity.pull(since ?? "");
      const table = await tableOf(entity.name);

      for (const row of rows) {
        const id = (row as { id?: string }).id;
        if (!id || !table) continue;

        const local = (await table.get(id)) as
          | (Record<string, unknown> & { syncStatus?: string; updatedAt?: string; revision?: number })
          | undefined;

        // Movimientos de inventario: operaciones registradas (append-only).
        // Nunca se sobrescriben; si el id ya existe, la versión local prevalece.
        if (isAppendOnly(entity.name)) {
          if (!local) {
            await table.put(row);
            result.pulled++;
          }
          continue;
        }

        if (!local) {
          await table.put(row);
          result.pulled++;
          continue;
        }

        const localPending = pendingLike(local.syncStatus);
        const remoteTs = new Date((row as { updatedAt?: string }).updatedAt ?? 0).getTime();
        const localTs = new Date(local.updatedAt ?? 0).getTime();
        const remoteNewer =
          remoteTs > localTs ||
          (remoteTs === localTs &&
            Number((row as { revision?: number }).revision ?? 1) > Number(local.revision ?? 1));

        if (localPending) {
          if (remoteNewer) {
            // Divergencia real: el remoto es más nuevo y el local aún no se
            // envió. Se conserva el local y se marca `conflict`.
            await table.update(id, { syncStatus: "conflict" });
            await markOutboxConflictByEntity(
              entity.name,
              id,
              "El registro cambió en otro dispositivo (LWW: versión remota más nueva)",
              now,
            );
            result.conflicts++;
          }
          // Si el local es más nuevo o hay empate → gana el local (sigue pending).
        } else {
          const res = resolveConflict(local, row as { updatedAt?: string; revision?: number }, false);
          if (res.resolution === "keep_remote") {
            await table.put({ ...row, syncStatus: "synced" });
            result.updated++;
          }
        }
      }

      if (watermark) await setWatermark(entity.name, watermark, now);
      await logSyncEvent({
        level: "info",
        event: "pull_ok",
        entity: entity.name,
        message: `${rows.length} filas (watermark ${watermark ?? "sin cambios"})`,
      }, now);
    } catch (err) {
      result.errors++;
      const info = err as SyncErrorInfo;
      await logSyncEvent({
        level: "error",
        event: "pull_failed",
        entity: entity.name,
        message: info?.message ?? (err instanceof Error ? err.message : "Error de pull"),
        errorType: info?.type ?? "unknown",
      }, now);
    }
  }

  return result;
}
