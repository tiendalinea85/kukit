import { getDb } from '../db/database';
import { getActiveWorkspaceId } from '../workspace/activeWorkspace';

/**
 * Retorna el workspace_id activo actualmente.
 * Todas las queries de repositories DEBEN usar esto para filtrar datos.
 */
export async function requireActiveWorkspaceId(): Promise<string> {
  const db = await getDb();
  const id = await getActiveWorkspaceId(db);
  if (!id) throw new Error('No hay workspace activo');
  return id;
}

/**
 * Retorna el workspace_id activo o null si no hay ninguno.
 */
export async function getActiveWorkspaceIdSafe(): Promise<string | null> {
  try {
    const db = await getDb();
    return await getActiveWorkspaceId(db);
  } catch {
    return null;
  }
}
