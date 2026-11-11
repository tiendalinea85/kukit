import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../../../lib/db.ts";
import {
  updateProductionOrder,
  deleteProductionOrder,
  removeProductionMaterial,
  startProductionOrder,
  completeProductionOrder,
} from "./tailoringService.ts";
import {
  generateGarmentCode,
  generateMaterialCode,
  generateProductionCode,
} from "../../../utils/code.ts";
import { newId } from "../../../utils/id.ts";
import { useWorkspaceStore } from "../../../stores/useWorkspaceStore.ts";
import type { ProductionOrderFormData } from "../schemas/tailoringSchema.ts";
import type {
  Color,
  Garment,
  Material,
  ProductionMaterial,
  ProductionOrder,
  Size,
} from "../../../types/modules.ts";

const WS = "ws-tailoring";
const OTHER_WS = "ws-otro";
const NOW = "2026-08-14T10:00:00.000Z";

function makeGarment(overrides: Partial<Garment> = {}): Garment {
  return {
    id: newId(),
    code: "PT000001",
    name: "Camisa Clásica",
    description: "",
    categoryId: "cat-1",
    salePrice: 59.9,
    notes: "",
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
    syncStatus: "synced",
    workspaceId: WS,
    ...overrides,
  };
}

function makeSize(overrides: Partial<Size> = {}): Size {
  return {
    id: newId(),
    name: "M",
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
    syncStatus: "synced",
    workspaceId: WS,
    ...overrides,
  };
}

function makeColor(overrides: Partial<Color> = {}): Color {
  return {
    id: newId(),
    name: "Azul",
    hex: "#0000FF",
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
    syncStatus: "synced",
    workspaceId: WS,
    ...overrides,
  };
}

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: newId(),
    code: "MT000001",
    name: "Algodón",
    unit: "metro",
    costPerUnit: 3.5,
    stock: 100,
    notes: "",
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
    syncStatus: "synced",
    workspaceId: WS,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<ProductionOrder> = {}): ProductionOrder {
  return {
    id: newId(),
    code: "PR000001",
    garmentId: "",
    garmentName: "Camisa Clásica",
    sizeId: "",
    sizeName: "M",
    colorId: "",
    colorName: "Azul",
    quantity: 10,
    unitCost: 25,
    totalCost: 250,
    status: "pendiente",
    startDate: "2026-08-14",
    dueDate: "2026-08-20",
    completedAt: null,
    notes: "",
    voidedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
    syncStatus: "pending",
    workspaceId: WS,
    ...overrides,
  };
}

function makeOrderLine(overrides: Partial<ProductionMaterial> = {}): ProductionMaterial {
  return {
    id: newId(),
    productionOrderId: "",
    materialId: "",
    materialName: "Algodón",
    quantity: 5,
    unitCost: 3.5,
    totalCost: 17.5,
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
    syncStatus: "pending",
    workspaceId: WS,
    ...overrides,
  };
}

function formData(overrides: Partial<ProductionOrderFormData> = {}): ProductionOrderFormData {
  return {
    garmentId: "",
    sizeId: "",
    colorId: "",
    quantity: 10,
    unitCost: 25,
    startDate: "2026-08-14",
    dueDate: "2026-08-20",
    notes: "",
    ...overrides,
  };
}

interface Fixture {
  garment: Garment;
  size: Size;
  color: Color;
  material: Material;
  order: ProductionOrder;
  line: ProductionMaterial;
}

async function seed(): Promise<Fixture> {
  const garment = makeGarment();
  const size = makeSize();
  const color = makeColor();
  const material = makeMaterial();
  const order = makeOrder({
    garmentId: garment.id,
    sizeId: size.id,
    colorId: color.id,
  });
  const line = makeOrderLine({
    productionOrderId: order.id,
    materialId: material.id,
  });
  await db.garments.add(garment);
  await db.sizes.add(size);
  await db.garmentColors.add(color);
  await db.materials.add(material);
  await db.productionOrders.add(order);
  await db.productionMaterials.add(line);
  return { garment, size, color, material, order, line };
}

beforeEach(async () => {
  await db.open();
  await db.garments.clear();
  await db.sizes.clear();
  await db.garmentColors.clear();
  await db.materials.clear();
  await db.productionOrders.clear();
  await db.productionMaterials.clear();
  useWorkspaceStore.setState({ activeWorkspaceId: WS });
});

