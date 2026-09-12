import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useWorkspaceStore } from "./useWorkspaceStore.ts";

beforeEach(() => {
  const state = useWorkspaceStore.getState();
  for (const ws of state.workspaces) {
    if (ws.id !== "default") state.removeWorkspace(ws.id);
  }
  state.setActiveWorkspace("default");
});

describe("workspace por defecto", () => {
  it("existe un workspace default con id 'default'", () => {
    const ws = useWorkspaceStore.getState().getActiveWorkspace();
    assert.ok(ws);
    assert.equal(ws.id, "default");
    assert.equal(ws.name, "General");
  });

  it("workspace default tiene módulos expenses y reports", () => {
    const ws = useWorkspaceStore.getState().getActiveWorkspace();
    assert.ok(ws);
    assert.deepEqual(ws.modules, ["expenses", "reports"]);
  });
});

describe("addWorkspace", () => {
  it("agrega un workspace al array", () => {
    const ws = {
      id: "ws-tailoring",
      name: "Taller",
      model: "tailoring" as const,
      modules: ["tailoring"],
      createdAt: "2026-08-14T10:00:00.000Z",
    };
    useWorkspaceStore.getState().addWorkspace(ws);
    const all = useWorkspaceStore.getState().workspaces;
    assert.equal(all.length, 2);
    assert.equal(all[1].id, "ws-tailoring");
  });
});

describe("removeWorkspace", () => {
  it("elimina un workspace por id", () => {
    const store = useWorkspaceStore.getState();
    store.addWorkspace({
      id: "ws-temp",
      name: "Temporal",
      model: "general",
      modules: [],
      createdAt: "2026-08-14T10:00:00.000Z",
    });
    assert.equal(useWorkspaceStore.getState().workspaces.length, 2);

    useWorkspaceStore.getState().removeWorkspace("ws-temp");
    const all = useWorkspaceStore.getState().workspaces;
    assert.equal(all.length, 1);
    assert.equal(all[0].id, "default");
  });

  it("cambia workspace activo si se elimina el activo", () => {
    const store = useWorkspaceStore.getState();
    store.addWorkspace({
      id: "ws-temp",
      name: "Temporal",
      model: "general",
      modules: [],
      createdAt: "2026-08-14T10:00:00.000Z",
    });
    useWorkspaceStore.getState().setActiveWorkspace("ws-temp");
    useWorkspaceStore.getState().removeWorkspace("ws-temp");

    const activeId = useWorkspaceStore.getState().activeWorkspaceId;
    assert.equal(activeId, "default");
  });
});

describe("setActiveWorkspace", () => {
  it("establece activeWorkspaceId", () => {
    const store = useWorkspaceStore.getState();
    store.addWorkspace({
      id: "ws-two",
      name: "Dos",
      model: "general",
      modules: [],
      createdAt: "2026-08-14T10:00:00.000Z",
    });
    useWorkspaceStore.getState().setActiveWorkspace("ws-two");
    const ws = useWorkspaceStore.getState().getActiveWorkspace();
    assert.ok(ws);
    assert.equal(ws.id, "ws-two");
  });
});

describe("enableModule", () => {
  it("agrega un módulo al workspace", () => {
    useWorkspaceStore.getState().enableModule("default", "purchases");
    const ws = useWorkspaceStore.getState().getActiveWorkspace();
    assert.ok(ws);
    assert.ok(ws.modules.includes("purchases"));
  });

  it("no duplica un módulo ya existente", () => {
    useWorkspaceStore.getState().enableModule("default", "expenses");
    useWorkspaceStore.getState().enableModule("default", "expenses");
    const ws = useWorkspaceStore.getState().getActiveWorkspace();
    assert.ok(ws);
    const count = ws.modules.filter((m) => m === "expenses").length;
    assert.equal(count, 1);
  });
});

describe("disableModule", () => {
  it("elimina un módulo del workspace", () => {
    useWorkspaceStore.getState().enableModule("default", "purchases");
    useWorkspaceStore.getState().disableModule("default", "purchases");
    const ws = useWorkspaceStore.getState().getActiveWorkspace();
    assert.ok(ws);
    assert.equal(ws.modules.includes("purchases"), false);
  });
});

describe("getActiveWorkspace", () => {
  it("retorna el workspace que coincide con activeWorkspaceId", () => {
    useWorkspaceStore.getState().setActiveWorkspace("default");
    const ws = useWorkspaceStore.getState().getActiveWorkspace();
    assert.ok(ws);
    assert.equal(ws.id, "default");
  });

  it("retorna undefined si activeWorkspaceId no coincide", () => {
    useWorkspaceStore.getState().setActiveWorkspace("no-existe");
    const ws = useWorkspaceStore.getState().getActiveWorkspace();
    assert.equal(ws, undefined);
  });
});

describe("isModuleEnabled", () => {
  it("retorna true si el módulo está en el workspace activo", () => {
    useWorkspaceStore.getState().setActiveWorkspace("default");
    assert.equal(useWorkspaceStore.getState().isModuleEnabled("expenses"), true);
  });

  it("retorna false si el módulo no está en el workspace activo", () => {
    useWorkspaceStore.getState().setActiveWorkspace("default");
    assert.equal(useWorkspaceStore.getState().isModuleEnabled("tailoring"), false);
  });

  it("retorna false si no hay workspace activo", () => {
    useWorkspaceStore.getState().setActiveWorkspace("no-existe");
    assert.equal(useWorkspaceStore.getState().isModuleEnabled("expenses"), false);
  });
});

describe("aislamiento entre workspaces", () => {
  it("habilitar módulo en un workspace no afecta al otro", () => {
    const store = useWorkspaceStore.getState();
    store.addWorkspace({
      id: "ws-b",
      name: "B",
      model: "tailoring",
      modules: ["tailoring"],
      createdAt: "2026-08-14T10:00:00.000Z",
    });

    store.enableModule("default", "purchases");
    store.enableModule("ws-b", "tailoring");

    const wsA = useWorkspaceStore.getState().workspaces.find((w) => w.id === "default");
    const wsB = useWorkspaceStore.getState().workspaces.find((w) => w.id === "ws-b");

    assert.ok(wsA);
    assert.ok(wsB);
    assert.ok(wsA.modules.includes("purchases"));
    assert.ok(!wsA.modules.includes("tailoring"));
    assert.ok(wsB.modules.includes("tailoring"));
    assert.ok(!wsB.modules.includes("purchases"));
  });
});
