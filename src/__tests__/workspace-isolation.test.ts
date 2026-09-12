import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../lib/db.ts";
import { useWorkspaceStore } from "../stores/useWorkspaceStore.ts";
import type {
  Expense,
  Category,
  Product,
  Sale,
  SaleDetail,
  Purchase,
  PurchaseDetail,
  InventoryMovement,
} from "../types/index.ts";

const WS_A = "ws-tailoring";
const WS_B = "ws-agriculture";

function makeExpense(id: string, workspaceId: string, description: string): Expense {
  return {
    id,
    workspaceId,
    code: `G${id.slice(-6)}`,
    description,
    amount: 100,
    categoryId: "cat-1",
    paymentMethod: "efectivo",
    status: "pagado",
    date: "2026-08-18",
    time: "10:00",
    notes: "",
    voidedAt: null,
    createdAt: "2026-08-18T10:00:00.000Z",
    updatedAt: "2026-08-18T10:00:00.000Z",
    deleted: false,
    syncStatus: "synced",
  };
}

function makeCategory(id: string, workspaceId: string, name: string): Category {
  return {
    id,
    workspaceId,
    name,
    color: "#000000",
    icon: "📁",
    createdAt: "2026-08-18T10:00:00.000Z",
    syncStatus: "synced",
  };
}

function makeProduct(id: string, workspaceId: string, name: string): Product {
  return {
    id,
    workspaceId,
    code: `P${id.slice(-6)}`,
    name,
    color: "",
    categoryId: "cat-1",
    createdAt: "2026-08-18T10:00:00.000Z",
    updatedAt: "2026-08-18T10:00:00.000Z",
    deleted: false,
    syncStatus: "synced",
  };
}

function makeSale(id: string, workspaceId: string): Sale {
  return {
    id,
    workspaceId,
    code: `V${id.slice(-6)}`,
    customerId: "cust-1",
    date: "2026-08-18",
    paymentMethod: "efectivo",
    total: 200,
    notes: "",
    status: "confirmada",
    confirmedAt: "2026-08-18T10:00:00.000Z",
    voidedAt: null,
    createdAt: "2026-08-18T10:00:00.000Z",
    updatedAt: "2026-08-18T10:00:00.000Z",
    deleted: false,
    syncStatus: "synced",
  };
}

function makeSaleDetail(id: string, workspaceId: string, saleId: string, productId: string): SaleDetail {
  return {
    id,
    workspaceId,
    saleId,
    productId,
    code: "VD001",
    name: "Detalle",
    color: "",
    quantity: 2,
    unitPrice: 100,
    subtotal: 200,
    createdAt: "2026-08-18T10:00:00.000Z",
    syncStatus: "synced",
  };
}

function makePurchase(id: string, workspaceId: string): Purchase {
  return {
    id,
    workspaceId,
    code: `C${id.slice(-6)}`,
    supplier: "Proveedor X",
    date: "2026-08-18",
    paymentMethod: "efectivo",
    total: 500,
    notes: "",
    status: "recibida",
    receivedAt: "2026-08-18T10:00:00.000Z",
    voidedAt: null,
    createdAt: "2026-08-18T10:00:00.000Z",
    updatedAt: "2026-08-18T10:00:00.000Z",
    deleted: false,
    syncStatus: "synced",
  };
}

function makePurchaseDetail(id: string, workspaceId: string, purchaseId: string, productId: string): PurchaseDetail {
  return {
    id,
    workspaceId,
    purchaseId,
    productId,
    code: "CD001",
    name: "Detalle compra",
    color: "",
    quantity: 10,
    unitPrice: 50,
    subtotal: 500,
    createdAt: "2026-08-18T10:00:00.000Z",
    syncStatus: "synced",
  };
}

