import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../../../lib/db.ts";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStock,
  listProductsWithStock,
  addStockMovement,
  adjustStock,
} from "./productService.ts";

beforeEach(async () => {
  await db.inventoryMovements.clear();
  await db.products.clear();
});

describe("createProduct", () => {
  it("crea un producto con código, syncStatus pending y deleted false", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido algodón" });
    assert.ok(product.id);
    assert.match(product.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(product.code, "PRD-001");
    assert.equal(product.name, "Tejido algodón");
    assert.equal(product.syncStatus, "pending");
    assert.equal(product.deleted, false);
  });

  it("con initialStock crea movimiento ENTRADA de inventario_inicial", async () => {
    const product = await createProduct({
      code: "PRD-001",
      name: "Tejido",
      initialStock: 50,
    });
    const movements = await db.inventoryMovements
      .where("productId")
      .equals(product.id)
      .toArray();
    assert.equal(movements.length, 1);
    assert.equal(movements[0].type, "entrada");
    assert.equal(movements[0].quantity, 50);
    assert.equal(movements[0].referenceType, "inventario_inicial");
    assert.equal(movements[0].referenceId, product.id);
  });

  it("sin initialStock no crea movimientos", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const movements = await db.inventoryMovements
      .where("productId")
      .equals(product.id)
      .toArray();
    assert.equal(movements.length, 0);
  });
});

describe("updateProduct", () => {
  it("actualiza nombre, código y color", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    await updateProduct(product.id, {
      code: "PRD-002",
      name: "Seda premium",
      color: "rojo",
    });
    const updated = await db.products.get(product.id);
    assert.equal(updated!.code, "PRD-002");
    assert.equal(updated!.name, "Seda premium");
    assert.equal(updated!.color, "rojo");
    assert.equal(updated!.syncStatus, "pending");
  });

  it("lanza error cuando el producto no existe", async () => {
    await assert.rejects(
      updateProduct("id-falso", { code: "X", name: "X" }),
      /no encontrado/i,
    );
  });
});

describe("deleteProduct", () => {
  it("marca deleted en true (soft delete)", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    await deleteProduct(product.id);
    const deleted = await db.products.get(product.id);
    assert.equal(deleted!.deleted, true);
    assert.equal(deleted!.syncStatus, "pending");
  });
});

describe("getProductStock", () => {
  it("retorna 0 para un producto sin movimientos", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const stock = await getProductStock(product.id);
    assert.equal(stock, 0);
  });

  it("calcula stock correctamente desde movimientos", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    await addStockMovement({
      productId: product.id,
      type: "entrada",
      quantity: 10,
      referenceType: "inventario_inicial",
      referenceId: product.id,
      notes: "Inicial",
    });
    const stock = await getProductStock(product.id);
    assert.equal(stock, 10);
  });
});

describe("listProductsWithStock", () => {
  it("retorna productos no eliminados con su stock", async () => {
    await createProduct({ code: "PRD-001", name: "Tejido", initialStock: 20 });
    await createProduct({ code: "PRD-002", name: "Seda", initialStock: 15 });
    const list = await listProductsWithStock();
    assert.equal(list.length, 2);
    const tejido = list.find((p) => p.code === "PRD-001")!;
    assert.equal(tejido.stock, 20);
    const seda = list.find((p) => p.code === "PRD-002")!;
    assert.equal(seda.stock, 15);
  });

  it("excluye productos eliminados", async () => {
    const p1 = await createProduct({ code: "PRD-001", name: "Tejido", initialStock: 10 });
    await deleteProduct(p1.id);
    const list = await listProductsWithStock();
    assert.equal(list.length, 0);
  });

  it("retorna productos ordenados por nombre", async () => {
    await createProduct({ code: "PRD-002", name: "Seda" });
    await createProduct({ code: "PRD-001", name: "Algodón" });
    const list = await listProductsWithStock();
    assert.equal(list[0].name, "Algodón");
    assert.equal(list[1].name, "Seda");
  });
});

describe("addStockMovement", () => {
  it("crea un movimiento de entrada", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const movement = await addStockMovement({
      productId: product.id,
      type: "entrada",
      quantity: 15,
      referenceType: "compra",
      referenceId: "compra-001",
      notes: "Compra proveedor",
    });
    assert.ok(movement.id);
    assert.equal(movement.type, "entrada");
    assert.equal(movement.quantity, 15);
    assert.equal(movement.referenceType, "compra");
    assert.equal(movement.syncStatus, "pending");
  });

  it("crea un movimiento de salida", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    const movement = await addStockMovement({
      productId: product.id,
      type: "salida",
      quantity: 5,
      referenceType: "venta",
      referenceId: "venta-001",
      notes: "Venta directa",
    });
    assert.equal(movement.type, "salida");
    assert.equal(movement.quantity, 5);
  });
});

describe("adjustStock", () => {
  it("aplica delta positivo", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    await adjustStock({
      productId: product.id,
      delta: 10,
      notes: "Inventario físico",
    });
    const stock = await getProductStock(product.id);
    assert.equal(stock, 10);
  });

  it("aplica delta negativo", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido", initialStock: 20 });
    await adjustStock({
      productId: product.id,
      delta: -5,
      notes: "Obsolescencia",
    });
    const stock = await getProductStock(product.id);
    assert.equal(stock, 15);
  });

  it("lanza error cuando delta es cero", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    await assert.rejects(
      adjustStock({ productId: product.id, delta: 0, notes: "Error" }),
      /distinto de cero/i,
    );
  });

  it("lanza error cuando delta no es finito", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    await assert.rejects(
      adjustStock({ productId: product.id, delta: NaN, notes: "Error" }),
      /distinto de cero/i,
    );
  });
});

describe("cómputo de stock acumulado", () => {
  it("entrada=10 + salida=3 + entrada=5 = stock 12", async () => {
    const product = await createProduct({ code: "PRD-001", name: "Tejido" });
    await addStockMovement({
      productId: product.id,
      type: "entrada",
      quantity: 10,
      referenceType: "compra",
      referenceId: "c1",
      notes: "Compra 1",
    });
    await addStockMovement({
      productId: product.id,
      type: "salida",
      quantity: 3,
      referenceType: "venta",
      referenceId: "v1",
      notes: "Venta 1",
    });
    await addStockMovement({
      productId: product.id,
      type: "entrada",
      quantity: 5,
      referenceType: "compra",
      referenceId: "c2",
      notes: "Compra 2",
    });
    const stock = await getProductStock(product.id);
    assert.equal(stock, 12);
  });
});
