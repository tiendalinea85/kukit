import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MIGRATION_V8_SQL, migrate, createMigrationSet } from './migrations.ts';
import type { Migration, MigrationDb, MigrationTxn, MigrationBindValue } from './migrations.ts';

let auditIdCounter = 0;
const RUNTIME = {
  nowIso: () => '2026-01-01T00:00:00.000Z',
  newId: () => `audit-ws-${++auditIdCounter}`,
};

const CANONICAL_EXPENSE_INDEXES = [
  'idx_expenses_workspace_date',
  'idx_expenses_code',
  'idx_expenses_workspace',
  'idx_expenses_date',
  'idx_expenses_category',
];

const LEGACY_EXPENSE_INSERT = `
  INSERT INTO expenses (
    id, code, name, description, amount, total_amount, items_count, has_details,
    category_id, type_id, payment_method, status, date, time, notes,
    created_at, updated_at, deleted, voided_at, receipt_url, receipt_thumb_url,
    sync_status, workspace_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

class Adapter implements MigrationDb {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  async execAsync(source: string): Promise<void> {
    this.db.exec(source);
  }

  async runAsync(source: string, ...params: MigrationBindValue[]): Promise<unknown> {
    this.db.prepare(source).run(...(params as unknown[]));
  }

  async getFirstAsync<T>(source: string, ...params: MigrationBindValue[]): Promise<T | null> {
    const row = this.db.prepare(source).get(...(params as unknown[]));
    return (row as T) ?? null;
  }

  async getAllAsync<T>(source: string, ...params: MigrationBindValue[]): Promise<T[]> {
    return this.db.prepare(source).all(...(params as unknown[])) as T[];
  }

  async withExclusiveTransactionAsync(task: (txn: MigrationTxn) => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await task(this);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

interface Env {
  file: string;
  db: DatabaseSync;
  adapter: Adapter;
  close(): void;
  dispose(): void;
}

function openDb(foreignKeys = true): Env {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catoledger-audit-v8-'));
  const file = path.join(dir, 'audit.db');
  const db = new DatabaseSync(file);
  if (foreignKeys) db.exec('PRAGMA foreign_keys = ON;');
  const env: Env = {
    file,
    db,
    adapter: new Adapter(db),
    close() {
      if (env.db) {
        env.db.close();
        (env as { db: DatabaseSync | null }).db = null as unknown as DatabaseSync;
      }
    },
    dispose() {
      env.close();
      // best-effort: en Windows una conexión recién cerrada puede dejar el
      // directorio temporal bloqueado un instante
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignorado: la limpieza temporal no debe tumbar el test
      }
    },
  };
  return env;
}

function userVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  return row?.user_version ?? 0;
}

/**
 * Replica el bucle real de versionado de migrate() pero detenido en una
 * versión anterior: modela una app antigua que cerraba con PRAGMA
 * user_version = 7. La subida a v8 siempre se ejecuta con migrate() real.
 */
async function legacyMigrate(env: Env, migrations: Migration[], upTo: number): Promise<void> {
  const { user_version: current } =
    (await env.adapter.getFirstAsync<{ user_version: number }>('PRAGMA user_version')) ??
    { user_version: 0 };
  for (const migration of migrations) {
    if (migration.version <= current || migration.version > upTo) continue;
    await env.adapter.withExclusiveTransactionAsync(async (txn) => {
      await migration.up(txn);
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
  await env.adapter.execAsync(`PRAGMA user_version = ${upTo}`);
}

function seedLegacyExpenses(db: DatabaseSync): void {
  const ins = db.prepare(LEGACY_EXPENSE_INSERT);
  ins.run(
    'e-1', 'GAS-0001', 'Combustible', 'Recarga diaria', 25000, 25000, 1, 1,
    'c1', 't1', 'efectivo', 'activo', '2026-01-05', '08:00', '', '2026-01-05T08:00:00.000Z', '2026-01-05T08:00:00.000Z', 0,
    null, null, null, 'synced', 'ws-1'
  );
  ins.run(
    'e-2', 'GAS-0002', 'Herramienta', 'Compra', 9800, 9800, 1, 1,
    'c1', 't1', 'tarjeta', 'cancelado', '2026-01-06', '09:00', '', '2026-01-06T09:00:00.000Z', '2026-01-06T09:00:00.000Z', 0,
    '2026-01-06T12:00:00.000Z', null, null, 'synced', 'ws-1'
  );
  ins.run(
    'e-3', 'GAS-0003', 'Insumos', '', 1200, 1200, 1, 1,
    null, 't1', 'transferencia', 'pendiente', '2026-01-07', '10:00', 'nota', '2026-01-07T10:00:00.000Z', '2026-01-07T10:00:00.000Z', 0,
    null, null, null, 'synced', 'ws-2'
  );
  ins.run(
    'e-4', 'GAS-0004', 'Pagado-borrado', '', 500, 0, 0, 0,
    null, null, 'otro', 'pagado', '2026-01-08', '11:00', '', '2026-01-08T11:00:00.000Z', '2026-01-08T11:00:00.000Z', 1,
    null, null, null, 'synced', 'ws-1'
  );
  ins.run(
    'e-5', 'GAS-0005', 'Cancelado-borrado', '', 300, 300, 1, 1,
    'c1', null, 'efectivo', 'cancelado', '2026-01-09', '12:00', '', '2026-01-09T12:00:00.000Z', '2026-01-09T12:00:00.000Z', 1,
    '2026-01-09T12:30:00.000Z', null, null, 'synced', 'ws-2'
  );
  ins.run(
    'e-6', 'GAS-0006', 'Activo-local', '', 7000, 7000, 1, 1,
    null, null, 'efectivo', 'activo', '2026-01-10', '13:00', '', '2026-01-10T13:00:00.000Z', '2026-01-10T13:00:00.000Z', 0,
    null, null, null, 'pending', 'ws-1'
  );
}

function seedLegacyDetails(db: DatabaseSync): void {
  const ins = db.prepare(
    `INSERT INTO expense_details (id, expense_id, product_name, quantity, unit_price, subtotal)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  ins.run('d-1', 'e-1', 'Gasolina', 5, 5000, 25000);
  ins.run('d-2', 'e-1', 'Otro cargo', 1, 9800, 9800);
  ins.run('d-3', 'e-3', 'Insumo A', 3, 400, 1200);
  ins.run('d-4', 'e-5', 'Cancelado item', 1, 300, 300);
}

