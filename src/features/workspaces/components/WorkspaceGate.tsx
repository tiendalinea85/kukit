"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppStore } from "@/stores/useAppStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { WorkspaceSetup } from "./WorkspaceSetup";
import { WorkspacePicker } from "./WorkspacePicker";
import { pullWorkspacesFromSupabase } from "@/lib/workspace-sync";

export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const workspaceSetupOpen = useAppStore((s) => s.workspaceSetupOpen);
  const closeWorkspaceSetup = useAppStore((s) => s.closeWorkspaceSetup);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  // Sesión actual: solo se muestra la app tras elegir/crear un workspace.
  const [enteredId, setEnteredId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Con sesión: 1) bajar workspaces del servidor (cross-device) si no hay
  // locales, 2) auto-entrar al workspace activo persistido (o al único)
  // para evitar mostrar el picker en cada recarga.
  useEffect(() => {
    if (!user) return;
    const hasReal = workspaces.some((w) => w.id !== "default");
    if (!hasReal) {
      setSyncing(true);
      pullWorkspacesFromSupabase()
        .catch(() => {})
        .finally(() => setSyncing(false));
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user || enteredId) return;
    const visible = workspaces.filter((w) => w.id !== "default");
    if (visible.length === 0) return;
    const activeId = useWorkspaceStore.getState().activeWorkspaceId;
    const target = visible.find((w) => w.id === activeId) ?? visible[0];
    setEnteredId(target.id);
  }, [user?.id, workspaces.length, syncing]);

  const created = (id: string) => {
    setActiveWorkspace(id);
    setEnteredId(id);
    setCreating(false);
    closeWorkspaceSetup();
  };

  if (!user) return <>{children}</>;

  if (syncing) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const insideWorkspace = enteredId !== null && workspaces.some((w) => w.id === enteredId);
  if (insideWorkspace) {
    // Desde la app también se pueden crear nuevos espacios de trabajo.
    if (workspaceSetupOpen) {
      return <WorkspaceSetup onCreated={created} />;
    }
    return <>{children}</>;
  }

  if (creating || workspaces.filter((w) => w.id !== "default").length === 0) {
    return <WorkspaceSetup onCreated={created} />;
  }

  return (
    <WorkspacePicker
      onEnter={(id) => {
        setActiveWorkspace(id);
        setEnteredId(id);
      }}
      onCreate={() => setCreating(true)}
    />
  );
}