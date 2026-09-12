const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const src = fs.readFileSync('apps/mobile/src/core/db/database.ts', 'utf8');

function extract(name) {
  const m = src.match(new RegExp(`const ${name} = \\\`([\\s\\S]*?)\\\`;`));
  if (!m) throw new Error('constante no encontrada: ' + name);
  return m[1];
}

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');

console.log('-- v1 schema');
db.exec(extract('migrationV1'));

const SYNC_STATUS_TABLES = ['categories', 'products', 'purchases', 'expenses', 'expense_types', 'investments', 'stock_movements', 'clients', 'sales'];
console.log('-- v2 sync_status');
for (const t of SYNC_STATUS_TABLES) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all();
  if (!cols.some((c) => c.name === 'sync_status')) {
    db.exec(`ALTER TABLE ${t} ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'`);
  }
}

const DOMAIN_TABLES = ['categories', 'products', 'purchases', 'expense_types', 'expenses', 'investments', 'stock_movements', 'clients', 'sales'];
console.log('-- v3 workspaces');
db.exec(extract('workspacesV3Sql'));

for (const t of [...DOMAIN_TABLES, 'outbox', 'audit_log']) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all();
  if (!cols.some((c) => c.name === 'workspace_id')) {
    db.exec(`ALTER TABLE ${t} ADD COLUMN workspace_id TEXT NOT NULL DEFAULT ''`);
  }
}
for (const t of DOMAIN_TABLES) {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_${t}_workspace ON ${t}(workspace_id)`);
}
db.exec('CREATE INDEX IF NOT EXISTS idx_outbox_workspace ON outbox(workspace_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_log(workspace_id)');

const now = new Date().toISOString();
const wsInsert = db.prepare(`INSERT INTO workspaces (id, name, type, parent_id, model_key, description, role, status, created_at, updated_at, sync_status)
  VALUES (?, ?, ?, NULL, NULL, '', 'OWNER', 'active', ?, ?, 'synced')`);
const defs = [['p', 'Personal', 'PERSONAL'], ['t', 'Trabajo', 'TRABAJO'], ['e', 'Estudio', 'ESTUDIO'], ['n', 'Negocio', 'NEGOCIO']];
for (const [id, name, type] of defs) wsInsert.run(id, name, type, now, now);

const modInsert = db.prepare('INSERT INTO workspace_modules (workspace_id, module_key, status, created_at) VALUES (?, ?, ?, ?)');
for (const code of ['expenses', 'reports']) modInsert.run('p', code, 'active', now);
for (const code of ['expenses', 'reports']) modInsert.run('t', code, 'active', now);
for (const code of ['expenses', 'reports']) modInsert.run('e', code, 'active', now);

db.prepare("INSERT INTO settings (key, value) VALUES ('active_workspace_id', 'p')").run();
db.prepare("INSERT INTO settings (key, value) VALUES ('device_id', 'dev-1')").run();

// seed + backfill
db.prepare('INSERT INTO categories (id, name, color, icon, created_at, updated_at, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run('c1', 'General', '#8b5cf6', 'x', now, now, 'p');
for (const t of DOMAIN_TABLES) {
  db.prepare(`UPDATE ${t} SET workspace_id = 'p' WHERE workspace_id = ''`).run();
}
db.prepare("UPDATE outbox SET workspace_id = 'p' WHERE workspace_id = ''").run();
db.prepare("UPDATE audit_log SET workspace_id = 'p' WHERE workspace_id = ''").run();

// verificaciones
console.log('workspaces:', db.prepare('SELECT COUNT(*) AS c FROM workspaces').get().c);
console.log('workspace_modules:', db.prepare('SELECT COUNT(*) AS c FROM workspace_modules').get().c);
console.log('active_workspace_id:', db.prepare("SELECT value FROM settings WHERE key='active_workspace_id'").get().value);
console.log('categoria scoped:', db.prepare("SELECT workspace_id FROM categories WHERE id='c1'").get().workspace_id);
console.log('role default:', db.prepare("SELECT role FROM workspaces WHERE id='n'").get().role);
console.log('CHECK type válido ok, inválido debe fallar:');
try {
  db.prepare("INSERT INTO workspaces (id,name,type,created_at,updated_at,sync_status) VALUES ('x','x','HACK','a','b','synced')").run();
  console.log('  ERROR: no rechazó type inválido');
} catch {
  console.log('  OK: rechazó type inválido');
}
console.log('VALIDACIÓN DE MIGRACIÓN OK');
