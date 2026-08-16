import { db } from "../db.ts";
import { isoNow } from "./outbox.ts";

// Metadatos de sincronización: watermarks de pull incremental y marca de la
// última sincronización. Guardados en la tabla `syncState` (key-value).

function keyOf(kind: "watermark", entity: string): string {
  return `${kind}:${entity}`;
}

export async function getWatermark(entity: string): Promise<string | null> {
  const rec = await db.syncState.get(keyOf("watermark", entity));
  return rec ? (rec.value || null) : null;
}

export async function setWatermark(entity: string, value: string, now: string = isoNow()): Promise<void> {
  if (!value) return;
  await db.syncState.put({
    key: keyOf("watermark", entity),
    value,
    updatedAt: now,
  });
}

export async function getLastSyncAt(): Promise<string | null> {
  const rec = await db.syncState.get("lastSyncAt");
  return rec ? (rec.value || null) : null;
}

export async function setLastSyncAt(now: string = isoNow()): Promise<void> {
  await db.syncState.put({ key: "lastSyncAt", value: now, updatedAt: now });
}

export async function clearSyncState(): Promise<void> {
  await db.syncState.clear();
}