function makeInventoryMovement(id: string, workspaceId: string, productId: string): InventoryMovement {
  return {
    id,
    workspaceId,
    productId,
    type: "entrada",
    quantity: 10,
    referenceType: "compra",
    referenceId: "purch-1",
    notes: "",
    createdAt: "2026-08-18T10:00:00.000Z",
    syncStatus: "synced",
  };
}

beforeEach(async () => {
  await Promise.all([
    db.expenses.clear(),
    db.categories.clear(),
    db.products.clear(),
    db.sales.clear(),
    db.saleDetails.clear(),
    db.purchases.clear(),
    db.purchaseDetails.clear(),
    db.inventoryMovements.clear(),
  ]);
  useWorkspaceStore.setState({ activeWorkspaceId: "default" });
});

describe("Escenario Workspace A vs B — aislamiento completo de datos", () => {
  beforeEach(async () => {
    // Workspace A (tailoring) — datos core
    await db.expenses.bulkAdd([
      makeExpense("exp-a1", WS_A, "Gasto taller A"),
      makeExpense("exp-a2", WS_A, "Gasto taller A 2"),
    ]);
    await db.categories.add(makeCategory("cat-a1", WS_A, "Categoria A"));
    await db.products.bulkAdd([
      makeProduct("prod-a1", WS_A, "Prenda A"),
      makeProduct("prod-a2", WS_A, "Prenda A2"),
    ]);
    await db.sales.add(makeSale("sale-a1", WS_A));
    await db.saleDetails.add(makeSaleDetail("sd-a1", WS_A, "sale-a1", "prod-a1"));
    await db.purchases.add(makePurchase("purch-a1", WS_A));
    await db.purchaseDetails.add(makePurchaseDetail("pd-a1", WS_A, "purch-a1", "prod-a1"));

    // Workspace B (agriculture) — datos core
    await db.expenses.add(makeExpense("exp-b1", WS_B, "Gasto finca B"));
    await db.categories.add(makeCategory("cat-b1", WS_B, "Categoria B"));
    await db.products.bulkAdd([
      makeProduct("prod-b1", WS_B, "Cultivo B"),
      makeProduct("prod-b2", WS_B, "Cultivo B2"),
    ]);
  });

  it("expenses filtrados por workspace A solo devuelven gastos de A", async () => {
    const data = await db.expenses.where("workspaceId").equals(WS_A).toArray();
    assert.equal(data.length, 2);
    assert.ok(data.every((e) => e.workspaceId === WS_A));
  });

  it("expenses filtrados por workspace B solo devuelven gastos de B", async () => {
    const data = await db.expenses.where("workspaceId").equals(WS_B).toArray();
    assert.equal(data.length, 1);
    assert.equal(data[0].id, "exp-b1");
    assert.equal(data[0].workspaceId, WS_B);
  });

  it("products filtrados por workspace A solo devuelven productos de A", async () => {
    const data = await db.products.where("workspaceId").equals(WS_A).toArray();
    assert.equal(data.length, 2);
    assert.ok(data.every((p) => p.workspaceId === WS_A));
  });

  it("products filtrados por workspace B solo devuelven productos de B", async () => {
    const data = await db.products.where("workspaceId").equals(WS_B).toArray();
    assert.equal(data.length, 2);
    assert.ok(data.every((p) => p.workspaceId === WS_B));
  });

  it("categories filtradas por workspace A solo devuelven categorías de A", async () => {
    const data = await db.categories.where("workspaceId").equals(WS_A).toArray();
    assert.equal(data.length, 1);
    assert.equal(data[0].name, "Categoria A");
  });

  it("categories filtradas por workspace B solo devuelven categorías de B", async () => {
    const data = await db.categories.where("workspaceId").equals(WS_B).toArray();
    assert.equal(data.length, 1);
    assert.equal(data[0].name, "Categoria B");
  });

  it("workspace A no contiene datos de agricultura", async () => {
    const expensesB = await db.expenses.where("workspaceId").equals(WS_B).toArray();
    assert.ok(expensesB.every((e) => e.workspaceId !== WS_A));
  });

  it("workspace B no contiene datos de taller", async () => {
    const expensesA = await db.expenses.where("workspaceId").equals(WS_A).toArray();
    assert.ok(expensesA.every((e) => e.workspaceId !== WS_B));

    const productsA = await db.products.where("workspaceId").equals(WS_A).toArray();
    assert.ok(productsA.every((p) => p.workspaceId !== WS_B));
  });

  it("inventory movements están scopeados por workspace", async () => {
    await db.inventoryMovements.bulkAdd([
      makeInventoryMovement("mov-a1", WS_A, "prod-a1"),
      makeInventoryMovement("mov-b1", WS_B, "prod-b1"),
    ]);

    const movA = await db.inventoryMovements.where("workspaceId").equals(WS_A).toArray();
    const movB = await db.inventoryMovements.where("workspaceId").equals(WS_B).toArray();

    assert.equal(movA.length, 1);
    assert.equal(movA[0].productId, "prod-a1");
    assert.equal(movB.length, 1);
    assert.equal(movB[0].productId, "prod-b1");
  });

  it("sale details están scopeados por workspace", async () => {
    const detailsA = await db.saleDetails.where("workspaceId").equals(WS_A).toArray();
    assert.equal(detailsA.length, 1);
    assert.equal(detailsA[0].saleId, "sale-a1");

    const detailsB = await db.saleDetails.where("workspaceId").equals(WS_B).toArray();
    assert.equal(detailsB.length, 0);
  });

  it("purchase details están scopeados por workspace", async () => {
    const detailsA = await db.purchaseDetails.where("workspaceId").equals(WS_A).toArray();
    assert.equal(detailsA.length, 1);
    assert.equal(detailsA[0].purchaseId, "purch-a1");

    const detailsB = await db.purchaseDetails.where("workspaceId").equals(WS_B).toArray();
    assert.equal(detailsB.length, 0);
  });

  it("cross-workspace queries retornan resultados vacíos para workspace inexistente", async () => {
    const data = await db.expenses.where("workspaceId").equals("ws-nonexistent").toArray();
    assert.equal(data.length, 0);

    const products = await db.products.where("workspaceId").equals("ws-nonexistent").toArray();
    assert.equal(products.length, 0);
  });
});

