import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../../../lib/db.ts";
import {
  createSale,
  confirmSale,
  updateSale,
  voidSale,
  deleteSale,
} from "./saleService.ts";
import { createProduct, addStockMovement } from "./productService.ts";
import type { SaleDetailInput } from "../domain/saleRules.ts";

function makeDetail(productId: string): SaleDetailInput {
  return {
    productId,
    code: "PRD-001",
    name: "Camisa clásica",
    color: "blanco",
    quantity: 3,
    unitPrice: 45,
  };
}

const header = {
  customerId: "cust-001",
  date: "2026-08-15",
  paymentMethod: "efectivo" as const,
  notes: "Venta al por menor",
};

beforeEach(async () => {
  await db.open();
  await db.inventoryMovements.clear();
  await db.saleDetails.clear();
  await db.sales.clear();
  await db.products.clear();
});

describe("createSale", () => {
  it("crea una venta con código generado, detalles y syncStatus pending", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Camisa" });
    const sale = await createSale({
      header,
      details: [makeDetail(product.id)],
    });
    assert.match(sale.code, /^V\d{6}$/);
    assert.equal(sale.status, "pendiente");
    assert.equal(sale.total, 135);
    assert.equal(sale.syncStatus, "pending");
    assert.equal(sale.deleted, false);
  });

  it("crea detalles en saleDetails", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Camisa" });
    await createSale({
      header,
      details: [makeDetail(product.id)],
    });
    const details = await db.saleDetails.toArray();
    assert.equal(details.length, 1);
    assert.equal(details[0].productId, product.id);
    assert.equal(details[0].quantity, 3);
    assert.equal(details[0].unitPrice, 45);
    assert.equal(details[0].subtotal, 135);
  });
});

describe("confirmSale", () => {
  it("cambia status a confirmada y crea movimientos SALIDA", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Camisa" });
    await addStockMovement({
      productId: product.id,
      type: "entrada",
      quantity: 20,
      referenceType: "inventario_inicial",
      referenceId: product.id,
      notes: "Stock inicial",
    });
    const sale = await createSale({
      header,
      details: [makeDetail(product.id)],
    });
    await confirmSale(sale.id);
    const confirmed = await db.sales.get(sale.id);
    assert.equal(confirmed!.status, "confirmada");
    assert.ok(confirmed!.confirmedAt);
    const movements = await db.inventoryMovements
      .where("productId")
      .equals(product.id)
      .toArray();
    const salidas = movements.filter((m) => m.type === "salida");
    assert.equal(salidas.length, 1);
    assert.equal(salidas[0].quantity, 3);
    assert.equal(salidas[0].referenceType, "venta");
  });

  it("lanza error cuando el stock es insuficiente", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Camisa" });
    await addStockMovement({
      productId: product.id,
      type: "entrada",
      quantity: 2,
      referenceType: "inventario_inicial",
      referenceId: product.id,
      notes: "Stock insuficiente",
    });
    const sale = await createSale({
      header,
      details: [makeDetail(product.id)],
    });
    await assert.rejects(
      confirmSale(sale.id),
      /stock insuficiente/i,
    );
  });

  it("lanza error cuando la venta no existe", async () => {
    await assert.rejects(
      confirmSale("id-falso"),
      /no encontrada/i,
    );
  });

  it("lanza error cuando la venta no está pendiente", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Camisa" });
    await addStockMovement({
      productId: product.id,
      type: "entrada",
      quantity: 20,
      referenceType: "inventario_inicial",
      referenceId: product.id,
      notes: "Stock",
    });
    const sale = await createSale(
      { header, details: [makeDetail(product.id)] },
      { confirm: true },
    );
    await assert.rejects(
      confirmSale(sale.id),
      /pendientes/i,
    );
  });
});

describe("voidSale", () => {
  it("anula una venta confirmada creando movimientos ENTRADA compensatorios", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Camisa" });
    await addStockMovement({
      productId: product.id,
      type: "entrada",
      quantity: 20,
      referenceType: "inventario_inicial",
      referenceId: product.id,
      notes: "Stock",
    });
    const sale = await createSale(
      { header, details: [makeDetail(product.id)] },
      { confirm: true },
    );
    await voidSale(sale.id);
    const voided = await db.sales.get(sale.id);
    assert.equal(voided!.status, "anulada");
    assert.ok(voided!.voidedAt);
    const movements = await db.inventoryMovements
      .where("productId")
      .equals(product.id)
      .toArray();
    const entradas = movements.filter(
      (m) => m.type === "entrada" && m.referenceType === "anulacion_venta",
    );
    assert.equal(entradas.length, 1);
    assert.equal(entradas[0].quantity, 3);
  });

  it("lanza error cuando la venta ya está anulada", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Camisa" });
    await addStockMovement({
      productId: product.id,
      type: "entrada",
      quantity: 20,
      referenceType: "inventario_inicial",
      referenceId: product.id,
      notes: "Stock",
    });
    const sale = await createSale(
      { header, details: [makeDetail(product.id)] },
      { confirm: true },
    );
    await voidSale(sale.id);
    await assert.rejects(
      voidSale(sale.id),
      /ya está anulada/i,
    );
  });

  it("lanza error cuando la venta no existe", async () => {
    await assert.rejects(
      voidSale("id-falso"),
      /no encontrada/i,
    );
  });
});

describe("updateSale", () => {
  it("actualiza campos solo cuando la venta está pendiente", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Camisa" });
    const sale = await createSale({
      header,
      details: [makeDetail(product.id)],
    });
    const product2 = await createProduct({ code: "PRD-002", name: "Pantalón" });
    await updateSale(sale.id, {
      header: { ...header, customerId: "cust-002" },
      details: [{ ...makeDetail(product2.id), quantity: 5, unitPrice: 60 }],
    });
    const updated = await db.sales.get(sale.id);
    assert.equal(updated!.customerId, "cust-002");
    assert.equal(updated!.total, 300);
  });

  it("reemplaza detalles existentes", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Camisa" });
    const sale = await createSale({
      header,
      details: [makeDetail(product.id)],
    });
    const product2 = await createProduct({ code: "PRD-002", name: "Pantalón" });
    await updateSale(sale.id, {
      header,
      details: [makeDetail(product2.id)],
    });
    const details = await db.saleDetails.where("saleId").equals(sale.id).toArray();
    assert.equal(details.length, 1);
    assert.equal(details[0].productId, product2.id);
  });

  it("lanza error cuando la venta no existe", async () => {
    await assert.rejects(
      updateSale("id-falso", { header, details: [] }),
      /no encontrada/i,
    );
  });

  it("lanza error cuando la venta está confirmada", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Camisa" });
    await addStockMovement({
      productId: product.id,
      type: "entrada",
      quantity: 20,
      referenceType: "inventario_inicial",
      referenceId: product.id,
      notes: "Stock",
    });
    const sale = await createSale(
      { header, details: [makeDetail(product.id)] },
      { confirm: true },
    );
    await assert.rejects(
      updateSale(sale.id, { header, details: [] }),
      /pendientes/i,
    );
  });
});

describe("deleteSale", () => {
  it("marca deleted en true (soft delete)", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Camisa" });
    const sale = await createSale({
      header,
      details: [makeDetail(product.id)],
    });
    await deleteSale(sale.id);
    const deleted = await db.sales.get(sale.id);
    assert.equal(deleted!.deleted, true);
    assert.equal(deleted!.syncStatus, "pending");
  });
});
