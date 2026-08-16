import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeSubtotal,
  computePurchaseTotal,
  canEditPurchase,
  canVoidPurchase,
  isReceived,
  buildPurchase,
  buildPurchaseDetail,
} from "./purchaseRules.ts";

describe("computeSubtotal", () => {
  it("multiplica cantidad por precio unitario", () => {
    assert.equal(computeSubtotal(3, 12.5), 37.5);
  });

  it("redondea a 2 decimales", () => {
    assert.equal(computeSubtotal(3, 12.34), 37.02);
  });

  it("evita errores de coma flotante", () => {
    assert.equal(computeSubtotal(0.1, 3), 0.3);
  });
});

describe("computePurchaseTotal", () => {
  it("suma los subtotales de los detalles", () => {
    const total = computePurchaseTotal([
      { quantity: 2, unitPrice: 10 },
      { quantity: 1, unitPrice: 5.5 },
    ]);
    assert.equal(total, 25.5);
  });

  it("retorna 0 con detalles vacíos", () => {
    assert.equal(computePurchaseTotal([]), 0);
  });
});

describe("canEditPurchase", () => {
  it("solo permite editar compras pendientes", () => {
    assert.equal(canEditPurchase("pendiente"), true);
    assert.equal(canEditPurchase("recibida"), false);
    assert.equal(canEditPurchase("anulada"), false);
  });
});

describe("canVoidPurchase", () => {
  it("no permite anular una compra ya anulada", () => {
    assert.equal(canVoidPurchase("pendiente"), true);
    assert.equal(canVoidPurchase("recibida"), true);
    assert.equal(canVoidPurchase("anulada"), false);
  });
});

describe("isReceived", () => {
  it("detecta compras recibidas", () => {
    assert.equal(isReceived({ status: "recibida" }), true);
    assert.equal(isReceived({ status: "pendiente" }), false);
  });
});

describe("buildPurchase", () => {
  it("construye una compra con estado y fecha de recepción", () => {
    const purchase = buildPurchase(
      {
        supplier: "  Importadora XYZ  ",
        date: "2026-08-15",
        paymentMethod: "transferencia",
        notes: "  ",
        details: [{ productId: "p1", code: "P-001", name: "Tela", color: "#fff", quantity: 2, unitPrice: 10 }],
      },
      "C-0001",
      "2026-08-15T10:00:00.000Z"
    );
    assert.equal(purchase.supplier, "Importadora XYZ");
    assert.equal(purchase.code, "C-0001");
    assert.equal(purchase.total, 20);
    assert.equal(purchase.status, "pendiente");
    assert.equal(purchase.receivedAt, null);
    assert.equal(purchase.syncStatus, "pending");
  });

  it("marca como recibida al crear con status recibida", () => {
    const purchase = buildPurchase(
      { supplier: "A", date: "2026-08-15", paymentMethod: "efectivo", notes: "", status: "recibida", details: [] },
      "C-0002",
      "2026-08-15T10:00:00.000Z"
    );
    assert.equal(purchase.status, "recibida");
    assert.equal(purchase.receivedAt, "2026-08-15T10:00:00.000Z");
  });
});

describe("buildPurchaseDetail", () => {
  it("calcula subtotal y copia los datos del producto", () => {
    const detail = buildPurchaseDetail(
      { productId: "p1", code: " P-001 ", name: " Tela ", color: "#fff", quantity: 5, unitPrice: 3.2 },
      "pur-1",
      "2026-08-15T10:00:00.000Z"
    );
    assert.equal(detail.purchaseId, "pur-1");
    assert.equal(detail.code, "P-001");
    assert.equal(detail.subtotal, 16);
    assert.equal(detail.syncStatus, "pending");
  });
});
