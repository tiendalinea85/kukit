import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { nowIso, newId } from '../utils/id';
import { PRINCIPAL_WORKSPACES } from '../workspace/modules';
import { ACTIVE_WORKSPACE_KEY, getActiveWorkspaceId } from '../workspace/activeWorkspace';

const DATABASE_NAME = 'cato-ledger.db';
const SCHEMA_VERSION = 6;

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
  await migrate(db);
  return db;
}

interface Migration {
  version: number;
  name: string;
  up: (txn: SQLiteDatabase) => Promise<void>;
}

const SYNC_STATUS_TABLES = [
  'categories',
  'products',
  'purchases',
  'expenses',
  'expense_types',
  'investments',
  'stock_movements',
  'clients',
  'sales',
];

const DOMAIN_TABLES = [
  'categories',
  'products',
  'purchases',
  'expense_types',
  'expenses',
  'investments',
  'stock_movements',
  'clients',
  'sales',
];

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'schema-inicial',
    up: async (txn) => {
      await txn.execAsync(migrationV1);
    },
  },
  {
    version: 2,
    name: 'sync-status',
    up: async (txn) => {
      for (const table of SYNC_STATUS_TABLES) {
        const cols = await txn.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
        if (!cols.some((c) => c.name === 'sync_status')) {
          await txn.execAsync(
            `ALTER TABLE ${table} ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'`
          );
        }
      }
    },
  },
  {
    version: 3,
    name: 'workspaces',
    up: migrateV3,
  },
  {
    version: 4,
    name: 'expenses-v2',
    up: async (txn) => {
      for (const col of ['voided_at', 'receipt_url', 'receipt_thumb_url']) {
        const cols = await txn.getAllAsync<{ name: string }>(`PRAGMA table_info(expenses)`);
        if (!cols.some((c) => c.name === col)) {
          await txn.execAsync(`ALTER TABLE expenses ADD COLUMN ${col} TEXT`);
        }
      }
      await txn.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_expenses_workspace_date ON expenses(workspace_id, date DESC)'
      );
      await txn.execAsync('CREATE INDEX IF NOT EXISTS idx_expenses_code ON expenses(code)');
    },
  },
  {
    version: 5,
    name: 'purchases-v2',
    up: async (txn) => {
      const cols = await txn.getAllAsync<{ name: string }>(`PRAGMA table_info(purchases)`);
      if (!cols.some((c) => c.name === 'invoice')) {
        await txn.execAsync(`ALTER TABLE purchases ADD COLUMN invoice TEXT NOT NULL DEFAULT ''`);
      }
      if (!cols.some((c) => c.name === 'payment_method')) {
        await txn.execAsync(
          `ALTER TABLE purchases ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'efectivo'`
        );
      }
    },
  },
  {
    version: 6,
    name: 'investments-v2+stock_movements-user',
    up: async (txn) => {
      const smCols = await txn.getAllAsync<{ name: string }>(`PRAGMA table_info(stock_movements)`);
      if (!smCols.some((c) => c.name === 'user_id')) {
        await txn.execAsync(
          `ALTER TABLE stock_movements ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`
        );
      }

      const invCols = await txn.getAllAsync<{ name: string }>(`PRAGMA table_info(investments)`);
      for (const col of ['supplier', 'category']) {
        if (!invCols.some((c) => c.name === col)) {
          await txn.execAsync(`ALTER TABLE investments ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
        }
      }
      if (!invCols.some((c) => c.name === 'payment_method')) {
        await txn.execAsync(
          `ALTER TABLE investments ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'efectivo'`
        );
      }
      if (!invCols.some((c) => c.name === 'status')) {
        await txn.execAsync(
          `ALTER TABLE investments ADD COLUMN status TEXT NOT NULL DEFAULT 'pagado'`
        );
      }
      if (!invCols.some((c) => c.name === 'voided_at')) {
        await txn.execAsync(`ALTER TABLE investments ADD COLUMN voided_at TEXT`);
      }
    },
  },
];

async function migrate(db: SQLiteDatabase): Promise<void> {
  const { user_version: current } = (await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  )) ?? { user_version: 0 };

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await migration.up(txn as unknown as SQLiteDatabase);
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

async function migrateV3(txn: SQLiteDatabase): Promise<void> {
  await txn.execAsync(workspacesV3Sql);

  for (const table of [...DOMAIN_TABLES, 'outbox', 'audit_log']) {
    const cols = await txn.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === 'workspace_id')) {
      await txn.execAsync(`ALTER TABLE ${table} ADD COLUMN workspace_id TEXT NOT NULL DEFAULT ''`);
    }
  }

  for (const table of DOMAIN_TABLES) {
    await txn.execAsync(`CREATE INDEX IF NOT EXISTS idx_${table}_workspace ON ${table}(workspace_id)`);
  }
  await txn.execAsync('CREATE INDEX IF NOT EXISTS idx_outbox_workspace ON outbox(workspace_id)');
  await txn.execAsync('CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_log(workspace_id)');

  await provisionWorkspaces(txn);
  await backfillExistingData(txn);
}

async function provisionWorkspaces(txn: SQLiteDatabase): Promise<void> {
  const existing = await txn.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM workspaces'
  );

  if ((existing?.count ?? 0) === 0) {
    const now = nowIso();
    let personalId: string | null = null;
    for (const ws of PRINCIPAL_WORKSPACES) {
      const id = newId();
      if (ws.type === 'PERSONAL') personalId = id;
      await txn.runAsync(
        `INSERT INTO workspaces
           (id, name, type, parent_id, model_key, description, role, status, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, NULL, NULL, '', 'OWNER', 'active', ?, ?, 'synced')`,
        id,
        ws.name,
        ws.type,
        now,
        now
      );
      for (const code of ws.modules) {
        await txn.runAsync(
          `INSERT INTO workspace_modules (workspace_id, module_key, status, created_at)
           VALUES (?, ?, 'active', ?)`,
          id,
          code,
          now
        );
      }
    }
    if (personalId) {
      await txn.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ACTIVE_WORKSPACE_KEY,
        personalId
      );
    }
  }

  const device = await txn.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'device_id'`
  );
  if (!device) {
    await txn.runAsync(`INSERT INTO settings (key, value) VALUES ('device_id', ?)`, newId());
  }
}

async function backfillExistingData(txn: SQLiteDatabase): Promise<void> {
  const personal = await txn.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ACTIVE_WORKSPACE_KEY
  );
  const target = personal?.value ?? '';
  if (!target) return;

  for (const table of DOMAIN_TABLES) {
    await txn.runAsync(`UPDATE ${table} SET workspace_id = ? WHERE workspace_id = ''`, target);
  }
  await txn.runAsync(`UPDATE outbox SET workspace_id = ? WHERE workspace_id = ''`, target);
  await txn.runAsync(`UPDATE audit_log SET workspace_id = ? WHERE workspace_id = ''`, target);
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

const migrationV1 = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  icon TEXT NOT NULL DEFAULT '📦',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  cost_price INTEGER NOT NULL DEFAULT 0,
  sale_price INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unidad',
  tax_rate REAL NOT NULL DEFAULT 0,
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  supplier TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'recibida', 'cancelada')),
  total_amount INTEGER NOT NULL DEFAULT 0,
  items_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expense_types (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  items_count INTEGER NOT NULL DEFAULT 0,
  has_details INTEGER NOT NULL DEFAULT 0,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  type_id TEXT REFERENCES expense_types(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia', 'otro')),
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'pendiente', 'pagado', 'cancelado')),
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expense_details (
  id TEXT PRIMARY KEY NOT NULL,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'activo' CHECK (asset_type IN ('activo', 'ahorro', 'crypto', 'inmobiliaria', 'otro')),
  amount INTEGER NOT NULL DEFAULT 0,
  current_value INTEGER NOT NULL DEFAULT 0,
  return_rate REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'salida', 'ajuste', 'transferencia')),
  quantity REAL NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id TEXT,
  date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'completada', 'cancelada')),
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  tax INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  items_count INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia', 'otro')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before TEXT,
  after TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expense_details_expense ON expense_details(expense_id);
CREATE INDEX IF NOT EXISTS idx_investments_date ON investments(date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
`;

const workspacesV3Sql = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PERSONAL', 'TRABAJO', 'ESTUDIO', 'NEGOCIO', 'BUSINESS')),
  parent_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  model_key TEXT,
  description TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER', 'ADMIN', 'USER', 'READ_ONLY')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS workspace_modules (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_type ON workspaces(type);
CREATE INDEX IF NOT EXISTS idx_workspaces_parent ON workspaces(parent_id);
`;
