import { getDb } from '../../core/db/database';
import { writeWithOutbox, softDelete } from '../../core/db/repo';
import type { Workspace, WorkspaceModule, ModuleCode, BusinessModelKey, WorkspaceType } from '../../core/domain/types';
import { newId, nowIso } from '../../core/utils/id';
import { getActiveWorkspaceId, setActiveWorkspaceId } from '../../core/workspace/activeWorkspace';
import { BUSINESS_MODELS } from '../../core/workspace/modules';
import type { SQLiteBindValue } from 'expo-sqlite';

export async function listWorkspaces(): Promise<Workspace[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Workspace>(
    `SELECT * FROM workspaces WHERE deleted = 0 ORDER BY created_at`
  );
  for (const ws of rows) {
    ws.modules = await db.getAllAsync<WorkspaceModule>(
      `SELECT * FROM workspace_modules WHERE workspace_id = ? ORDER BY module_key`,
      ws.id
    );
  }
  return rows;
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const db = await getDb();
  const ws = await db.getFirstAsync<Workspace>('SELECT * FROM workspaces WHERE id = ?', id);
  if (!ws) return null;
  ws.modules = await db.getAllAsync<WorkspaceModule>(
    `SELECT * FROM workspace_modules WHERE workspace_id = ? ORDER BY module_key`,
    id
  );
  return ws;
}

export async function createWorkspace(input: {
  name: string;
  type: WorkspaceType;
  parent_id?: string | null;
  model_key?: BusinessModelKey | null;
  description?: string;
  modules?: ModuleCode[];
}): Promise<Workspace> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  const modules = input.modules ?? [];

  const row: Workspace = {
    id,
    name: input.name.trim(),
    type: input.type,
    parent_id: input.parent_id ?? null,
    model_key: input.model_key ?? null,
    description: input.description ?? '',
    role: 'OWNER',
    status: 'active',
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO workspaces (id, name, type, parent_id, model_key, description,
         role, status, created_at, updated_at, deleted, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, 'OWNER', 'active', ?, ?, 0, 'pending')`,
      id, row.name, row.type, row.parent_id, row.model_key, row.description, now, now
    );
    for (const moduleKey of modules) {
      await txn.runAsync(
        `INSERT INTO workspace_modules (workspace_id, module_key, status, created_at)
         VALUES (?, ?, 'active', ?)`,
        id, moduleKey, now
      );
    }
    await txn.runAsync(
      `INSERT INTO outbox (entity_type, entity_id, operation, payload, created_at, status)
       VALUES ('workspace', ?, 'INSERT', ?, ?, 'pending')`,
      id,
      JSON.stringify({ ...row, items: modules.map((m) => ({ workspace_id: id, module_key: m, status: 'active', created_at: now })) }),
      now
    );
    await txn.runAsync(
      `INSERT INTO audit_log (action, entity_type, entity_id, after, created_at)
       VALUES ('insert', 'workspace', ?, ?, ?)`,
      id, JSON.stringify(row), now
    );
  });

  return { ...row, modules: modules.map((m) => ({ workspace_id: id, module_key: m, status: 'active', created_at: now })) };
}

export async function updateWorkspace(
  id: string,
  input: { name?: string; description?: string; status?: 'active' | 'archived' }
): Promise<Workspace | null> {
  const db = await getDb();
  const existing = await getWorkspace(id);
  if (!existing) return null;

  const now = nowIso();
  const updates: string[] = [];
  const params: SQLiteBindValue[] = [];

  if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name.trim()); }
  if (input.description !== undefined) { updates.push('description = ?'); params.push(input.description); }
  if (input.status !== undefined) { updates.push('status = ?'); params.push(input.status); }
  updates.push('updated_at = ?', 'sync_status = ?');
  params.push(now, 'pending');
  params.push(id);

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`, ...params);
    await txn.runAsync(
      `INSERT INTO outbox (entity_type, entity_id, operation, payload, created_at, status)
       VALUES ('workspace', ?, 'UPDATE', ?, ?, 'pending')`,
      id, JSON.stringify({ id, ...input, updated_at: now }), now
    );
    await txn.runAsync(
      `INSERT INTO audit_log (action, entity_type, entity_id, before, after, created_at)
       VALUES ('update', 'workspace', ?, ?, ?, ?)`,
      id, JSON.stringify(existing), JSON.stringify({ ...existing, ...input, updated_at: now }), now
    );
  });

  return getWorkspace(id);
}

