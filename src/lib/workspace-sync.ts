import { getSupabase, getCurrentUser } from "./supabase";
import { useWorkspaceStore, type Workspace } from "@/stores/useWorkspaceStore";
import { MODEL_MODULES } from "@/stores/useWorkspaceStore";

// ===========================================================================
// SYNC DE WORKSPACES
//
// A diferencia de las entidades de negocio (syncan via ENTITY_SPECS a tablas
// Dexie con user_id), los workspaces viven en useWorkspaceStore (zustand +
// localStorage, una copia por DISPOSITIVO). El resultado es que un workspace
// creado en el celular no aparece en el PC con la misma cuenta.
//
// Este módulo sincroniza workspaces por usuario:
//   - push: al crear un workspace lo sube a public.workspaces (+ modules).
//   - pull: al entrar a la app baja los del usuario y los fusiona en el store,
//           deduplicando por nombre (un correo = un workspace, no duplicados).
//
// workspace_modules NO tiene user_id, por eso se maneja aquí por separado y
// no entra en ENTITY_SPECS.
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

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
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
// PUSH
// ---------------------------------------------------------------------------

/** Sube un workspace (re-creado o nuevo) a Supabase para el usuario actual. */
export async function pushWorkspaceToSupabase(w: Workspace): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const user = await getCurrentUser();
  if (!user) return;

  const { error } = await sb
    .from("workspaces")
    .upsert(workspaceToPayload(w, user.id), { onConflict: "id" });
  if (error) throw error;

  if (w.modules.length > 0) {
    const { error: modErr } = await sb
      .from("workspace_modules")
      .upsert(workspaceModulesToPayload(w.id, w.modules), {
        onConflict: "workspace_id,module_key",
      });
    if (modErr) throw modErr;
  }
}

// ---------------------------------------------------------------------------
// PULL (por usuario, dedupe por nombre)
// ---------------------------------------------------------------------------

export async function pullWorkspacesFromSupabase(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const user = await getCurrentUser();
  if (!user) return;

  const { data, error } = await sb
    .from("workspaces")
    .select("*")
    .eq("user_id", user.id)
    .eq("deleted", false);
  if (error) throw error;

  const serverRows = (data ?? []) as Array<Record<string, unknown>>;
  if (serverRows.length === 0) return;

  // Traer modules de los workspaces remotos.
  const ids = serverRows.map((r) => asStr(r.id)).filter(Boolean);
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

  const store = useWorkspaceStore.getState();
  const existingByName = new Map(
    store.workspaces
      .filter((w) => w.id !== "default")
      .map((w) => [w.name.trim().toLowerCase(), w.name]),
  );
  // Limpiar el workspace sintético "default" si no lo creó el usuario.
  const hasRealWorkspace = store.workspaces.some((w) => w.id !== "default");

  for (const row of serverRows) {
    const ws = workspaceFromRow(row);
    ws.modules = modMap.get(ws.id) ?? ws.modules;

    // Dedupe por nombre: si ya existe localmente un workspace con ese nombre
    // (p. ej. creado en este dispositivo), NO creamos un duplicado.
    const key = ws.name.trim().toLowerCase();
    const sameId = store.workspaces.some((w) => w.id === ws.id);
    if (sameId) continue;
    if (existingByName.has(key)) {
      // Ancla el id remoto al workspace local existente para no duplicar.
      store.updateWorkspace(existingByName.get(key)!, {});
      continue;
    }
    useWorkspaceStore.setState((s) => ({
      workspaces: [...s.workspaces.filter((w) => w.id !== "default"), ws],
    }));
  }

  // Si no había un workspace local y el usuario sí tiene en la nube, activar
  // automáticamente el primero remoto para no forzar la creación duplicada.
  if (!hasRealWorkspace) {
    const { workspaces } = useWorkspaceStore.getState();
    const first = workspaces.find((w) => w.id !== "default");
    if (first) {
      useWorkspaceStore.getState().setActiveWorkspace(first.id);
    }
  }
}