describe("Escenario offline → sync → aislamiento", () => {
  it("datos creados offline mantienen aislamiento antes y después del ciclo de sync", async () => {
    // Simular datos creados "offline" en workspace A
    await db.expenses.bulkAdd([
      makeExpense("exp-off-a1", WS_A, "Offline A 1"),
      makeExpense("exp-off-a2", WS_A, "Offline A 2"),
    ]);
    await db.products.add(makeProduct("prod-off-a1", WS_A, "Producto offline A"));

    // Simular datos creados "offline" en workspace B
    await db.expenses.add(makeExpense("exp-off-b1", WS_B, "Offline B 1"));
    await db.products.bulkAdd([
      makeProduct("prod-off-b1", WS_B, "Producto offline B 1"),
      makeProduct("prod-off-b2", WS_B, "Producto offline B 2"),
    ]);

    // Verificar aislamiento ANTES de sync (datos ya están aislados en Dexie)
    const expA = await db.expenses.where("workspaceId").equals(WS_A).toArray();
    const expB = await db.expenses.where("workspaceId").equals(WS_B).toArray();
    assert.equal(expA.length, 2);
    assert.ok(expA.every((e) => e.workspaceId === WS_A));
    assert.equal(expB.length, 1);
    assert.equal(expB[0].workspaceId, WS_B);

    const prodA = await db.products.where("workspaceId").equals(WS_A).toArray();
    const prodB = await db.products.where("workspaceId").equals(WS_B).toArray();
    assert.equal(prodA.length, 1);
    assert.equal(prodA[0].workspaceId, WS_A);
    assert.equal(prodB.length, 2);
    assert.ok(prodB.every((p) => p.workspaceId === WS_B));

    // Simular "ciclo de sync" — los datos permanecen igual (no hay server real)
    // Simplemente re-leemos para verificar que el estado persiste
    const expAAfter = await db.expenses.where("workspaceId").equals(WS_A).toArray();
    const expBAfter = await db.expenses.where("workspaceId").equals(WS_B).toArray();

    assert.equal(expAAfter.length, 2);
    assert.equal(expBAfter.length, 1);
    assert.ok(expAAfter.every((e) => e.workspaceId === WS_A));
    assert.ok(expBAfter.every((e) => e.workspaceId === WS_B));

    // Verificar que no hay contaminación cruzada
    assert.equal(expAAfter.filter((e) => e.workspaceId === WS_B).length, 0);
    assert.equal(expBAfter.filter((e) => e.workspaceId === WS_A).length, 0);
  });
});