describe("updateProductionOrder: snapshot de nombres", () => {
  it("recalcula prenda, talla y color desde los ids al editar", async () => {
    const { order, garment, size, color } = await seed();
    await db.sizes.update(size.id, { name: "M alend" });
    await db.garmentColors.update(color.id, { name: "Índigo" });

    await updateProductionOrder(order.id, formData({
      garmentId: garment.id,
      sizeId: size.id,
      colorId: color.id,
    }));

    const updated = await db.productionOrders.get(order.id);
    assert.equal(updated?.sizeName, "M alend");
    assert.equal(updated?.colorName, "Índigo");
    assert.equal(updated?.syncStatus, "pending");
    assert.notEqual(updated?.updatedAt, NOW);
  });

  it("recalcula el total y no conserva los nombres antiguos", async () => {
    const { order, garment, size, color } = await seed();

    await updateProductionOrder(order.id, formData({
      garmentId: garment.id,
      sizeId: size.id,
      colorId: color.id,
      quantity: 4,
      unitCost: 12.5,
    }));

    const updated = await db.productionOrders.get(order.id);
    assert.equal(updated?.quantity, 4);
    assert.equal(updated?.unitCost, 12.5);
    assert.equal(updated?.totalCost, 50);
  });

  it("no se puede editar una orden anulada", async () => {
    const { order, garment, size, color } = await seed();
    await db.productionOrders.update(order.id, { status: "anulada" });

    await assert.rejects(
      updateProductionOrder(order.id, formData({ garmentId: garment.id, sizeId: size.id, colorId: color.id })),
      /No se puede editar esta orden/,
    );
  });
});

describe("updateProductionOrder: líneas de materiales", () => {
  it("inserta las líneas nuevas y actualiza las existentes", async () => {
    const { order, line, material } = await seed();
    const newLineId = newId();

    await updateProductionOrder(order.id, formData({
      garmentId: order.garmentId,
      sizeId: order.sizeId,
      colorId: order.colorId,
    }), [
      { id: line.id, materialId: material.id, materialName: "Algodón", quantity: 8, unitCost: 4, totalCost: 32 },
      { id: newLineId, materialId: material.id, materialName: "Hilo", quantity: 2, unitCost: 1.5, totalCost: 3 },
    ]);

    const rows = await db.productionMaterials.toArray();
    assert.equal(rows.length, 2);

    const kept = rows.find((r) => r.id === line.id);
    assert.equal(kept?.quantity, 8);
    assert.equal(kept?.unitCost, 4);
    assert.equal(kept?.syncStatus, "pending");
    assert.equal(kept?.deleted, false);

    const added = rows.find((r) => r.id === newLineId);
    assert.ok(added, "la línea nueva se inserta con el id del formulario");
    assert.equal(added?.materialName, "Hilo");
    assert.equal(added?.productionOrderId, order.id);
    assert.equal(added?.workspaceId, WS);
  });

  it("marca como deleted (sin borrar) las líneas que ya no están en el formulario", async () => {
    const { order, line, material } = await seed();

    await updateProductionOrder(order.id, formData({
      garmentId: order.garmentId,
      sizeId: order.sizeId,
      colorId: order.colorId,
    }), [
      { id: newId(), materialId: material.id, materialName: "Hilo", quantity: 1, unitCost: 1, totalCost: 1 },
    ]);

    const rows = await db.productionMaterials.toArray();
    assert.equal(rows.length, 2, "la línea quitada sigue existiendo (soft delete)");
    const removed = rows.find((r) => r.id === line.id);
    assert.equal(removed?.deleted, true);
    assert.equal(removed?.syncStatus, "pending");
  });

  it("ignora las líneas sin material seleccionado", async () => {
    const { order, line } = await seed();

    await updateProductionOrder(order.id, formData({
      garmentId: order.garmentId,
      sizeId: order.sizeId,
      colorId: order.colorId,
    }), [
      { id: newId(), materialId: "", materialName: "", quantity: 1, unitCost: 0, totalCost: 0 },
    ]);

    const rows = await db.productionMaterials.toArray();
    assert.equal(rows.length, 1, "no se inserta la línea vacía");
    assert.equal(rows[0].id, line.id);
  });
});

