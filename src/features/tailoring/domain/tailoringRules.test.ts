import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildGarment,
  buildSize,
  buildColor,
  buildMaterial,
  buildProductionOrder,
  buildProductionMaterial,
  canEditGarment,
  canVoidProduction,
  computeProductionTotal,
  computeMaterialTotal,
  filterProductionOrders,
  PRODUCTION_STATUSES,
  MATERIAL_UNITS,
} from "./tailoringRules.ts";

const now = "2026-08-14T10:00:00.000Z";

describe("buildGarment", () => {
  it("crea una prenda con datos correctos", () => {
    const garment = buildGarment({
      data: {
        name: "  Camisa Clásica  ",
        description: "  Camisa formal  ",
        categoryId: "cat-1",
        salePrice: 59.9,
        notes: "Nueva colección",
      },
      code: "PR0001",
      now,
    });
    assert.equal(garment.code, "PR0001");
    assert.equal(garment.name, "Camisa Clásica");
    assert.equal(garment.description, "Camisa formal");
    assert.equal(garment.categoryId, "cat-1");
    assert.equal(garment.salePrice, 59.9);
    assert.equal(garment.notes, "Nueva colección");
    assert.equal(garment.deleted, false);
    assert.equal(garment.syncStatus, "pending");
    assert.equal(garment.createdAt, now);
    assert.equal(garment.updatedAt, now);
    assert.equal(garment.id.length > 0, true);
  });

  it("establece notes vacío cuando no se provee", () => {
    const garment = buildGarment({
      data: {
        name: "Pantalón",
        description: "",
        categoryId: "cat-2",
        salePrice: 45,
        notes: "",
      },
      code: "PR0002",
      now,
    });
    assert.equal(garment.notes, "");
  });
});

describe("buildSize", () => {
  it("crea una talla con datos correctos", () => {
    const size = buildSize({
      data: { name: "  M  ", sortOrder: 2 },
      now,
    });
    assert.equal(size.name, "M");
    assert.equal(size.sortOrder, 2);
    assert.equal(size.deleted, false);
    assert.equal(size.syncStatus, "pending");
  });
});

describe("buildColor", () => {
  it("crea un color con datos correctos", () => {
    const color = buildColor({
      data: { name: "  Azul  ", hex: "#0000FF" },
      now,
    });
    assert.equal(color.name, "Azul");
    assert.equal(color.hex, "#0000FF");
    assert.equal(color.deleted, false);
    assert.equal(color.syncStatus, "pending");
  });
});

describe("buildMaterial", () => {
  it("crea un material con datos correctos", () => {
    const material = buildMaterial({
      data: {
        name: "  Algodón  ",
        unit: "metro",
        costPerUnit: 3.5,
        stock: 100,
        notes: "Importado",
      },
      code: "MT0001",
      now,
    });
    assert.equal(material.code, "MT0001");
    assert.equal(material.name, "Algodón");
    assert.equal(material.unit, "metro");
    assert.equal(material.costPerUnit, 3.5);
    assert.equal(material.stock, 100);
    assert.equal(material.notes, "Importado");
    assert.equal(material.deleted, false);
    assert.equal(material.syncStatus, "pending");
  });
});

describe("buildProductionOrder", () => {
  it("crea una orden con totalCost calculado", () => {
    const order = buildProductionOrder({
      data: {
        garmentId: "g-1",
        garmentName: "Camisa",
        sizeId: "s-1",
        sizeName: "M",
        colorId: "c-1",
        colorName: "Azul",
        quantity: 10,
        unitCost: 25,
        totalCost: 250,
        startDate: "2026-08-14",
        dueDate: "2026-08-20",
        notes: "Pedido urgente",
      },
      code: "ORD0001",
      now,
    });
    assert.equal(order.code, "ORD0001");
    assert.equal(order.garmentName, "Camisa");
    assert.equal(order.sizeName, "M");
    assert.equal(order.colorName, "Azul");
    assert.equal(order.quantity, 10);
    assert.equal(order.unitCost, 25);
    assert.equal(order.totalCost, 250);
    assert.equal(order.status, "pendiente");
    assert.equal(order.deleted, false);
    assert.equal(order.voidedAt, null);
    assert.equal(order.completedAt, null);
  });
});

