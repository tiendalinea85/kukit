"use client";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { WorkspaceSetup } from "./WorkspaceSetup";
import { WorkspacePicker } from "./WorkspacePicker";

export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  // Sesión actual: solo se muestra la app tras elegir/crear un workspace.
  const [enteredId, setEnteredId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!user) return <>{children}</>;

  const insideWorkspace = enteredId !== null && workspaces.some((w) => w.id === enteredId);
  if (insideWorkspace) return <>{children}</>;

  if (creating || workspaces.filter((w) => w.id !== "default").length === 0) {
    return (
      <WorkspaceSetup
        onCreated={(id) => {
          setActiveWorkspace(id);
          setEnteredId(id);
        }}
      />
    );
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