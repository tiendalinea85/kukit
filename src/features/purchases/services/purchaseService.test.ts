import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../../../lib/db.ts";
import {
  createPurchase,
  receivePurchase,
  updatePurchase,
  voidPurchase,
  deletePurchase,
} from "./purchaseService.ts";
import { createProduct } from "../../sales/services/productService.ts";
import type { PurchaseDetailInput } from "../domain/purchaseRules.ts";

function makeDetail(productId: string): PurchaseDetailInput {
  return {
    productId,
    code: "PRD-001",
    name: "Tejido algodón",
    color: "azul",
    quantity: 10,
    unitPrice: 25,
  };
}

const header = {
  supplier: "Distribuidora Textil SAC",
  date: "2026-08-15",
  paymentMethod: "transferencia" as const,
  notes: "Pedido mensual",
  status: "pendiente" as const,
};

beforeEach(async () => {
  await db.open();
  await db.inventoryMovements.clear();
  await db.purchaseDetails.clear();
  await db.purchases.clear();
  await db.products.clear();
});

describe("createPurchase", () => {
  it("crea una compra con código generado y status pendiente por defecto", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase({
      header,
      details: [makeDetail(product.id)],
    });
    assert.match(purchase.code, /^C\d{6}$/);
    assert.equal(purchase.status, "pendiente");
    assert.equal(purchase.supplier, "Distribuidora Textil SAC");
    assert.equal(purchase.syncStatus, "pending");
    assert.equal(purchase.deleted, false);
  });

  it("crea detalles en purchaseDetails", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    await createPurchase({
      header,
      details: [makeDetail(product.id)],
    });
    const details = await db.purchaseDetails.toArray();
    assert.equal(details.length, 1);
    assert.equal(details[0].productId, product.id);
    assert.equal(details[0].quantity, 10);
    assert.equal(details[0].unitPrice, 25);
    assert.equal(details[0].subtotal, 250);
  });

  it("createPurchase con receive=true crea movimientos ENTRADA", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    await createPurchase(
      { header, details: [makeDetail(product.id)] },
      { receive: true },
    );
    const purchase = await db.purchases.toArray();
    assert.equal(purchase[0].status, "recibida");
    const movements = await db.inventoryMovements.where("productId").equals(product.id).toArray();
    assert.equal(movements.length, 1);
    assert.equal(movements[0].type, "entrada");
    assert.equal(movements[0].quantity, 10);
    assert.equal(movements[0].referenceType, "compra");
  });

  it("transacción es atómica: compra y detalles se crean juntos", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase({
      header,
      details: [makeDetail(product.id)],
    });
    const details = await db.purchaseDetails.where("purchaseId").equals(purchase.id).toArray();
    assert.equal(details.length, 1);
    assert.equal(details[0].purchaseId, purchase.id);
  });

  it("crea compra con total calculado desde detalles", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase({
      header,
      details: [
        { ...makeDetail(product.id), quantity: 10, unitPrice: 25 },
        { ...makeDetail(product.id), quantity: 5, unitPrice: 50 },
      ],
    });
    assert.equal(purchase.total, 250 + 250);
  });
});

describe("receivePurchase", () => {
  it("cambia status a recibida y crea movimientos ENTRADA", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase({
      header,
      details: [makeDetail(product.id)],
    });
    await receivePurchase(purchase.id);
    const received = await db.purchases.get(purchase.id);
    assert.equal(received!.status, "recibida");
    assert.ok(received!.receivedAt);
    const movements = await db.inventoryMovements.where("productId").equals(product.id).toArray();
    assert.equal(movements.length, 1);
    assert.equal(movements[0].type, "entrada");
  });

  it("lanza error cuando la compra no existe", async () => {
    await assert.rejects(
      receivePurchase("id-falso"),
      /no encontrada/i,
    );
  });

  it("lanza error cuando la compra no está pendiente", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase(
      { header, details: [makeDetail(product.id)] },
      { receive: true },
    );
    await assert.rejects(
      receivePurchase(purchase.id),
      /pendientes/i,
    );
  });
});

describe("voidPurchase", () => {
  it("anula una compra recibida creando movimientos SALIDA compensatorios", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase(
      { header, details: [makeDetail(product.id)] },
      { receive: true },
    );
    await voidPurchase(purchase.id);
    const voided = await db.purchases.get(purchase.id);
    assert.equal(voided!.status, "anulada");
    assert.ok(voided!.voidedAt);
    const movements = await db.inventoryMovements.where("productId").equals(product.id).toArray();
    const salida = movements.filter((m) => m.type === "salida");
    assert.equal(salida.length, 1);
    assert.equal(salida[0].referenceType, "anulacion_compra");
  });

  it("anula una compra pendiente sin crear movimientos de inventario", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase({
      header,
      details: [makeDetail(product.id)],
    });
    await voidPurchase(purchase.id);
    const movements = await db.inventoryMovements.toArray();
    assert.equal(movements.length, 0);
    const voided = await db.purchases.get(purchase.id);
    assert.equal(voided!.status, "anulada");
  });

  it("lanza error cuando la compra ya está anulada", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase({
      header,
      details: [makeDetail(product.id)],
    });
    await voidPurchase(purchase.id);
    await assert.rejects(
      voidPurchase(purchase.id),
      /ya está anulada/i,
    );
  });

  it("lanza error cuando la compra no existe", async () => {
    await assert.rejects(
      voidPurchase("id-falso"),
      /no encontrada/i,
    );
  });
});

describe("updatePurchase", () => {
  it("actualiza campos solo cuando la compra está pendiente", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase({
      header,
      details: [makeDetail(product.id)],
    });
    await updatePurchase(purchase.id, {
      header: { ...header, supplier: "Nuevo proveedor" },
      details: [{ ...makeDetail(product.id), quantity: 20 }],
    });
    const updated = await db.purchases.get(purchase.id);
    assert.equal(updated!.supplier, "Nuevo proveedor");
    assert.equal(updated!.total, 20 * 25);
  });

  it("reemplaza detalles existentes", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase({
      header,
      details: [makeDetail(product.id)],
    });
    const product2 = await createProduct({ code: "PRD-002", name: "Seda" });
    await updatePurchase(purchase.id, {
      header,
      details: [makeDetail(product2.id)],
    });
    const details = await db.purchaseDetails.where("purchaseId").equals(purchase.id).toArray();
    assert.equal(details.length, 1);
    assert.equal(details[0].productId, product2.id);
  });

  it("lanza error cuando la compra no existe", async () => {
    await assert.rejects(
      updatePurchase("id-falso", { header, details: [] }),
      /no encontrada/i,
    );
  });

  it("lanza error cuando la compra está recibida", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase(
      { header, details: [makeDetail(product.id)] },
      { receive: true },
    );
    await assert.rejects(
      updatePurchase(purchase.id, { header, details: [] }),
      /pendientes/i,
    );
  });
});

describe("deletePurchase", () => {
  it("marca deleted en true (soft delete)", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const purchase = await createPurchase({
      header,
      details: [makeDetail(product.id)],
    });
    await deletePurchase(purchase.id);
    const deleted = await db.purchases.get(purchase.id);
    assert.equal(deleted!.deleted, true);
    assert.equal(deleted!.syncStatus, "pending");
  });
});
