import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { nowIso, newId } from '../utils/id';
import { getActiveWorkspaceId } from '../workspace/activeWorkspace';
import { createMigrationSet, migrate } from './migrations';
import type { MigrationDb } from './migrations';

const DATABASE_NAME = 'cato-ledger.db';

const MIGRATIONS = createMigrationSet({ nowIso, newId });

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await migrate(db as unknown as MigrationDb, MIGRATIONS);
  return db;
}

export async function seedDefaults(): Promise<void> {
  const db = await getDb();
  const workspaceId = (await getActiveWorkspaceId(db)) ?? '';
  const now = nowIso();

  const cats = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if ((cats?.count ?? 0) === 0) {
    const defaults = [
      { name: 'General', color: '#8b5cf6', icon: '📦' },
      { name: 'Insumos', color: '#22c55e', icon: '🧱' },
      { name: 'Equipos', color: '#3b82f6', icon: '🖥️' },
      { name: 'Servicios', color: '#f59e0b', icon: '🧾' },
    ];
    for (const d of defaults) {
      await db.runAsync(
        `INSERT INTO categories (id, name, color, icon, created_at, updated_at, workspace_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        d.name,
        d.color,
        d.icon,
        now,
        now,
        workspaceId
      );
    }
  }

  const types = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM expense_types'
  );
  if ((types?.count ?? 0) === 0) {
    for (const name of ['Operativo', 'Logística', 'Personal', 'Otros']) {
      await db.runAsync(
        `INSERT INTO expense_types (id, name, created_at, updated_at, workspace_id)
         VALUES (?, ?, ?, ?, ?)`,
        newId(),
        name,
        now,
        now,
        workspaceId
      );
    }
  }
}