export async function archiveWorkspace(id: string): Promise<boolean> {
  const db = await getDb();
  const existing = await getWorkspace(id);
  if (!existing) return false;
  if (existing.type === 'PERSONAL' || existing.type === 'TRABAJO' || existing.type === 'ESTUDIO') return false;

  return updateWorkspace(id, { status: 'archived' }).then(() => true);
}

export async function switchWorkspace(id: string): Promise<boolean> {
  const db = await getDb();
  const ws = await getWorkspace(id);
  if (!ws || ws.status !== 'active') return false;
  await setActiveWorkspaceId(db, id);
  return true;
}

export function modulesForModel(modelKey: BusinessModelKey): ModuleCode[] {
  const model = BUSINESS_MODELS.find((m) => m.key === modelKey);
  return model ? [...model.modules] : [];
}

export async function listWorkspaceModules(workspaceId: string): Promise<WorkspaceModule[]> {
  const db = await getDb();
  return db.getAllAsync<WorkspaceModule>(
    `SELECT * FROM workspace_modules WHERE workspace_id = ? ORDER BY module_key`,
    workspaceId
  );
}

/**
 * Activa o desactiva un módulo en un workspace.
 * Si el módulo es transversal (expenses, reports), no se puede desactivar.
 * Actualiza la tabla workspace_modules y registra en outbox + audit_log.
 */
export async function toggleModule(
  workspaceId: string,
  moduleKey: ModuleCode,
  status: 'active' | 'disabled'
): Promise<WorkspaceModule> {
  const db = await getDb();
  const now = nowIso();
  const TRANSVERSAL: ModuleCode[] = ['expenses', 'reports'];

  if (status === 'disabled' && TRANSVERSAL.includes(moduleKey)) {
    throw new Error(`El módulo "${moduleKey}" es transversal y no se puede desactivar.`);
  }

  const existing = await db.getFirstAsync<WorkspaceModule>(
    `SELECT * FROM workspace_modules WHERE workspace_id = ? AND module_key = ?`,
    workspaceId, moduleKey
  );

  if (existing) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE workspace_modules SET status = ?, created_at = ? WHERE workspace_id = ? AND module_key = ?`,
        status, now, workspaceId, moduleKey
      );
      await txn.runAsync(
        `INSERT INTO outbox (entity_type, entity_id, operation, payload, created_at, status)
         VALUES ('workspace_module', ?, 'UPDATE', ?, ?, 'pending')`,
        `${workspaceId}:${moduleKey}`,
        JSON.stringify({ workspace_id: workspaceId, module_key: moduleKey, status }),
        now
      );
    });
  } else {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO workspace_modules (workspace_id, module_key, status, created_at)
         VALUES (?, ?, ?, ?)`,
        workspaceId, moduleKey, status, now
      );
      await txn.runAsync(
        `INSERT INTO outbox (entity_type, entity_id, operation, payload, created_at, status)
         VALUES ('workspace_module', ?, 'INSERT', ?, ?, 'pending')`,
        `${workspaceId}:${moduleKey}`,
        JSON.stringify({ workspace_id: workspaceId, module_key: moduleKey, status }),
        now
      );
    });
  }

  return db.getFirstAsync<WorkspaceModule>(
    `SELECT * FROM workspace_modules WHERE workspace_id = ? AND module_key = ?`,
    workspaceId, moduleKey
  ) as Promise<WorkspaceModule>;
}

/**
 * Aplica la configuración de módulos de un modelo de negocio a un workspace.
 * Desactiva módulos que no pertenecen al modelo y activa los que sí.
 */
export async function applyModelModules(
  workspaceId: string,
  modelKey: BusinessModelKey
): Promise<void> {
  const modelModules = modulesForModel(modelKey);
  const allModules: ModuleCode[] = [
    'expenses', 'products', 'inventory', 'purchases', 'suppliers',
    'sales', 'customers', 'investments', 'reports',
    'tailoring', 'agriculture', 'automotive_parts', 'breeding',
  ];

  const db = await getDb();
  const now = nowIso();

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const code of allModules) {
      const isActive = modelModules.includes(code) || ['expenses', 'reports'].includes(code);
      await txn.runAsync(
        `INSERT INTO workspace_modules (workspace_id, module_key, status, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(workspace_id, module_key) DO UPDATE SET status = excluded.status, created_at = excluded.created_at`,
        workspaceId, code, isActive ? 'active' : 'disabled', now
      );
    }
    await txn.runAsync(
      `INSERT INTO outbox (entity_type, entity_id, operation, payload, created_at, status)
       VALUES ('workspace', ?, 'UPDATE', ?, ?, 'pending')`,
      workspaceId,
      JSON.stringify({ id: workspaceId, model_key: modelKey, updated_at: now }),
      now
    );
  });
}
