"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppStore } from "@/stores/useAppStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { WorkspaceSetup } from "./WorkspaceSetup";
import { WorkspacePicker } from "./WorkspacePicker";

export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const workspaceSetupOpen = useAppStore((s) => s.workspaceSetupOpen);
  const closeWorkspaceSetup = useAppStore((s) => s.closeWorkspaceSetup);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const loadingWorkspaces = useWorkspaceStore((s) => s.loadingWorkspaces);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);

  const [enteredId, setEnteredId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Al entrar (o cambiar de usuario): bajar LOS workspaces de ESTE usuario
  // desde Supabase (fuente de verdad) y reiniciar la sesión de navegación.
  useEffect(() => {
    setEnteredId(null);
    setCreating(false);
    if (user) {
      loadWorkspaces(user.id).catch(() => {});
    }
  }, [user?.id]);

  // Auto-entrar al workspace activo persistido y que siga perteneciendo al
  // usuario (continuidad en el mismo dispositivo). En un dispositivo nuevo se
  // muestra el listado con los workspaces sincronizados.
  useEffect(() => {
    if (!user || enteredId) return;
    const visible = workspaces.filter((w) => w.id !== "default");
    if (visible.length === 0 || loadingWorkspaces) return;
    const activeId = useWorkspaceStore.getState().activeWorkspaceId;
    if (activeId && visible.some((w) => w.id === activeId)) {
      setEnteredId(activeId);
    }
  }, [user?.id, workspaces, loadingWorkspaces, enteredId]);

  const created = (id: string) => {
    setActiveWorkspace(id);
    setEnteredId(id);
    setCreating(false);
    closeWorkspaceSetup();
  };

  const cancelCreation = () => {
    setCreating(false);
    closeWorkspaceSetup();
  };

  if (!user) return <>{children}</>;

  if (loadingWorkspaces) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const insideWorkspace = enteredId !== null && workspaces.some((w) => w.id === enteredId);
  if (insideWorkspace) {
    if (workspaceSetupOpen) {
      return <WorkspaceSetup onCreated={created} onCancel={cancelCreation} />;
    }
    return <>{children}</>;
  }

  const visible = workspaces.filter((w) => w.id !== "default");
  if (creating || visible.length === 0) {
    return <WorkspaceSetup onCreated={created} onCancel={cancelCreation} />;
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