describe("buildProductionMaterial", () => {
  it("crea un material de producción con datos correctos", () => {
    const pm = buildProductionMaterial({
      data: {
        productionOrderId: "ord-1",
        materialId: "m-1",
        materialName: "Algodón",
        quantity: 5,
        unitCost: 3.5,
        totalCost: 17.5,
      },
      now,
    });
    assert.equal(pm.productionOrderId, "ord-1");
    assert.equal(pm.materialName, "Algodón");
    assert.equal(pm.quantity, 5);
    assert.equal(pm.unitCost, 3.5);
    assert.equal(pm.totalCost, 17.5);
    assert.equal(pm.syncStatus, "pending");
  });
});

describe("canEditGarment", () => {
  it("retorna true cuando no está eliminado", () => {
    assert.equal(canEditGarment({ deleted: false }), true);
  });

  it("retorna false cuando está eliminado", () => {
    assert.equal(canEditGarment({ deleted: true }), false);
  });
});

describe("canVoidProduction", () => {
  it("retorna true cuando status es pendiente y no eliminado", () => {
    assert.equal(canVoidProduction({ status: "pendiente", deleted: false }), true);
  });

  it("retorna true cuando status es en_proceso", () => {
    assert.equal(canVoidProduction({ status: "en_proceso", deleted: false }), true);
  });

  it("retorna false cuando status es anulada", () => {
    assert.equal(canVoidProduction({ status: "anulada", deleted: false }), false);
  });

  it("retorna false cuando está eliminado", () => {
    assert.equal(canVoidProduction({ status: "pendiente", deleted: true }), false);
  });
});

describe("computeProductionTotal", () => {
  it("calcula el total correctamente", () => {
    assert.equal(computeProductionTotal(10, 25), 250);
  });

  it("redondea a 2 decimales", () => {
    assert.equal(computeProductionTotal(3, 10.33), 30.99);
  });

  it("retorna 0 cuando quantity es 0", () => {
    assert.equal(computeProductionTotal(0, 25), 0);
  });
});

describe("computeMaterialTotal", () => {
  it("calcula el total correctamente", () => {
    assert.equal(computeMaterialTotal(5, 3.5), 17.5);
  });

  it("redondea a 2 decimales", () => {
    assert.equal(computeMaterialTotal(3, 10.33), 30.99);
  });
});

describe("filterProductionOrders", () => {
  const orders = [
    { id: "1", code: "ORD001", garmentName: "Camisa", status: "pendiente", deleted: false },
    { id: "2", code: "ORD002", garmentName: "Pantalón", status: "en_proceso", deleted: false },
    { id: "3", code: "ORD003", garmentName: "Vestido", status: "completada", deleted: false },
    { id: "4", code: "ORD004", garmentName: "Falda", status: "pendiente", deleted: true },
  ];

  it("retorna todas las órdenes no eliminadas sin filtros", () => {
    const result = filterProductionOrders(orders);
    assert.equal(result.length, 3);
  });

  it("filtra por status", () => {
    const result = filterProductionOrders(orders, { status: "pendiente" });
    assert.equal(result.length, 1);
    assert.equal(result[0].code, "ORD001");
  });

  it("filtra por búsqueda en código", () => {
    const result = filterProductionOrders(orders, { search: "ord002" });
    assert.equal(result.length, 1);
    assert.equal(result[0].code, "ORD002");
  });

  it("filtra por búsqueda en nombre de prenda", () => {
    const result = filterProductionOrders(orders, { search: "camisa" });
    assert.equal(result.length, 1);
    assert.equal(result[0].code, "ORD001");
  });

  it("excluye órdenes eliminadas incluso con búsqueda", () => {
    const result = filterProductionOrders(orders, { search: "falda" });
    assert.equal(result.length, 0);
  });

  it("combina búsqueda y status", () => {
    const result = filterProductionOrders(orders, { search: "camisa", status: "pendiente" });
    assert.equal(result.length, 1);
    assert.equal(result[0].code, "ORD001");
  });

  it("retorna vacío cuando search no coincide", () => {
    const result = filterProductionOrders(orders, { search: "xyz" });
    assert.equal(result.length, 0);
  });
});

describe("constantes", () => {
  it("PRODUCTION_STATUSES contiene los valores esperados", () => {
    assert.deepEqual([...PRODUCTION_STATUSES], [
      "pendiente",
      "en_proceso",
      "completada",
      "anulada",
    ]);
  });

  it("MATERIAL_UNITS contiene las unidades esperadas", () => {
    assert.ok(MATERIAL_UNITS.includes("metro"));
    assert.ok(MATERIAL_UNITS.includes("yarda"));
    assert.ok(MATERIAL_UNITS.includes("pieza"));
    assert.equal(MATERIAL_UNITS.length, 8);
  });
});
