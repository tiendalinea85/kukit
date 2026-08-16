import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { investmentSchema } from "./investmentSchema.ts";

const validInput = {
  name: "Máquina de coser industrial",
  value: 1450,
  categoryId: "cat-maquinaria",
  paymentMethod: "transferencia",
  status: "pagado",
  date: "2026-08-14",
};

describe("investmentSchema", () => {
  it("accepts a valid investment", () => {
    const result = investmentSchema.safeParse(validInput);
    assert.equal(result.success, true);
  });

  it("coerces string values to numbers", () => {
    const result = investmentSchema.safeParse({ ...validInput, value: "1450.50" });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.value, 1450.5);
  });

  it("accepts an optional supplier and notes", () => {
    const result = investmentSchema.safeParse({
      ...validInput,
      supplier: "Importadora Maquipack",
      notes: "Overlock de 5 hilos",
    });
    assert.equal(result.success, true);
  });

  it("rejects an empty name", () => {
    const result = investmentSchema.safeParse({ ...validInput, name: "   " });
    assert.equal(result.success, false);
  });

  it("rejects a value of zero or negative", () => {
    assert.equal(investmentSchema.safeParse({ ...validInput, value: 0 }).success, false);
    assert.equal(investmentSchema.safeParse({ ...validInput, value: -5 }).success, false);
  });

  it("rejects a missing category", () => {
    const result = investmentSchema.safeParse({ ...validInput, categoryId: "" });
    assert.equal(result.success, false);
  });

  it("rejects an invalid payment method", () => {
    const result = investmentSchema.safeParse({ ...validInput, paymentMethod: "bitcoin" });
    assert.equal(result.success, false);
  });

  it("rejects an invalid status", () => {
    const result = investmentSchema.safeParse({ ...validInput, status: "activo" });
    assert.equal(result.success, false);
  });

  it("defaults status to pagado when omitted", () => {
    const rest = { ...validInput };
    delete (rest as Partial<typeof rest>).status;
    const result = investmentSchema.safeParse(rest);
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.status, "pagado");
  });

  it("rejects a malformed date", () => {
    const result = investmentSchema.safeParse({ ...validInput, date: "14/08/2026" });
    assert.equal(result.success, false);
  });
});
