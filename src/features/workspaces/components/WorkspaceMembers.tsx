"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Plus, Shield, Trash2, UserPlus, Users } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  createWorkspaceMember,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/lib/workspace-members";

const ROLES: { value: WorkspaceRole; label: string }[] = [
  { value: "OWNER", label: "Propietario" },
  { value: "ADMIN", label: "Administrador" },
  { value: "USER", label: "Usuario" },
  { value: "READ_ONLY", label: "Solo lectura" },
];

export function WorkspaceMembers() {
  const { user } = useAuth();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspace = useWorkspaceStore((s) => s.getActiveWorkspace());
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("USER");
  const [password, setPassword] = useState<string | null>(null);

  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const list = await listWorkspaceMembers(activeWorkspaceId);
      setMembers(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al cargar miembros";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setCreating(true);
    try {
      const res = await createWorkspaceMember({ email, full_name: fullName, role });
      setPassword(res.password || null);
      toast.success("Usuario creado y asignado al espacio");
      setEmail("");
      setFullName("");
      setRole("USER");
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al crear usuario";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const copyCreds = async () => {
    if (!password || !email) return;
    const text = `Correo: ${email}\nContrase�a: ${password}\nEspacio: ${workspace?.name || ""}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Credenciales copiadas");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-purple-400" />
          <div>
            <h2 className="text-sm font-medium">Miembros del espacio</h2>
            <p className="text-xs text-zinc-500">{workspace?.name || "Espacio activo"}</p>
          </div>
        </div>
        {canManage && (
          <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
            <UserPlus size={16} /> Crear usuario
          </Button>
        )}
      </div>

      {open && canManage && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          onSubmit={handleCreate}
          className="p-4 border-b border-zinc-800/60 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              required
              type="text"
              placeholder="Nombre completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-950/60 border border-zinc-800 text-sm text-zinc-100"
            />
            <input
              required
              type="email"
              placeholder="Correo electr�nico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-950/60 border border-zinc-800 text-sm text-zinc-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              className="px-3 py-2 rounded-xl bg-zinc-950/60 border border-zinc-800 text-sm text-zinc-100"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <Button type="submit" disabled={creating}>
              <Plus size={16} /> {creating ? "Creando..." : "Crear y asignar"}
            </Button>
          </div>
          {password && (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-emerald-600/10 border border-emerald-600/30 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-emerald-400 font-medium">Credenciales generadas</p>
                <p className="text-xs text-emerald-300/80 truncate">Correo: {email} | Contrase�a: {password}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void copyCreds()}>
                <Copy size={14} /> Copiar
              </Button>
            </div>
          )}
        </motion.form>
      )}

      <div className="divide-y divide-zinc-800/60">
        {loading ? (
          <p className="p-4 text-sm text-zinc-500">Cargando miembros...</p>
        ) : members.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">Sin miembros registrados</p>
        ) : (
          members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold text-white">
                {(m.user_id || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-100 truncate">{m.user_id}</p>
                <p className="text-xs text-zinc-500">{m.role}</p>
              </div>
              {canManage && m.user_id !== user?.id && (
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={async (e) => {
                      const newRole = e.target.value as WorkspaceRole;
                  try {
                    await updateWorkspaceMemberRole(m.user_id, newRole);
                    toast.success("Rol actualizado");
                    await load();
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : "Error al actualizar";
                    toast.error(msg);
                  }
                    }}
                    className="px-2 py-1 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-100"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      if (!confirm("�Quitar este usuario del espacio?")) return;
                      try {
                        await removeWorkspaceMember(m.user_id);
                        toast.success("Miembro quitado");
                        await load();
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : "Error al quitar";
                        toast.error(msg);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-600/10 text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
              {!canManage && <Shield size={16} className="text-zinc-600" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
