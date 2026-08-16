import { getDb } from '../../core/db/database';
import type { AuditEntry } from '../../core/domain/types';

export async function listAudit(limit: number = 100): Promise<AuditEntry[]> {
  const db = await getDb();
  return db.getAllAsync<AuditEntry>(
    `SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?`,
    limit
  );
}

export async function clearAudit(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM audit_log');
}
