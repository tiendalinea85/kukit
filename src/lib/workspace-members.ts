import { getSupabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type WorkspaceRole = "OWNER" | "ADMIN" | "USER" | "READ_ONLY";

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at?: string | null;
}

export interface CreateWorkspaceMemberInput {
  email: string;
  full_name: string;
  role: WorkspaceRole;
  password?: string;
}

export interface CreatedWorkspaceMember {
  workspace_id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: WorkspaceRole;
  password?: string | null;
  created: boolean;
}

async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/auth/workspaces/members?workspace_id=${encodeURIComponent(workspaceId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) throw new Error("No se pudieron listar los miembros");
  return res.json();
}

export async function createWorkspaceMember(input: CreateWorkspaceMemberInput): Promise<CreatedWorkspaceMember> {
  const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  if (!workspaceId) throw new Error("No hay espacio de trabajo activo");
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/auth/workspaces/members/create?workspace_id=${encodeURIComponent(workspaceId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let msg = "No se pudo crear el usuario";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function updateWorkspaceMemberRole(userId: string, role: WorkspaceRole): Promise<void> {
  const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  if (!workspaceId) throw new Error("No hay espacio de trabajo activo");
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/auth/workspaces/members?workspace_id=${encodeURIComponent(workspaceId)}&user_id=${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("No se pudo actualizar el rol");
}

export async function removeWorkspaceMember(userId: string): Promise<void> {
  const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  if (!workspaceId) throw new Error("No hay espacio de trabajo activo");
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/auth/workspaces/members?workspace_id=${encodeURIComponent(workspaceId)}&user_id=${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok && res.status !== 204) throw new Error("No se pudo quitar el miembro");
}
