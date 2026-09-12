import { create } from 'zustand';
import { getDb } from '../db/database';
import { getActiveWorkspaceId } from './activeWorkspace';
import { MODULES, type ModuleDef } from './modules';
import type { ModuleCode, WorkspaceModule } from '../domain/types';

// Re-export pure UI functions so callers only need one import
export { MODULE_UI, visibleTabs, visibleQuickLinks, visibleDashboardCards } from './moduleUI';
export type { ModuleUIBinding } from './moduleUI';

// ── Pure functions (no React, safe for repositories) ──────────────

/**
 * Lee los módulos activos del workspace activo desde SQLite.
 */
export async function getEnabledModuleCodes(): Promise<Set<ModuleCode>> {
  const db = await getDb();
  const wsId = await getActiveWorkspaceId(db);
  if (!wsId) return new Set();

  const rows = await db.getAllAsync<WorkspaceModule>(
    `SELECT module_key as module_key, status FROM workspace_modules
     WHERE workspace_id = ? AND status = 'active'`,
    wsId
  );
  return new Set(rows.map((r) => r.module_key as ModuleCode));
}

/**
 * Retorna true si el módulo está habilitado en el workspace activo.
 */
export async function isModuleEnabled(code: ModuleCode): Promise<boolean> {
  const enabled = await getEnabledModuleCodes();
  return enabled.has(code);
}

/**
 * Retorna los ModuleDef completos de los módulos habilitados.
 */
export async function getEnabledModules(): Promise<ModuleDef[]> {
  const enabled = await getEnabledModuleCodes();
  return Object.values(MODULES).filter((m) => enabled.has(m.code));
}

/**
 * Retorna módulos habilitados agrupados por categoría.
 */
export async function getEnabledModulesByCategory(): Promise<Record<string, ModuleDef[]>> {
  const modules = await getEnabledModules();
  const grouped: Record<string, ModuleDef[]> = {};
  for (const m of modules) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }
  return grouped;
}

/**
 * Retorna los módulos configurables (no transversales) del workspace activo.
 * Transversales (expenses, reports) siempre están activos.
 */
export async function getConfigurableModules(): Promise<{
  enabled: ModuleDef[];
  disabled: ModuleDef[];
}> {
  const db = await getDb();
  const wsId = await getActiveWorkspaceId(db);
  if (!wsId) return { enabled: [], disabled: [] };

  const rows = await db.getAllAsync<WorkspaceModule>(
    `SELECT module_key, status FROM workspace_modules WHERE workspace_id = ?`,
    wsId
  );
  const activeSet = new Set(rows.filter((r) => r.status === 'active').map((r) => r.module_key));

  const enabled: ModuleDef[] = [];
  const disabled: ModuleDef[] = [];
  for (const m of Object.values(MODULES)) {
    if (activeSet.has(m.code)) {
      enabled.push(m);
    } else {
      disabled.push(m);
    }
  }
  return { enabled, disabled };
}

// ── Zustand store (para componentes React) ────────────────────────

interface ModuleStoreState {
  enabled: Set<ModuleCode>;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useModuleStore = create<ModuleStoreState>((set) => ({
  enabled: new Set(),
  loaded: false,
  load: async () => {
    const codes = await getEnabledModuleCodes();
    set({ enabled: codes, loaded: true });
  },
}));
