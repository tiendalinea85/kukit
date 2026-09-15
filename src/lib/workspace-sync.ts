import { getSupabase } from "./supabase";
import type { Workspace } from "@/stores/useWorkspaceStore";

// ===========================================================================
// PERSISTENCIA DE WORKSPACES (Supabase = fuente de verdad)
//
// Los workspaces pertenecen a un usuario autenticado (user_id → auth.users).
// Este módulo es la ÚNICA capa que toca public.workspaces / workspace_modules
// desde el frontend. useWorkspaceStore orquesta (load on login, create, reset)
// llamando a fetchWorkspacesForUser / insertWorkspace.
//
// NO importa el store en runtime: el store importa este módulo (no hay ciclo).
// ===========================================================================

/** Uppercase del type de negocio del workspace (PERSONAL/TRABAJO/ESTUDIO/NEGOCIO). */
const TYPE_BY_CATEGORY: Record<string, string> = {
  personal: "PERSONAL",
  trabajo: "TRABAJO",
  estudio: "ESTUDIO",
  negocio: "NEGOCIO",
  business: "BUSINESS",
};

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function workspaceToPayload(row: Workspace, userId: string): Record<string, unknown> {
  return {
    id: row.id,
    user_id: userId,
    name: row.name,
    type: TYPE_BY_CATEGORY[row.categoryId] ?? "PERSONAL",
    model_key: row.model,
    description: "",
    role: "OWNER",
    status: "active",
    deleted: false,
    created_at: row.createdAt,
    updated_at: row.createdAt,
  };
}

/** Devuelve los modules como filas de workspace_modules (server). */
export function workspaceModulesToPayload(
  workspaceId: string,
  modules: string[],
): Array<Record<string, unknown>> {
  return modules.map((m) => ({
    workspace_id: workspaceId,
    module_key: m,
    status: "active",
  }));
}

export function workspaceFromRow(row: Record<string, unknown>): Workspace {
  const categoryId = Object.keys(TYPE_BY_CATEGORY).find(
    (k) => TYPE_BY_CATEGORY[k] === asStr(row.type),
  ) ?? "personal";
  const modules: string[] = Array.isArray(row.modules) ? (row.modules as string[]) : [];
  return {
    id: asStr(row.id),
    name: asStr(row.name),
    model: (asStr(row.model_key) as Workspace["model"]) || "general",
    modules,
    categoryId,
    createdAt: asStr(row.created_at) || asStr(row.created_at_v2),
  };
}

// ---------------------------------------------------------------------------
// READ: solo los workspaces del usuario (con sus módulos)
// ---------------------------------------------------------------------------

export async function fetchWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const sb = getSupabase();
  if (!sb || !userId) return [];

  const { data, error } = await sb
    .from("workspaces")
    .select("*")
    .eq("user_id", userId)
    .eq("deleted", false)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  const ids = rows.map((r) => asStr(r.id)).filter(Boolean);
  const modMap = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: modRows, error: modErr } = await sb
      .from("workspace_modules")
      .select("workspace_id, module_key")
      .in("workspace_id", ids);
    if (modErr) throw modErr;
    for (const mr of (modRows ?? []) as Array<Record<string, unknown>>) {
      const wid = asStr(mr.workspace_id);
      if (!wid) continue;
      modMap.set(wid, [...(modMap.get(wid) ?? []), asStr(mr.module_key)]);
    }
  }

  return rows.map((r) => {
    const ws = workspaceFromRow(r);
    ws.modules = modMap.get(ws.id) ?? ws.modules;
    return ws;
  });
}

// ---------------------------------------------------------------------------
// WRITE: crea el workspace + sus módulos (INSERT, no upsert: id genera el cliente)
// ---------------------------------------------------------------------------

export async function insertWorkspace(ws: Workspace, userId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { error } = await sb.from("workspaces").insert(workspaceToPayload(ws, userId));
  if (error) throw error;

  if (ws.modules.length === 0) return;

  const { error: modErr } = await sb
    .from("workspace_modules")
    .insert(workspaceModulesToPayload(ws.id, ws.modules));
  if (modErr) {
    // Rollback: borrar el workspace para no dejar un huérfano sin módulos.
    try {
      await sb.from("workspaces").delete().eq("id", ws.id);
    } catch {
      // sin importar el resultado, el error original es el que se propaga
    }
    throw modErr;
  }
}