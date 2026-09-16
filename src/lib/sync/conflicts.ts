import type { OutboxOperation } from "../../types/sync.ts";

// Estrategia de resolución de conflictos: LWW (Last-Write-Wins) con revisión.
//
// Reglas:
//   1. El registro con `updatedAt` más reciente gana (LWW). Se comparan como
//      instantes UTC (ISO 8601), nunca como cadenas.
//   2. Empate de `updatedAt` → gana quien tenga `revision` mayor.
//   3. Empate completo → gana el LOCAL (autoridad del dispositivo), pero se
//      registra el conflicto para visibilidad.
//   4. Operaciones registradas (movimientos de inventario) son INMUTABLES:
//      nunca se mezclan ni se sobrescriben. Si el servidor ya tiene el mismo id,
//      se considera aplicado (ack idempotente) y el local conserva su versión.
//
// Flujo:
//   - En PUSH: el cliente envía su `revision`. Si el servidor tiene una revisión
//     mayor, el guardado condicional falla → conflicto (estado `conflict`).
//   - En PULL: si el registro local está `pending`, hay divergencia real:
//     se resuelve con LWW; el perdedor se conserva en `syncLog` y el registro
//     afectado se marca `conflict` para que el usuario lo vea.

export interface VersionInfo {
  updatedAt: string;
  revision: number;
}

export interface VersionedRow {
  updatedAt?: string | null;
  revision?: number;
}

export type ConflictResolution =
  | "keep_local"
  | "keep_remote"
  | "tie_local"
  | "no_conflict";

export interface ConflictResult {
  resolution: ConflictResolution;
  winner: VersionedRow;
}

function ts(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function compareVersions(local: VersionInfo, remote: VersionInfo): ConflictResolution {
  const l = ts(local.updatedAt);
  const r = ts(remote.updatedAt);
  if (l > r) return "keep_local";
  if (r > l) return "keep_remote";
  // Empate de timestamp → revisión mayor gana.
  if (local.revision > remote.revision) return "keep_local";
  if (remote.revision > local.revision) return "keep_remote";
  return "tie_local";
}

export function resolveConflict(
  local: VersionedRow,
  remote: VersionedRow,
  localPending: boolean,
): ConflictResult {
  if (!localPending) {
    // El local ya está sincronizado: si el remoto es más nuevo o igual, se copia.
    if (!local.updatedAt) {
      return { resolution: "keep_remote", winner: remote };
    }
    const cmp = compareVersions(
      { updatedAt: local.updatedAt!, revision: local.revision ?? 1 },
      { updatedAt: remote.updatedAt!, revision: remote.revision ?? 1 },
    );
    if (cmp === "keep_local") return { resolution: "no_conflict", winner: local };
    return { resolution: "keep_remote", winner: remote };
  }

  // Local pendiente de enviar + existe versión remota: conflicto real.
  const cmp = compareVersions(
    { updatedAt: local.updatedAt!, revision: local.revision ?? 1 },
    { updatedAt: remote.updatedAt!, revision: remote.revision ?? 1 },
  );
  if (cmp === "keep_local" || cmp === "tie_local") {
    return { resolution: cmp, winner: local };
  }
  return { resolution: "keep_remote", winner: remote };
}

/**
 * Movimientos de inventario: operaciones registradas (append-only).
 * Nunca se sobrescriben ni se mezclan. Si el servidor ya tiene el id, el push
 * fue idempotente y el movimiento local se considera aplicado tal cual.
 */
export function isAppendOnly(entity: string): boolean {
  return entity === "inventoryMovements" || entity === "productionMaterials" || entity === "partCompatibilities";
}

export function isRegisteredOperation(entity: string): boolean {
  return [
    "sales",
    "saleDetails",
    "purchases",
    "purchaseDetails",
    "expenses",
    "expenseDetails",
    "investments",
    "inventoryMovements",
    "productionOrders",
    "productionMaterials",
    "crops",
    "farmLots",
    "applications",
    "labors",
    "harvests",
    "autoParts",
    "partCompatibilities",
    "breedingLots",
    "animals",
    "feedings",
    "reproductions",
    "livestockProductions",
  ].includes(entity);
}

/**
 * Detecta un conflicto de push: el servidor tiene una revisión más nueva que la
 * que el cliente intenta escribir (una operación registrada que se modificó en
 * otro dispositivo). También devuelve `true` si la operación es append-only y
 * el servidor respondió con el guard de inmutabilidad.
 */
export function isPushConflict(op: OutboxOperation, errorInfo: { type: string } | null): boolean {
  if (errorInfo && (errorInfo.type === "conflict" || errorInfo.type === "validation")) {
    const msg = String(errorInfo.type);
    if (isAppendOnly(op.entity)) return msg === "conflict";
    return msg === "conflict";
  }
  return false;
}
