import type { DbLike } from '../db/repo';

export const ACTIVE_WORKSPACE_KEY = 'active_workspace_id';

export async function getActiveWorkspaceId(db: DbLike): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ACTIVE_WORKSPACE_KEY
  );
  return row?.value ?? null;
}

export async function setActiveWorkspaceId(db: DbLike, workspaceId: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ACTIVE_WORKSPACE_KEY,
    workspaceId
  );
}