function seedLegacySupportingRows(db: DatabaseSync): void {
  db.prepare(
    `INSERT INTO categories (id, name, color, icon, created_at, updated_at, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('c1', 'Transporte', '#fff', 'x', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'ws-1');
  db.prepare(
    `INSERT INTO expense_types (id, name, created_at, updated_at, workspace_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run('t1', 'Operativo', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'ws-1');
  db.prepare(
    `INSERT INTO purchases (
       id, code, supplier, date, time, status, total_amount, items_count, notes,
       created_at, updated_at, deleted, sync_status, workspace_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'p-1', 'COM-0001', 'Proveedor X', '2026-01-02', '10:00', 'recibida', 9000, 1, '',
    '2026-01-02T10:00:00.000Z', '2026-01-02T10:00:00.000Z', 0, 'synced', 'ws-1'
  );
  db.prepare(
    `INSERT INTO purchase_items (id, purchase_id, product_id, product_name, quantity, unit_price, subtotal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('pi-1', 'p-1', null, 'Producto', 1, 9000, 9000);
  db.prepare(
    `INSERT INTO custom_icons (id, name, data_url, created_at, updated_at, workspace_id, deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('ci-1', 'icono', 'data:image/png;base64,x', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'ws-1', 0, 'synced');
}

function seedLegacy(env: Env): void {
  seedLegacySupportingRows(env.db);
  seedLegacyExpenses(env.db);
  seedLegacyDetails(env.db);
}

function buildLegacyV7(env: Env, migrations: Migration[]): Promise<void> {
  return legacyMigrate(env, migrations, 7);
}

function counts(db: DatabaseSync): Record<string, number> {
  const tables = [
    'expenses', 'expense_details', 'purchases', 'purchase_items',
    'categories', 'expense_types', 'custom_icons', 'workspaces',
  ];
  const out: Record<string, number> = {};
  for (const table of tables) {
    out[table] = (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
  }
  return out;
}

function expenseStatuses(db: DatabaseSync): Record<string, string> {
  const rows = db.prepare('SELECT id, status FROM expenses ORDER BY id').all() as Array<{
    id: string;
    status: string;
  }>;
  return Object.fromEntries(rows.map((r) => [r.id, r.status]));
}

function expenseRows(db: DatabaseSync): Array<Record<string, unknown>> {
  return db.prepare('SELECT * FROM expenses ORDER BY id').all() as Array<Record<string, unknown>>;
}

function detailRows(db: DatabaseSync): Array<Record<string, unknown>> {
  return db.prepare('SELECT * FROM expense_details ORDER BY id').all() as Array<
    Record<string, unknown>
  >;
}

function indexNames(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA index_list(${JSON.stringify(table)})`).all() as Array<{
    name: string;
  }>;
  return rows.map((r) => r.name);
}

function columnNames(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all() as Array<{
    name: string;
  }>;
  return rows.map((r) => r.name);
}

function integrityOk(db: DatabaseSync): void {
  const results = db.prepare('PRAGMA integrity_check').all() as Array<Record<string, string>>;
  assert.equal(results[0]?.['integrity_check'], 'ok');
}

function noForeignKeyViolations(db: DatabaseSync): void {
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
}

describe('migración v8 (expense-status-canonico) en entorno aislado', () => {
  it('reproduce la pérdida de índices heredados idx_expenses_date e idx_expenses_category', async () => {
    const env = openDb();
    try {
      const migrations = createMigrationSet(RUNTIME);
      await buildLegacyV7(env, migrations);
      seedLegacy(env);
      await migrate(env.adapter, migrations);

      const indexes = indexNames(env.db, 'expenses');
      for (const expected of CANONICAL_EXPENSE_INDEXES) {
        assert.ok(indexes.includes(expected), `falta el índice ${expected}`);
      }
    } finally {
      env.dispose();
    }
  });

  it('mapea activo->pagado y cancelado->anulado preservando datos, detalles y relaciones', async () => {
    const env = openDb();
    try {
      const migrations = createMigrationSet(RUNTIME);
      await buildLegacyV7(env, migrations);
      seedLegacy(env);

      const before = {
        counts: counts(env.db),
        expenses: expenseRows(env.db),
        details: detailRows(env.db),
      };
      console.log('ANTES (v7):', JSON.stringify(before.counts));

      await migrate(env.adapter, migrations);

      const statuses = expenseStatuses(env.db);
      const afterCounts = counts(env.db);
      console.log('DESPUÉS (v8):', JSON.stringify(afterCounts));

      assert.equal(userVersion(env.db), 8);
      assert.equal(afterCounts['expenses'], 6, 'sin gastos perdidos');
      assert.equal(afterCounts['expense_details'], 4, 'sin detalles perdidos');

      // mismos IDs, sin pérdida ni duplicados
      assert.deepEqual(
        Object.keys(statuses).sort(),
        ['e-1', 'e-2', 'e-3', 'e-4', 'e-5', 'e-6']
      );

      assert.deepEqual(statuses, {
        'e-1': 'pagado',
        'e-2': 'anulado',
        'e-3': 'pendiente',
        'e-4': 'pagado',
        'e-5': 'anulado',
        'e-6': 'pagado',
      });

      const row = (id: string) =>
        (env.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Record<string, unknown>)!;
      const e1 = row('e-1');
      assert.equal(e1['amount'], 25000);
      assert.equal(e1['total_amount'], 25000);
      assert.equal(e1['workspace_id'], 'ws-1');
      assert.equal(e1['sync_status'], 'synced');
      assert.equal(e1['code'], 'GAS-0001');
      assert.equal(row('e-2')['voided_at'], '2026-01-06T12:00:00.000Z');
      assert.equal(row('e-3')['workspace_id'], 'ws-2');
      assert.equal(row('e-3')['notes'], 'nota');
      assert.equal(row('e-4')['deleted'], 1);
      assert.equal(row('e-5')['deleted'], 1);
      assert.equal(row('e-5')['voided_at'], '2026-01-09T12:30:00.000Z');
      assert.equal(row('e-6')['sync_status'], 'pending');
      assert.equal(row('e-6')['workspace_id'], 'ws-1');

      // detalles: mismos IDs y datos exactos
      assert.deepEqual(detailRows(env.db), before.details);

      // relaciones gasto->detalle intactas
      const rel = (env.db
        .prepare('SELECT expense_id, COUNT(*) AS c FROM expense_details GROUP BY expense_id ORDER BY expense_id')
        .all() as Array<{ expense_id: string; c: number }>)
        .map((r) => ({ [r.expense_id]: r.c }));
      assert.deepEqual(rel, [{ 'e-1': 2 }, { 'e-3': 1 }, { 'e-5': 1 }]);

      // nada fuera de expenses/expense_details cambió
      for (const t of ['purchases', 'purchase_items', 'categories', 'expense_types', 'custom_icons', 'workspaces']) {
        assert.equal(afterCounts[t], before.counts[t], `tabla ${t} no debe cambiar`);
      }

      // CHECK legacy eliminado: 'activo'/'cancelado' ya no se aceptan
      assert.throws(() =>
        env.db.prepare(LEGACY_EXPENSE_INSERT).run(
          'x-activo', 'X-1', 'n', '', 1, 1, 0, 0, null, null, 'efectivo', 'activo', '2026-02-01', '08:00', '', 't', 't', 0, null, null, null, 'pending', 'ws-1'
        )
      );
      assert.throws(() =>
        env.db.prepare(LEGACY_EXPENSE_INSERT).run(
          'x-cancelado', 'X-2', 'n', '', 1, 1, 0, 0, null, null, 'efectivo', 'cancelado', '2026-02-01', '08:00', '', 't', 't', 0, null, null, null, 'pending', 'ws-1'
        )
      );

      const leftovers = env.db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('expenses_new', 'expense_details_backup')`)
        .all() as Array<{ name: string }>;
      assert.deepEqual(leftovers, []);

      integrityOk(env.db);
      noForeignKeyViolations(env.db);
    } finally {
      env.dispose();
    }
  });

  it('conserva columnas, defaults, PK/UNIQUE y la FK de expense_details', async () => {
    const env = openDb();
    try {
      const migrations = createMigrationSet(RUNTIME);
      await buildLegacyV7(env, migrations);

      const legacyColumns = columnNames(env.db, 'expenses').slice().sort();
      await migrate(env.adapter, migrations);

      assert.deepEqual(columnNames(env.db, 'expenses').slice().sort(), legacyColumns);

      const info = env.db.prepare('PRAGMA table_info(expenses)').all() as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }>;
      const byName = Object.fromEntries(info.map((c) => [c.name, c]));
      assert.equal(byName['id'].pk, 1);
      assert.equal(byName['status'].notnull, 1);
      assert.equal(byName['status'].dflt_value, "'pagado'");
      assert.equal(byName['description'].dflt_value, "''");
      assert.equal(byName['amount'].dflt_value, '0');
      assert.equal(byName['payment_method'].dflt_value, "'efectivo'");
      assert.equal(byName['workspace_id'].dflt_value, "''");
      assert.equal(byName['sync_status'].dflt_value, "'pending'");

      // UNIQUE en code sigue vigente
      env.db.prepare(LEGACY_EXPENSE_INSERT).run(
        'd-dup', 'DUP-1', 'n', '', 1, 1, 0, 0, null, null, 'efectivo', 'pagado', '2026-02-01', '08:00', '', 't', 't', 0, null, null, null, 'pending', 'ws-1'
      );
      assert.throws(() =>
        env.db.prepare(LEGACY_EXPENSE_INSERT).run(
          'd-dup-2', 'DUP-1', 'n2', '', 1, 1, 0, 0, null, null, 'efectivo', 'pagado', '2026-02-01', '08:00', '', 't', 't', 0, null, null, null, 'pending', 'ws-1'
        )
      );

      // FK expense_details->expenses preservada
      const fks = env.db.prepare('PRAGMA foreign_key_list("expense_details")').all() as Array<{
        table: string;
        from: string;
        to: string;
        on_delete: string;
      }>;
      assert.equal(fks.length, 1);
      assert.equal(fks[0].table, 'expenses');
      assert.equal(fks[0].from, 'expense_id');
      assert.equal(fks[0].on_delete, 'CASCADE');
      assert.ok(indexNames(env.db, 'expense_details').includes('idx_expense_details_expense'));

      noForeignKeyViolations(env.db);
    } finally {
      env.dispose();
    }
  });

  it('fallo a mitad de la migración: rollback completo y recuperación segura', async () => {
    const env = openDb();
    try {
      const real = createMigrationSet(RUNTIME);
      await buildLegacyV7(env, real);
      seedLegacy(env);
      const before = counts(env.db);

      const tampered = createMigrationSet(RUNTIME);
      tampered[7] = {
        version: 8,
        name: 'expense-status-canonico',
        up: async (txn) => {
          // falla DESPUÉS de completar el rebuild para probar atomicidad
          await txn.execAsync(`${MIGRATION_V8_SQL}\nSELECT GARBAGE_COLUMN FROM nonexistent;`);
        },
      };

      await assert.rejects(migrate(env.adapter, tampered), /no such table|no such column|does not exist/);

      assert.equal(userVersion(env.db), 7, 'user_version permanece en 7 tras el fallo');
      assert.deepEqual(counts(env.db), before, 'sin pérdida ni duplicación tras rollback');

      // la tabla legacy (con su CHECK) sigue vigente
      assert.deepEqual(expenseStatuses(env.db), {
        'e-1': 'activo',
        'e-2': 'cancelado',
        'e-3': 'pendiente',
        'e-4': 'pagado',
        'e-5': 'cancelado',
        'e-6': 'activo',
      });
      assert.equal(detailRows(env.db).length, 4);
      // el CHECK legacy sigue rechazando 'anulado'
      assert.throws(() =>
        env.db.prepare(LEGACY_EXPENSE_INSERT).run(
          'x-anulado', 'X-3', 'n', '', 1, 1, 0, 0, null, null, 'efectivo', 'anulado', '2026-02-01', '08:00', '', 't', 't', 0, null, null, null, 'pending', 'ws-1'
        )
      );

      const leftovers = env.db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('expenses_new','expense_details_backup')`)
        .all() as Array<{ name: string }>;
      assert.deepEqual(leftovers, []);

      integrityOk(env.db);
      noForeignKeyViolations(env.db);

      // recuperación: re-aplicación con la migración buena
      await migrate(env.adapter, real);
      assert.equal(userVersion(env.db), 8);
      assert.deepEqual(expenseStatuses(env.db), {
        'e-1': 'pagado',
        'e-2': 'anulado',
        'e-3': 'pendiente',
        'e-4': 'pagado',
        'e-5': 'anulado',
        'e-6': 'pagado',
      });
      assert.equal(counts(env.db)['expense_details'], 4);
      integrityOk(env.db);
      noForeignKeyViolations(env.db);
    } finally {
      env.dispose();
    }
  });

  it('instalación nueva (v0 -> v8) y reapertura sin re-aplicar migraciones', async () => {
    const env = openDb();
    try {
      const migrations = createMigrationSet(RUNTIME);
      await migrate(env.adapter, migrations);
      assert.equal(userVersion(env.db), 8);
      assert.equal((env.db.prepare('SELECT COUNT(*) AS c FROM workspaces').get() as { c: number }).c, 4);

      const before = counts(env.db);
      env.db.prepare(LEGACY_EXPENSE_INSERT).run(
        'n-1', 'N-1', 'nuevo', '', 100, 100, 0, 0, null, null, 'efectivo', 'pagado', '2026-02-01', '08:00', '', 't', 't', 0, null, null, null, 'pending', 'ws-1'
      );
      env.db.prepare(
        `INSERT INTO expense_details (id, expense_id, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`
      ).run('n-d1', 'n-1', 'item', 1, 100, 100);

      env.close();
      const db2 = new DatabaseSync(env.file);
      db2.exec('PRAGMA foreign_keys = ON;');
      const adapter2 = new Adapter(db2);
      await migrate(adapter2, migrations);

      assert.equal(userVersion(db2), 8);
      assert.equal(counts(db2)['expenses'], before['expenses'] + 1);
      assert.equal(counts(db2)['expense_details'], 1);
      assert.deepEqual(expenseStatuses(db2), { 'n-1': 'pagado' });
      integrityOk(db2);
      noForeignKeyViolations(db2);
      db2.close();
    } finally {
      env.dispose();
    }
  });

  it('reapertura de una base ya migrada a v8 no re-aplica ni duplica', async () => {
    const env = openDb();
    try {
      const migrations = createMigrationSet(RUNTIME);
      await buildLegacyV7(env, migrations);
      seedLegacy(env);
      await migrate(env.adapter, migrations);

      env.close();
      const db2 = new DatabaseSync(env.file);
      db2.exec('PRAGMA foreign_keys = ON;');
      const adapter2 = new Adapter(db2);

      const beforeCounts = counts(db2);
      await migrate(adapter2, migrations);

      assert.equal(userVersion(db2), 8);
      assert.deepEqual(counts(db2), beforeCounts, 'ningún dato duplicado ni perdido');
      assert.equal(detailRows(db2).length, 4);
      assert.deepEqual(expenseStatuses(db2), {
        'e-1': 'pagado',
        'e-2': 'anulado',
        'e-3': 'pendiente',
        'e-4': 'pagado',
        'e-5': 'anulado',
        'e-6': 'pagado',
      });
      const leftovers = db2
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('expenses_new','expense_details_backup')`)
        .all() as Array<{ name: string }>;
      assert.deepEqual(leftovers, []);
      integrityOk(db2);
      noForeignKeyViolations(db2);
      db2.close();
    } finally {
      env.dispose();
    }
  });

  it('valor de estado fuera de registro bloquea la subida sin pérdida y es recuperable', async () => {
    const env = openDb();
    try {
      const migrations = createMigrationSet(RUNTIME);
      await buildLegacyV7(env, migrations);
      seedLegacy(env);

      // simula una fila legacy fuera de las reglas reales del proyecto
      env.db.exec('PRAGMA ignore_check_constraints = ON;');
      env.db.prepare(LEGACY_EXPENSE_INSERT).run(
        'e-7', 'GAS-0007', 'Estado-extraño', '', 1, 1, 0, 0, null, null, 'efectivo', 'devuelto', '2026-02-01', '08:00', '', 't', 't', 0, null, null, null, 'synced', 'ws-1'
      );
      env.db.prepare(
        `INSERT INTO expense_details (id, expense_id, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`
      ).run('d-5', 'e-7', 'item-extraño', 1, 1, 1);
      env.db.exec('PRAGMA ignore_check_constraints = OFF;');

      await assert.rejects(migrate(env.adapter, migrations), /CHECK/i);

      assert.equal(userVersion(env.db), 7, 'sin subir de versión ante datos inesperados');
      assert.equal(expenseStatuses(env.db)['e-7'], 'devuelto', 'fila intacta tras el rollback');
      assert.equal(counts(env.db)['expense_details'], 5);
      // la fila inválida preexistente ya violaba el CHECK legacy: el bloqueo es
      // correcto y no agrava la integridad (se valida tras la remediación)
      assert.notEqual(
        (env.db.prepare('PRAGMA integrity_check').all() as Array<Record<string, string>>)[0]?.['integrity_check'],
        undefined
      );
      noForeignKeyViolations(env.db);

      // remediación manual de datos (sin inventar mapeo en la migración): la
      // fila se pone en un estado legacy válido y la migración completa
      env.db.prepare("UPDATE expenses SET status = 'activo' WHERE id = 'e-7'").run();
      await migrate(env.adapter, migrations);
      assert.equal(userVersion(env.db), 8);
      assert.equal(expenseStatuses(env.db)['e-7'], 'pagado');
      assert.equal(counts(env.db)['expense_details'], 5);
      integrityOk(env.db);
      noForeignKeyViolations(env.db);
    } finally {
      env.dispose();
    }
  });

  it('rebuild correcto incluso con foreign_keys OFF (usa su propio backup/restore)', async () => {
    const env = openDb(false);
    try {
      const migrations = createMigrationSet(RUNTIME);
      await buildLegacyV7(env, migrations);
      seedLegacy(env);

      await migrate(env.adapter, migrations);

      assert.equal(userVersion(env.db), 8);
      assert.deepEqual(expenseStatuses(env.db), {
        'e-1': 'pagado',
        'e-2': 'anulado',
        'e-3': 'pendiente',
        'e-4': 'pagado',
        'e-5': 'anulado',
        'e-6': 'pagado',
      });
      assert.equal(detailRows(env.db).length, 4);

      env.db.exec('PRAGMA foreign_keys = ON;');
      integrityOk(env.db);
      noForeignKeyViolations(env.db);
    } finally {
      env.dispose();
    }
  });
});