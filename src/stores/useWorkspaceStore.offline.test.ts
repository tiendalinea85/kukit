import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { useWorkspaceStore } from "./useWorkspaceStore.ts";

// En Node no existe navigator; lo simulamos para el fast-path offline.
function setNavigatorOnline(online: boolean): void {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: online },
    configurable: true,
  });
}

describe("useWorkspaceStore offline-first", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().resetWorkspaces();
    useWorkspaceStore.setState({
      workspaces: [],
      loadedForUserId: null,
      activeWorkspaceId: null,
    });
  });

  afterEach(() => {
    delete (globalThis as { navigator?: unknown }).navigator;
  });

  it("entra con la cache local sin red (no cuelga la UI)", async () => {
    const ws = {
      id: "ws-1",
      name: "Mi negocio",
      model: "commerce" as const,
      modules: ["expenses", "reports"],
      categoryId: "negocio",
      createdAt: "2026-09-16T10:00:00.000Z",
    };
    useWorkspaceStore.getState().addWorkspace(ws);
    useWorkspaceStore.setState({ activeWorkspaceId: "ws-1", loadedForUserId: "u-test" });

    setNavigatorOnline(false);

    await useWorkspaceStore.getState().loadWorkspaces("u-test");

    const state = useWorkspaceStore.getState();
    assert.equal(state.loadingWorkspaces, false);
    assert.equal(state.workspaces.length, 1);
    assert.equal(state.activeWorkspaceId, "ws-1");
  });

  it("no usa la cache de otro usuario", async () => {
    const ws = {
      id: "ws-1",
      name: "Mi negocio",
      model: "commerce" as const,
      modules: ["expenses", "reports"],
      categoryId: "negocio",
      createdAt: "2026-09-16T10:00:00.000Z",
    };
    useWorkspaceStore.getState().addWorkspace(ws);
    useWorkspaceStore.setState({ loadedForUserId: "u-otro" });

    setNavigatorOnline(false);

    await useWorkspaceStore.getState().loadWorkspaces("u-test");
    assert.equal(useWorkspaceStore.getState().loadingWorkspaces, false);
  });
});