import type { SQLiteDatabase } from 'expo-sqlite';
import type { EntityType, OutboxOperation } from '../domain/types';
import { enqueueAudit, enqueueOutbox } from './outbox';
import { nowIso } from '../utils/id';

export type DbLike = Pick<SQLiteDatabase, 'runAsync' | 'getFirstAsync' | 'getAllAsync'>;

export async function upsert(db: DbLike, table: string, row: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(row);
  if (keys.length === 0) return;
  const placeholders = keys.map(() => '?').join(', ');
  const sets = keys.map((k) => `${k} = excluded.${k}`).join(', ');
  await db.runAsync(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${sets}`,
    ...keys.map((k) => row[k] as string | number | null)
  );
}

export interface WriteArgs {
  table: string;
  entityType: EntityType;
  operation: OutboxOperation;
  row: Record<string, unknown>;
  before?: unknown;
  includeChildren?: (db: DbLike) => Promise<void>;
}

export async function writeTx(txn: DbLike, args: WriteArgs): Promise<void> {
  const { items, ...cols } = args.row;
  await upsert(txn, args.table, { ...cols, sync_status: 'pending' });
  if (args.includeChildren) {
    await args.includeChildren(txn);
  }
  await enqueueOutbox(txn, {
    entity_type: args.entityType,
    entity_id: args.row.id as string,
    operation: args.operation,
    payload: args.row,
  });
  await enqueueAudit(txn, {
    action: args.operation.toLowerCase(),
    entity_type: args.entityType,
    entity_id: args.row.id as string,
    before: args.before,
    after: args.row,
  });
}

export async function writeWithOutbox(db: SQLiteDatabase, args: WriteArgs): Promise<void> {
  await db.withExclusiveTransactionAsync((txn) => writeTx(txn as unknown as DbLike, args));
}

export async function softDelete(db: SQLiteDatabase, table: string, entityType: EntityType, id: string): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE id = ?`,
      id
    );
    if (!existing) return;
    await txn.runAsync(`UPDATE ${table} SET deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?`, nowIso(), id);
    await enqueueOutbox(txn, {
      entity_type: entityType,
      entity_id: id,
      operation: 'UPDATE',
      payload: { id, deleted: 1 },
    });
    await enqueueAudit(txn, {
      action: 'delete',
      entity_type: entityType,
      entity_id: id,
      before: existing,
    });
  });
}

export async function nextCodeFor(db: DbLike, table: string, prefix: string): Promise<string> {
  const rows = await db.getAllAsync<{ code: string }>(
    `SELECT code FROM ${table} WHERE deleted = 0 ORDER BY created_at DESC LIMIT 1`
  );
  const last = rows[0]?.code ?? '';
  const match = last.match(/(\d+)$/);
  const seq = match ? parseInt(match[1], 10) : 0;
  return `${prefix}-${String(seq + 1).padStart(4, '0')}`;
}
