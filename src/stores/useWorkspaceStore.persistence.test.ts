import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { useWorkspaceStore, type Workspace } from "./useWorkspaceStore.ts";

// Regresión: los workspaces se perdían al recregar. loadWorkspaces reemplazaba
// la lista por la respuesta de Supabase (un [] cuando no había userId resuelto)
// y createWorkspace omitía el INSERT si getCurrentUser() devolvía null.

function ws(id: string, extra: Partial<Workspace> = {}): Workspace {
  return {
    id,
    name: "Mi negocio",
    model: "commerce",
    modules: ["expenses", "reports"],
    categoryId: "negocio",
    createdAt: "2026-09-16T10:00:00.000Z",
    ...extra,
  };
}

function setNavigatorOnline(online: boolean): void {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: online },
    configurable: true,
  });
}

describe("useWorkspaceStore persistencia de workspaces", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().resetWorkspaces();
    useWorkspaceStore.setState({
      workspaces: [],
      loadedForUserId: null,
      activeWorkspaceId: null,
    });
    setNavigatorOnline(true);
  });

  afterEach(() => {
    delete (globalThis as { navigator?: unknown }).navigator;
  });

  it("conserva la lista local cuando no hay userId resuelto", async () => {
    useWorkspaceStore.getState().addWorkspace(ws("ws-local"));
    useWorkspaceStore.setState({ activeWorkspaceId: "ws-local" });

    await useWorkspaceStore.getState().loadWorkspaces(undefined);

    const state = useWorkspaceStore.getState();
    assert.equal(state.loadingWorkspaces, false);
    assert.equal(state.workspaces.length, 1);
    assert.equal(state.workspaces[0].id, "ws-local");
    assert.equal(state.activeWorkspaceId, "ws-local");
  });

  it("conserva la lista local si Supabase no está configurado", async () => {
    useWorkspaceStore.getState().addWorkspace(ws("ws-local"));

    await useWorkspaceStore.getState().loadWorkspaces("u-test");

    assert.equal(useWorkspaceStore.getState().workspaces.length, 1);
    assert.equal(useWorkspaceStore.getState().loadingWorkspaces, false);
  });

  it("no borra workspaces pendientes aunque la lista remota venga vacía", async () => {
    useWorkspaceStore.getState().addWorkspace(ws("ws-pendiente", { pendingSync: true }));
    useWorkspaceStore.setState({ activeWorkspaceId: "ws-pendiente" });

    // Sin red el push no puede completarse: el workspace debe seguir en la
    // lista (antes se perdía en la siguiente carga).
    setNavigatorOnline(false);
    await useWorkspaceStore.getState().loadWorkspaces("u-test");

    const state = useWorkspaceStore.getState();
    assert.equal(state.workspaces.length, 1);
    assert.equal(state.workspaces[0].pendingSync, true);
    assert.equal(state.activeWorkspaceId, "ws-pendiente");
  });

  it("sin red mantiene los workspaces del usuario cacheados", async () => {
    useWorkspaceStore.getState().addWorkspace(ws("ws-cache"));
    useWorkspaceStore.setState({ loadedForUserId: "u-test", activeWorkspaceId: "ws-cache" });

    setNavigatorOnline(false);
    await useWorkspaceStore.getState().loadWorkspaces("u-test");

    const state = useWorkspaceStore.getState();
    assert.equal(state.workspaces.length, 1);
    assert.equal(state.activeWorkspaceId, "ws-cache");
  });
});
