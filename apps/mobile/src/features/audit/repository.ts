import { getDb } from '../../core/db/database';
import type { AuditEntry } from '../../core/domain/types';
import { requireActiveWorkspaceId } from '../../core/workspace/isolation';

export async function listAudit(limit: number = 100): Promise<AuditEntry[]> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  return db.getAllAsync<AuditEntry>(
    `SELECT * FROM audit_log WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
    wsId, limit
  );
}

export async function clearAudit(): Promise<void> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  await db.runAsync('DELETE FROM audit_log WHERE workspace_id = ?', wsId);
}
