import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ocrResultSchema, ocrItemSchema } from "./ocrSchema.ts";

describe("ocrItemSchema", () => {
  it("acepta un item válido", () => {
    const result = ocrItemSchema.safeParse({
      description: "Tornillo 1/4",
      quantity: 10,
      unitPrice: 0.5,
    });
    assert.equal(result.success, true);
  });

  it("establece quantity por defecto a 1 cuando falta", () => {
    const result = ocrItemSchema.safeParse({
      description: "Tornillo 1/4",
      unitPrice: 0.5,
    });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.quantity, 1);
  });

  it("rechaza description vacía", () => {
    const result = ocrItemSchema.safeParse({
      description: "",
      quantity: 1,
      unitPrice: 1,
    });
    assert.equal(result.success, false);
  });

  it("rechaza quantity negativo", () => {
    const result = ocrItemSchema.safeParse({
      description: "Tornillo",
      quantity: -1,
      unitPrice: 1,
    });
    assert.equal(result.success, false);
  });

  it("rechaza unitPrice negativo", () => {
    const result = ocrItemSchema.safeParse({
      description: "Tornillo",
      quantity: 1,
      unitPrice: -5,
    });
    assert.equal(result.success, false);
  });
});

describe("ocrResultSchema", () => {
  const validFull = {
    supplier: "Ferretería Central",
    invoiceNumber: "FAC-001",
    date: "2026-08-10",
    items: [
      { description: "Tornillo", quantity: 10, unitPrice: 0.5 },
    ],
    total: 11,
    currency: "USD",
    confidence: "high",
  };

  it("acepta un resultado completo válido", () => {
    const result = ocrResultSchema.safeParse(validFull);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.supplier, "Ferretería Central");
      assert.equal(result.data.invoiceNumber, "FAC-001");
      assert.equal(result.data.date, "2026-08-10");
      assert.equal(result.data.items.length, 1);
      assert.equal(result.data.total, 11);
      assert.equal(result.data.currency, "USD");
      assert.equal(result.data.confidence, "high");
    }
  });

  it("acepta cuando los campos opcionales faltan", () => {
    const result = ocrResultSchema.safeParse({ items: [] });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.supplier, undefined);
      assert.equal(result.data.invoiceNumber, undefined);
      assert.equal(result.data.date, undefined);
      assert.equal(result.data.total, undefined);
    }
  });

  it("acepta array de items vacío", () => {
    const result = ocrResultSchema.safeParse({ items: [] });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.items.length, 0);
  });

  it("establece items por defecto a array vacío", () => {
    const result = ocrResultSchema.safeParse({});
    assert.equal(result.success, true);
    if (result.success) assert.deepEqual(result.data.items, []);
  });

  it("rechaza formato de fecha inválido", () => {
    const result = ocrResultSchema.safeParse({
      ...validFull,
      date: "10/08/2026",
    });
    assert.equal(result.success, false);
  });

  it("rechaza total negativo", () => {
    const result = ocrResultSchema.safeParse({
      ...validFull,
      total: -5,
    });
    assert.equal(result.success, false);
  });

  it("establece confidence por defecto a medium", () => {
    const result = ocrResultSchema.safeParse({
      items: [],
    });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.confidence, "medium");
  });

  it("rechaza valor de confidence inválido", () => {
    const result = ocrResultSchema.safeParse({
      ...validFull,
      confidence: "very_high",
    });
    assert.equal(result.success, false);
  });

  it("establece currency por defecto a USD", () => {
    const result = ocrResultSchema.safeParse({
      items: [],
    });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.currency, "USD");
  });
});
