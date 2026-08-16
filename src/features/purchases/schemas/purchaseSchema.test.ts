import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { purchaseSchema, purchaseDetailSchema } from "./purchaseSchema.ts";

describe("purchaseSchema", () => {
  it("acepta una compra válida", () => {
    const result = purchaseSchema.parse({
      supplier: "Importadora XYZ",
      date: "2026-08-15",
      paymentMethod: "transferencia",
    });
    assert.equal(result.status, "pendiente");
    assert.equal(result.notes, undefined);
  });

  it("recorta el proveedor y conserva las notas tal cual", () => {
    const result = purchaseSchema.parse({
      supplier: "  Proveedor A  ",
      date: "2026-08-15",
      paymentMethod: "efectivo",
      notes: "  nota  ",
    });
    assert.equal(result.supplier, "Proveedor A");
    assert.equal(result.notes, "  nota  ");
  });

  it("rechaza proveedor vacío", () => {
    assert.throws(() => purchaseSchema.parse({ supplier: " ", date: "2026-08-15", paymentMethod: "efectivo" }));
  });

  it("rechaza fecha mal formada", () => {
    assert.throws(() => purchaseSchema.parse({ supplier: "A", date: "15/08/2026", paymentMethod: "efectivo" }));
  });

  it("rechaza un método de pago inválido", () => {
    assert.throws(() => purchaseSchema.parse({ supplier: "A", date: "2026-08-15", paymentMethod: "cheque" }));
  });

  it("rechaza un estado inválido", () => {
    assert.throws(() => purchaseSchema.parse({
      supplier: "A", date: "2026-08-15", paymentMethod: "efectivo", status: "cerrada",
    }));
  });

  it("acepta estado recibida y lo mantiene", () => {
    const result = purchaseSchema.parse({
      supplier: "A", date: "2026-08-15", paymentMethod: "efectivo", status: "recibida",
    });
    assert.equal(result.status, "recibida");
  });

  it("acepta notas vacías", () => {
    const result = purchaseSchema.parse({
      supplier: "A", date: "2026-08-15", paymentMethod: "efectivo", notes: "",
    });
    assert.equal(result.notes, "");
  });
});

describe("purchaseDetailSchema", () => {
  it("acepta un detalle válido", () => {
    const result = purchaseDetailSchema.parse({ productId: "p1", quantity: 5, unitPrice: 10.5 });
    assert.equal(result.quantity, 5);
    assert.equal(result.unitPrice, 10.5);
  });

  it("convierte strings en números", () => {
    const result = purchaseDetailSchema.parse({ productId: "p1", quantity: "5", unitPrice: "10.5" });
    assert.equal(result.quantity, 5);
    assert.equal(result.unitPrice, 10.5);
  });

  it("rechaza un detalle sin producto", () => {
    assert.throws(() => purchaseDetailSchema.parse({ quantity: 5, unitPrice: 10 }));
  });

  it("rechaza cantidad cero o negativa", () => {
    assert.throws(() => purchaseDetailSchema.parse({ productId: "p1", quantity: 0, unitPrice: 10 }));
    assert.throws(() => purchaseDetailSchema.parse({ productId: "p1", quantity: -1, unitPrice: 10 }));
  });

  it("rechaza precio negativo", () => {
    assert.throws(() => purchaseDetailSchema.parse({ productId: "p1", quantity: 1, unitPrice: -0.5 }));
  });
});