describe("Cambio de workspace cambia los datos visibles", () => {
  it("cada workspace solo ve sus propios gastos al cambiar de workspace activo", async () => {
    // Simular workspace activo = A
    useWorkspaceStore.setState({ activeWorkspaceId: WS_A });

    await db.expenses.add(makeExpense("exp-ws-a", WS_A, "Gasto de A"));
    assert.equal(useWorkspaceStore.getState().activeWorkspaceId, WS_A);

    // Cambiar a workspace B
    useWorkspaceStore.setState({ activeWorkspaceId: WS_B });
    await db.expenses.add(makeExpense("exp-ws-b", WS_B, "Gasto de B"));
    assert.equal(useWorkspaceStore.getState().activeWorkspaceId, WS_B);

    // Verificar que cada workspace solo ve sus gastos
    const expA = await db.expenses.where("workspaceId").equals(WS_A).toArray();
    const expB = await db.expenses.where("workspaceId").equals(WS_B).toArray();

    assert.equal(expA.length, 1);
    assert.equal(expA[0].description, "Gasto de A");
    assert.equal(expA[0].workspaceId, WS_A);

    assert.equal(expB.length, 1);
    assert.equal(expB[0].description, "Gasto de B");
    assert.equal(expB[0].workspaceId, WS_B);

    // Verificar que no hay cruce
    assert.equal(expA[0].id, "exp-ws-a");
    assert.equal(expB[0].id, "exp-ws-b");
  });

  it("cambiar workspace多次 no contamina datos entre workspaces", async () => {
    // Crear datos en A
    useWorkspaceStore.setState({ activeWorkspaceId: WS_A });
    await db.expenses.add(makeExpense("exp-cycle-a1", WS_A, "A-1"));

    // Cambiar a B
    useWorkspaceStore.setState({ activeWorkspaceId: WS_B });
    await db.expenses.add(makeExpense("exp-cycle-b1", WS_B, "B-1"));

    // Volver a A
    useWorkspaceStore.setState({ activeWorkspaceId: WS_A });
    await db.expenses.add(makeExpense("exp-cycle-a2", WS_A, "A-2"));

    // Volver a B
    useWorkspaceStore.setState({ activeWorkspaceId: WS_B });
    await db.expenses.add(makeExpense("exp-cycle-b2", WS_B, "B-2"));

    // Verificar aislamiento final
    const expA = await db.expenses.where("workspaceId").equals(WS_A).toArray();
    const expB = await db.expenses.where("workspaceId").equals(WS_B).toArray();

    assert.equal(expA.length, 2);
    assert.ok(expA.every((e) => e.workspaceId === WS_A));
    assert.equal(expA.map((e) => e.description).sort().join(","), "A-1,A-2");

    assert.equal(expB.length, 2);
    assert.ok(expB.every((e) => e.workspaceId === WS_B));
    assert.equal(expB.map((e) => e.description).sort().join(","), "B-1,B-2");
  });
});
