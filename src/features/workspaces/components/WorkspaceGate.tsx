"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppStore } from "@/stores/useAppStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { WorkspaceSetup } from "./WorkspaceSetup";
import { WorkspacePicker } from "./WorkspacePicker";

export function WorkspaceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  const workspaceSetupOpen = useAppStore(
    (state) => state.workspaceSetupOpen
  );
  const closeWorkspaceSetup = useAppStore(
    (state) => state.closeWorkspaceSetup
  );

  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const loadingWorkspaces = useWorkspaceStore(
    (state) => state.loadingWorkspaces
  );
  const activeWorkspaceId = useWorkspaceStore(
    (state) => state.activeWorkspaceId
  );
  const setActiveWorkspace = useWorkspaceStore(
    (state) => state.setActiveWorkspace
  );
  const loadWorkspaces = useWorkspaceStore(
    (state) => state.loadWorkspaces
  );

  /**
   * Workspace al que el usuario ya entró.
   */
  const [enteredId, setEnteredId] = useState<string | null>(null);

  /**
   * true únicamente cuando el usuario pulsa
   * "Crear nuevo espacio".
   */
  const [creating, setCreating] = useState(false);

  /**
   * Evita que un usuario nuevo vuelva automáticamente
   * al formulario después de pulsar "Volver".
   */
  const [formDismissed, setFormDismissed] = useState(false);

  /**
   * ============================================================
   * CARGAR WORKSPACES DEL USUARIO
   * ============================================================
   */
  useEffect(() => {
    setEnteredId(null);
    setCreating(false);
    setFormDismissed(false);

    if (!user) return;

    loadWorkspaces(user.id).catch(() => {
      // El store controla el estado de carga/error.
    });
  }, [user, loadWorkspaces]);

  /**
   * ============================================================
   * RESTAURAR WORKSPACE ACTIVO
   * ============================================================
   *
   * Si existe un workspace activo y pertenece realmente
   * al usuario actual, entrar automáticamente.
   */
  useEffect(() => {
    if (!user || enteredId !== null || loadingWorkspaces) {
      return;
    }

    const visibleWorkspaces = workspaces.filter(
      (workspace) => workspace.id !== "default"
    );

    if (visibleWorkspaces.length === 0) {
      return;
    }

    if (
      activeWorkspaceId &&
      visibleWorkspaces.some(
        (workspace) => workspace.id === activeWorkspaceId
      )
    ) {
      setEnteredId(activeWorkspaceId);
    }
  }, [
    user,
    workspaces,
    loadingWorkspaces,
    activeWorkspaceId,
    enteredId,
  ]);

  /**
   * ============================================================
   * WORKSPACE CREADO
   * ============================================================
   */
  const handleCreated = (id: string) => {
    setActiveWorkspace(id);
    setEnteredId(id);

    setCreating(false);
    setFormDismissed(false);

    closeWorkspaceSetup();
  };

  /**
   * ============================================================
   * VOLVER DESDE WORKSPACE SETUP
   * ============================================================
   */
  const handleCancelSetup = () => {
    setCreating(false);
    setFormDismissed(true);

    closeWorkspaceSetup();
  };

  /**
   * ============================================================
   * USUARIO NO AUTENTICADO
   * ============================================================
   */
  if (!user) {
    return <>{children}</>;
  }

  /**
   * ============================================================
   * CARGANDO WORKSPACES
   * ============================================================
   */
  if (loadingWorkspaces) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"
          aria-label="Cargando espacios de trabajo"
        />
      </div>
    );
  }

  /**
   * ============================================================
   * WORKSPACES VISIBLES
   * ============================================================
   *
   * Nunca mostrar el workspace interno "default".
   */
  const visibleWorkspaces = workspaces.filter(
    (workspace) => workspace.id !== "default"
  );

  const hasWorkspaces = visibleWorkspaces.length > 0;

  /**
   * ============================================================
   * ¿YA ESTÁ DENTRO DE UN WORKSPACE?
   * ============================================================
   */
  const insideWorkspace =
    enteredId !== null &&
    visibleWorkspaces.some(
      (workspace) => workspace.id === enteredId
    );

  /**
   * Una vez dentro del workspace, mostrar la aplicación.
   *
   * workspaceSetupOpen (p. ej. "Nuevo espacio de trabajo" desde
   * Sidebar/TopBar) NO debe sacar al usuario de la aplicación:
   * se muestra el formulario como overlay encima de la app.
   */
  if (insideWorkspace) {
    if (workspaceSetupOpen) {
      return (
        <>
          {children}
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <WorkspaceSetup
              onCreated={handleCreated}
              onCancel={handleCancelSetup}
            />
          </div>
        </>
      );
    }
    return <>{children}</>;
  }

  /**
   * ============================================================
   * MOSTRAR WORKSPACE SETUP
   * ============================================================
   *
   * Casos:
   *
   * 1. Usuario nuevo sin workspaces.
   * 2. Usuario pulsó "Crear nuevo".
   * 3. Alguna parte de la aplicación abrió explícitamente
   *    workspaceSetupOpen.
   *
   * formDismissed evita reabrir el formulario automáticamente
   * después de pulsar "Volver".
   */
  const shouldShowSetup =
    creating ||
    workspaceSetupOpen ||
    (!hasWorkspaces && !formDismissed);

  if (shouldShowSetup) {
    return (
      <WorkspaceSetup
        onCreated={handleCreated}
        onCancel={handleCancelSetup}
      />
    );
  }

  /**
   * ============================================================
   * WORKSPACE PICKER
   * ============================================================
   *
   * El usuario:
   *
   * - selecciona un workspace existente
   * - o pulsa "Crear nuevo espacio"
   */
  return (
    <WorkspacePicker
      onEnter={(id) => {
        const exists = visibleWorkspaces.some(
          (workspace) => workspace.id === id
        );

        if (!exists) return;

        setActiveWorkspace(id);
        setEnteredId(id);
        setFormDismissed(false);
      }}
      onCreate={() => {
        setFormDismissed(false);
        setCreating(true);
      }}
    />
  );
}

