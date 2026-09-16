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
  // "creating" = el usuario pulsó explícitamente "+ Crear nuevo espacio".
  const [creating, setCreating] = useState(false);
  // "formDismissed" = el usuario pulsó Volver en el formulario. Evita bucles:
  // tras volver se muestra el listado (o su estado vacío) en lugar de reabrir
  // el formulario automáticamente.
  const [formDismissed, setFormDismissed] = useState(false);

  // Al entrar (o cambiar de usuario): bajar LOS workspaces de ESTE usuario
  // desde Supabase (fuente de verdad) y reiniciar la sesión de navegación.
  useEffect(() => {
    setEnteredId(null);
    setCreating(false);
    setFormDismissed(false);
    if (user) {
      loadWorkspaces(user.id).catch(() => {});
    }
  }, [user, loadWorkspaces]);

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
  }, [user, workspaces, loadingWorkspaces, enteredId]);

  const created = (id: string) => {
    setActiveWorkspace(id);
    setEnteredId(id);
    setCreating(false);
    setFormDismissed(false);
    closeWorkspaceSetup();
  };

  // Volver desde el formulario de creación:
  // - si llegó desde el listado (pulsó "+ Crear") -> regresa al listado.
  // - si es un usuario nuevo sin workspaces -> regresa al listado vacío
  //   (destino seguro definido por la app: no reabre el formulario y no crea
  //   nada de forma automática).
  const dismissSetup = () => {
    setCreating(false);
    setFormDismissed(true);
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
      return <WorkspaceSetup onCreated={created} onCancel={dismissSetup} />;
    }
    return <>{children}</>;
  }

  const visible = workspaces.filter((w) => w.id !== "default");
  const hasWorkspaces = visible.length > 0;

  // El formulario solo se muestra cuando:
  // - usuario nuevo sin workspaces (primera vez en la app), o
  // - el usuario pulsó explícitamente "+ Crear nuevo espacio".
  // Si el usuario ya pulsó Volver (formDismissed) se muestra la lista de sus
  // workspaces (o el estado vacío) como destino seguro, sin bucles.
  if (creating || (!hasWorkspaces && !formDismissed)) {
    return <WorkspaceSetup onCreated={created} onCancel={dismissSetup} />;
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