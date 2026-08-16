import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';
import { getDb } from '../db/database';
import { apiClient, type ChangePayload } from './apiClient';
import { nowIso } from '../utils/id';
import type { EntityType } from '../domain/types';
import { logger } from '../logging';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

const syncLogger = logger.child('sync');

interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  pendingCount: number;
  lastError: string | null;
  setStatus: (status: SyncStatus) => void;
  runSync: () => Promise<void>;
  refreshPending: () => Promise<void>;
}

const TABLE_MAP: Record<string, string> = {
  category: 'categories',
  product: 'products',
  purchase: 'purchases',
  purchase_item: 'purchase_items',
  expense: 'expenses',
  expense_detail: 'expense_details',
  expense_type: 'expense_types',
  investment: 'investments',
  stock_movement: 'stock_movements',
  client: 'clients',
  sale: 'sales',
  sale_item: 'sale_items',
};

const CHILD_MAP: Record<string, { table: string; fk: string; childType: string }> = {
  purchase: { table: 'purchase_items', fk: 'purchase_id', childType: 'purchase_item' },
  sale: { table: 'sale_items', fk: 'sale_id', childType: 'sale_item' },
  expense: { table: 'expense_details', fk: 'expense_id', childType: 'expense_detail' },
};

const SYNC_STATUS_TABLES: Record<string, boolean> = {
  categories: true,
  products: true,
  purchases: true,
  expenses: true,
  expense_types: true,
  investments: true,
  stock_movements: true,
  clients: true,
  sales: true,
};

async function upsertRow(db: SQLiteDatabase, table: string, cols: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(cols);
  if (keys.length === 0) return;
  const placeholders = keys.map(() => '?').join(', ');
  const sets = keys.map((k) => `${k} = excluded.${k}`).join(', ');
  const values = keys.map((k) => cols[k] as string | number | null);
  await db.runAsync(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${sets}`,
    ...values
  );
}

async function insertChildRow(db: SQLiteDatabase, table: string, cols: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(cols);
  if (keys.length === 0) return;
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map((k) => cols[k] as string | number | null);
  await db.runAsync(
    `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
    ...values
  );
}

async function applyChange(db: SQLiteDatabase, change: ChangePayload): Promise<void> {
  const table = TABLE_MAP[change.entity_type];
  if (!table) return;

  if (change.operation === 'DELETE') {
    const child = CHILD_MAP[change.entity_type];
    if (child) {
      await db.runAsync(`DELETE FROM ${child.table} WHERE ${child.fk} = ?`, change.entity_id);
    }
    await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, change.entity_id);
    return;
  }

  const { items, ...cols } = change.payload;

  if (SYNC_STATUS_TABLES[table]) {
    const existing = await db.getFirstAsync<{ sync_status: string }>(
      `SELECT sync_status FROM ${table} WHERE id = ?`,
      change.entity_id
    );
    if (existing?.sync_status === 'pending') return;
    cols['sync_status'] = 'synced';
  }

  await upsertRow(db, table, cols);

  const child = CHILD_MAP[change.entity_type];
  if (child && Array.isArray(items)) {
    await db.runAsync(`DELETE FROM ${child.table} WHERE ${child.fk} = ?`, change.entity_id);
    for (const item of items as Record<string, unknown>[]) {
      await insertChildRow(db, child.table, item);
    }
  }
}

function cursorKey(entityType: string): string {
  return `last_pull:${entityType}`;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  lastSyncAt: null,
  pendingCount: 0,
  lastError: null,

  setStatus: (status) => set({ status }),

  refreshPending: async () => {
    const db = await getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM outbox WHERE status = 'pending'`
    );
    set({ pendingCount: row?.count ?? 0 });
  },

  runSync: async () => {
    const { status } = get();
    if (status === 'syncing') return;
    set({ status: 'syncing', lastError: null });
    syncLogger.info('Iniciando sincronización');

    const db = await getDb();
    try {
      const pending = await db.getAllAsync<{
        id: number;
        entity_type: string;
        entity_id: string;
        operation: string;
        payload: string;
      }>(`SELECT id, entity_type, entity_id, operation, payload FROM outbox WHERE status = 'pending' ORDER BY id`);

      if (pending.length > 0) {
        syncLogger.info(`Push de ${pending.length} cambios pendientes`);
        const result = await apiClient.push(pending);
        const applied = result.applied_ids ?? [];
        if (applied.length > 0) {
          for (const entry of pending) {
            if (applied.includes(entry.id)) {
              const table = TABLE_MAP[entry.entity_type];
              if (table) {
                await db.runAsync(
                  `UPDATE ${table} SET sync_status = 'synced' WHERE id = ?`,
                  entry.entity_id
                );
              }
            }
          }
          const placeholders = applied.map(() => '?').join(', ');
          await db.runAsync(
            `DELETE FROM outbox WHERE id IN (${placeholders})`,
            ...applied
          );
        }
      }

      const types = Object.keys(TABLE_MAP);
      const cursors: Record<string, string> = {};
      for (const t of types) {
        const row = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM sync_state WHERE key = ?',
          cursorKey(t)
        );
        if (row) cursors[t] = row.value;
      }

      const pull = await apiClient.pull(cursors);
      await db.withExclusiveTransactionAsync(async (txn) => {
        const t = txn as unknown as SQLiteDatabase;
        for (const change of pull.changes) {
          if (CHILD_MAP[change.entity_type]) continue;
          await applyChange(t, change);
        }
        for (const change of pull.changes) {
          if (!CHILD_MAP[change.entity_type]) continue;
          await applyChange(t, change);
        }
      });

      for (const t of types) {
        await db.runAsync(
          `INSERT INTO sync_state (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          cursorKey(t),
          pull.server_time
        );
      }

      const remaining = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM outbox WHERE status = 'pending'`
      );
      set({
        status: 'synced',
        pendingCount: remaining?.count ?? 0,
        lastSyncAt: nowIso(),
      });
      syncLogger.info('Sincronización completada', {
        pendingCount: remaining?.count ?? 0,
      });
    } catch (error) {
      syncLogger.error('Error de sincronización', error);
      set({
        status: 'error',
        lastError: error instanceof Error ? error.message : String(error),
      });
      await get().refreshPending();
    }
  },
}));

export async function markSyncOffline(): Promise<void> {
  useSyncStore.setState({ status: 'offline' });
}