describe("deleteProductionOrder", () => {
  it("marca la orden y sus materiales como eliminados sin borrarlos físicamente", async () => {
    const { order, line } = await seed();

    await deleteProductionOrder(order.id);

    const stored = await db.productionOrders.get(order.id);
    assert.equal(stored?.deleted, true);
    assert.equal(stored?.syncStatus, "pending");

    const rows = await db.productionMaterials.toArray();
    assert.equal(rows.length, 1, "las líneas no se borran de la base");
    assert.equal(rows[0].id, line.id);
    assert.equal(rows[0].deleted, true);
    assert.equal(rows[0].syncStatus, "pending");
  });
});

describe("removeProductionMaterial", () => {
  it("hace soft delete de la línea en vez de borrarla", async () => {
    const { order, line } = await seed();

    await removeProductionMaterial(line.id);

    const stored = await db.productionMaterials.get(line.id);
    assert.ok(stored, "la línea sigue existiendo");
    assert.equal(stored?.deleted, true);
    assert.equal(stored?.syncStatus, "pending");
    assert.equal((await db.productionMaterials.toArray()).length, 1);
    assert.equal((await db.productionOrders.get(order.id))?.deleted, false);
  });

  it("rechaza una línea de otro workspace", async () => {
    const { line } = await seed();
    await db.productionMaterials.update(line.id, { workspaceId: OTHER_WS });

    await assert.rejects(removeProductionMaterial(line.id), /Material de orden no encontrado/);
  });
});

describe("transiciones de estado de la orden", () => {
  it("una orden pendiente pasa a en_proceso", async () => {
    const { order } = await seed();

    await startProductionOrder(order.id);

    const stored = await db.productionOrders.get(order.id);
    assert.equal(stored?.status, "en_proceso");
    assert.equal(stored?.syncStatus, "pending");
    assert.equal(stored?.completedAt, null);
  });

  it("no permite iniciar una orden que no está pendiente", async () => {
    const { order } = await seed();
    await db.productionOrders.update(order.id, { status: "completada" });

    await assert.rejects(startProductionOrder(order.id), /no se puede iniciar/);
  });

  it("una orden en proceso pasa a completada y fija completedAt", async () => {
    const { order } = await seed();
    await startProductionOrder(order.id);

    await completeProductionOrder(order.id);

    const stored = await db.productionOrders.get(order.id);
    assert.equal(stored?.status, "completada");
    assert.ok(stored?.completedAt, "completedAt queda registrado");
    assert.equal(stored?.syncStatus, "pending");
  });

  it("no permite completar una orden pendiente", async () => {
    const { order } = await seed();

    await assert.rejects(completeProductionOrder(order.id), /no se puede completar/);
  });

  it("no permite transiciones sobre una orden de otro workspace", async () => {
    const { order } = await seed();
    await db.productionOrders.update(order.id, { workspaceId: OTHER_WS });

    await assert.rejects(startProductionOrder(order.id), /Orden de producción no encontrada/);
  });
});

describe("generadores de código por workspace", () => {
  it("no mezcla la secuencia de producción entre workspaces", async () => {
    await db.productionOrders.add(makeOrder({ id: "o-1", code: "PR000005", workspaceId: WS }));
    await db.productionOrders.add(makeOrder({ id: "o-2", code: "PR000099", workspaceId: OTHER_WS }));

    assert.equal(await generateProductionCode(), "PR000006");

    useWorkspaceStore.setState({ activeWorkspaceId: OTHER_WS });
    assert.equal(await generateProductionCode(), "PR000100");
  });

  it("no mezcla la secuencia de prendas ni de materiales entre workspaces", async () => {
    await db.garments.add(makeGarment({ code: "PT000007", workspaceId: WS }));
    await db.materials.add(makeMaterial({ code: "MT000003", workspaceId: WS }));
    await db.garments.add(makeGarment({ code: "PT000042", workspaceId: OTHER_WS }));

    assert.equal(await generateGarmentCode(), "PT000008");
    assert.equal(await generateMaterialCode(), "MT000004");

    useWorkspaceStore.setState({ activeWorkspaceId: OTHER_WS });
    assert.equal(await generateGarmentCode(), "PT000043");
  });

  it("arranca en 000001 cuando el workspace no tiene registros", async () => {
    assert.equal(await generateProductionCode(), "PR000001");
  });
});
