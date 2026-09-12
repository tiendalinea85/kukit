import type { SQLiteDatabase } from 'expo-sqlite';
import type { EntityType, OutboxOperation } from '../domain/types';
import { nowIso } from '../utils/id';
import { getActiveWorkspaceId } from '../workspace/activeWorkspace';

type SqlExecutor = Pick<SQLiteDatabase, 'runAsync'>;

export interface OutboxPayload {
  entity_type: EntityType;
  entity_id: string;
  operation: OutboxOperation;
  payload: Record<string, unknown>;
}

export async function enqueueOutbox(db: SqlExecutor, entry: OutboxPayload): Promise<void> {
  const json = JSON.stringify(entry.payload);
  let workspaceId = '';
  try {
    const wsRow = await (db as { getFirstAsync?: (q: string, ...args: unknown[]) => Promise<{ value: string } | null> }).getFirstAsync?.(
      "SELECT value FROM settings WHERE key = 'active_workspace_id'"
    );
    workspaceId = wsRow?.value ?? '';
  } catch { /* */ }
  await db.runAsync(
    `DELETE FROM outbox
     WHERE status = 'pending' AND entity_type = ? AND entity_id = ?`,
    entry.entity_type,
    entry.entity_id
  );
  await db.runAsync(
    `INSERT INTO outbox (entity_type, entity_id, operation, payload, workspace_id, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    entry.entity_type,
    entry.entity_id,
    entry.operation,
    json,
    workspaceId,
    nowIso()
  );
}

export async function enqueueAudit(
  db: SqlExecutor,
  entry: { action: string; entity_type: EntityType; entity_id: string; before?: unknown; after?: unknown }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO audit_log (action, entity_type, entity_id, before, after, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    entry.action,
    entry.entity_type,
    entry.entity_id,
    entry.before !== undefined ? JSON.stringify(entry.before) : null,
    entry.after !== undefined ? JSON.stringify(entry.after) : null,
    nowIso()
  );
}
