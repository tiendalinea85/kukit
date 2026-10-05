import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../db.ts";
import { runPull } from "./pull.ts";
import type { SyncTransportEntity } from "../../types/sync.ts";
import type { Product } from "../../types/index.ts";

// El servidor de products no tiene columna `category_id`: la fila remota llega
// sin ella. El pull no debe borrar la categoría que solo existe en Dexie.

const WS = "default";

function productsTransport(
  rows: Array<Record<string, unknown>>,
  localOnlyFields?: string[],
): SyncTransportEntity[] {
  return [
    {
      name: "products",
      serverTable: "products",
      order: 1,
      ...(localOnlyFields ? { localOnlyFields } : {}),
      async push() {
        return null;
      },
      async pull() {
        return { rows, watermark: null };
      },
    },
  ];
}

async function seedProduct(overrides: Partial<Product> = {}): Promise<void> {
  const base: Product = {
    id: "p1",
    workspaceId: WS,
    code: "P001",
    name: "Camisa",
    color: "rojo",
    categoryId: "cat-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deleted: false,
    syncStatus: "synced",
    revision: 1,
  };
  await db.products.put({ ...base, ...overrides });
}

function remoteProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "p1",
    workspaceId: WS,
    code: "P001",
    name: "Camisa manga larga",
    color: "azul",
    categoryId: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    deleted: false,
    revision: 2,
    ...overrides,
  };
}

beforeEach(async () => {
  await db.products.clear();
  await db.syncState.clear();
  await db.syncLog.clear();
});

describe("Pull: campos locales que el servidor no almacena", () => {
  it("keeps local categoryId when the remote row wins", async () => {
    await seedProduct();
    const result = await runPull(productsTransport([remoteProduct()], ["categoryId"]));

    const row = await db.products.get("p1");
    assert.equal(result.updated, 1);
    assert.equal(row?.categoryId, "cat-1");
    assert.equal(row?.name, "Camisa manga larga");
  });

  it("applies remote values to synced fields", async () => {
    await seedProduct();
    await runPull(productsTransport([remoteProduct()], ["categoryId"]));

    const row = await db.products.get("p1");
    assert.equal(row?.color, "azul");
    assert.equal(row?.revision, 2);
    assert.equal(row?.syncStatus, "synced");
  });

  it("does not preserve anything when the entity declares no local fields", async () => {
    await seedProduct();
    await runPull(productsTransport([remoteProduct()]));

    const row = await db.products.get("p1");
    assert.equal(row?.categoryId, "");
    assert.equal(row?.name, "Camisa manga larga");
  });

  it("keeps local row when it still has pending changes", async () => {
    await seedProduct({ name: "Camisa local", syncStatus: "pending" });
    await runPull(productsTransport([remoteProduct()], ["categoryId"]));

    const row = await db.products.get("p1");
    assert.equal(row?.name, "Camisa local");
    assert.equal(row?.categoryId, "cat-1");
  });

  it("inserts remote rows without local data as they come", async () => {
    await runPull(productsTransport([remoteProduct({ id: "p2" })], ["categoryId"]));

    const row = await db.products.get("p2");
    assert.equal(row?.id, "p2");
    assert.equal(row?.categoryId, "");
  });
});

// Aislamiento por workspace: el workspace de una fila lo decide el servidor.
// Si la fila remota no lo trae (tabla sin `workspace_id`), el pull NO puede
// inventar el workspace activo: eso mete gastos de un workspace en otro.

describe("Pull: workspace de la fila remota", () => {
  it("aplica el workspace que envía el servidor", async () => {
    await seedProduct({ syncStatus: "synced" });
    await runPull(productsTransport([remoteProduct({ workspaceId: "ws-b" })]));

    const row = await db.products.get("p1");
    assert.equal(row?.workspaceId, "ws-b");
  });

  it("conserva el workspace local si la fila remota no lo trae", async () => {
    await seedProduct({ workspaceId: "ws-a", syncStatus: "synced" });
    await runPull(productsTransport([remoteProduct({ workspaceId: "" })]));

    const row = await db.products.get("p1");
    assert.equal(row?.workspaceId, "ws-a");
    assert.equal(row?.name, "Camisa manga larga");
  });

  it("no atribuye a ningún workspace una fila nueva sin workspace", async () => {
    await runPull(productsTransport([remoteProduct({ id: "p3", workspaceId: "" })]));

    const row = await db.products.get("p3");
    assert.equal(row?.workspaceId, "");
  });
});
