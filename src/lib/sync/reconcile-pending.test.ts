import "fake-indexeddb/auto";
import { describe, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { claimNextBatch, enqueueOperation, reconcilePendingEntities } from "./outbox.ts";
import type { Sale, SaleDetail, Purchase, PurchaseDetail, Product, Category } from "../../types/index.ts";

const T0 = "2026-01-01T00:00:00.000Z";

function base<T extends Record<string, unknown>>(overrides: T): T & {
  id: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: string;
} {
  return {
    id: crypto.randomUUID(),
    createdAt: T0,
    updatedAt: T0,
    deleted: false,
    syncStatus: "pending",
    ...overrides,
  } as T & {
    id: string;
    createdAt: string;
    updatedAt: string;
    deleted: boolean;
    syncStatus: string;
  };
}

describe("reconcilePendingEntities (fix C1: ventas/compras/productos pendientes)", () => {
  beforeEach(async () => {
    await Promise.all([
      db.sales.clear(),
      db.saleDetails.clear(),
      db.purchases.clear(),
      db.purchaseDetails.clear(),
      db.products.clear(),
      db.customers.clear(),
      db.categories.clear(),
      db.syncOutbox.clear(),
      db.syncLog.clear(),
    ]);
  });

  it("encola en el outbox todo registro creado con syncStatus pending", async () => {
    const sale = base({
      code: "V-0001",
      customerId: null,
      date: "2026-01-01",
      time: "10:00",
      paymentMethod: "efectivo",
      status: "completada",
      total: 20,
    }) as unknown as Sale;
    const detail = base({ saleId: sale.id, productId: "p1", quantity: 2, unitPrice: 10, subtotal: 20 }) as unknown as SaleDetail;
    const purchase = base({
      code: "C-0001",
      supplier: "A",
      date: "2026-01-01",
      paymentMethod: "efectivo",
      status: "recibida",
      total: 30,
    }) as unknown as Purchase;
    const purchaseDetail = base({ purchaseId: purchase.id, productId: "p2", quantity: 3, unitPrice: 10, subtotal: 30 }) as unknown as PurchaseDetail;
    const product = base({ code: "P-001", name: "Tela", salePrice: 5 }) as unknown as Product;
    const category = base({ name: "Insumos", color: "#fff", icon: "📦" }) as unknown as Category;

    await db.sales.add(sale);
    await db.saleDetails.add(detail);
    await db.purchases.add(purchase);
    await db.purchaseDetails.add(purchaseDetail);
    await db.products.add(product);
    await db.categories.add(category);

    const enqueued = await reconcilePendingEntities(T0);
    assert.equal(enqueued, 6);
    const ops = await db.syncOutbox.toArray();
    const entities = ops.map((op) => op.entity).sort();
    assert.deepEqual(entities, [
      "categories",
      "products",
      "purchaseDetails",
      "purchases",
      "saleDetails",
      "sales",
    ].sort());
  });

  it("no duplica operaciones ya encoladas", async () => {
    const sale = base({
      code: "V-0002",
      customerId: null,
      date: "2026-01-01",
      time: "10:00",
      paymentMethod: "efectivo",
      status: "completada",
      total: 20,
    }) as unknown as Sale;
    await db.sales.add(sale);

    const first = await reconcilePendingEntities(T0);
    const second = await reconcilePendingEntities(T0);

    assert.equal(first, 1);
    assert.equal(second, 0);
    assert.equal(await db.syncOutbox.count(), 1);
  });
});

describe("claimNextBatch ordena por dependencias FK (padre antes que hijo)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.sales.clear(), db.saleDetails.clear(), db.products.clear()]);
  });

  it("saca productos y ventas antes que los detalles, aunque el detalle sea más antiguo", async () => {
    const sale = base({
      code: "V-0003",
      customerId: null,
      date: "2026-01-01",
      time: "10:00",
      paymentMethod: "efectivo",
      status: "completada",
      total: 20,
    });
    const detail = base({ saleId: sale.id, productId: "p1", quantity: 2, unitPrice: 10, subtotal: 20 }) as unknown as SaleDetail;

    await db.products.add(base({ code: "P-002", name: "Tela", salePrice: 5 }) as unknown as Product);
    await db.sales.add(sale as unknown as Sale);
    await db.saleDetails.add(detail);

    await reconcilePendingEntities(T0);
    const claimed = await claimNextBatch(10, T0);

    const order = claimed.map((op) => op.entity);
    assert.ok(order.indexOf("products") < order.indexOf("sales"));
    assert.ok(order.indexOf("sales") < order.indexOf("saleDetails"));
    assert.deepEqual(order, ["products", "sales", "saleDetails"]);
  });

  it("respeta antigüedad dentro de la misma entidad", async () => {
    await enqueueOperation({
      entity: "expenses",
      entityId: "e-2",
      op: "upsert",
      payload: { id: "e-2" },
      now: "2026-01-01T01:00:00.000Z",
    });
    await enqueueOperation({
      entity: "expenses",
      entityId: "e-1",
      op: "upsert",
      payload: { id: "e-1" },
      now: T0,
    });

    const claimed = await claimNextBatch(10, T0);
    assert.deepEqual(claimed.map((op) => op.entityId), ["e-1", "e-2"]);
  });
});
