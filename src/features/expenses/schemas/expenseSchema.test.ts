import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expenseSchema } from "./expenseSchema.ts";

const validInput = {
  description: "Recibo de luz",
  amount: 98.3,
  categoryId: "cat-servicios",
  paymentMethod: "transferencia",
  status: "pagado",
  date: "2026-08-14",
  time: "14:00",
};

describe("expenseSchema", () => {
  it("accepts a valid expense", () => {
    const result = expenseSchema.safeParse(validInput);
    assert.equal(result.success, true);
  });

  it("coerces string amounts to numbers", () => {
    const result = expenseSchema.safeParse({ ...validInput, amount: "98.5" });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.amount, 98.5);
  });

  it("rejects an empty description", () => {
    const result = expenseSchema.safeParse({ ...validInput, description: "   " });
    assert.equal(result.success, false);
  });

  it("rejects an amount of zero or negative", () => {
    assert.equal(expenseSchema.safeParse({ ...validInput, amount: 0 }).success, false);
    assert.equal(expenseSchema.safeParse({ ...validInput, amount: -5 }).success, false);
  });

  it("rejects a missing category", () => {
    const result = expenseSchema.safeParse({ ...validInput, categoryId: "" });
    assert.equal(result.success, false);
  });

  it("rejects an invalid payment method", () => {
    const result = expenseSchema.safeParse({ ...validInput, paymentMethod: "bitcoin" });
    assert.equal(result.success, false);
  });

  it("rejects an invalid status", () => {
    const result = expenseSchema.safeParse({ ...validInput, status: "activo" });
    assert.equal(result.success, false);
  });

  it("defaults status to pagado when omitted", () => {
    const rest = { ...validInput };
    delete (rest as Partial<typeof rest>).status;
    const result = expenseSchema.safeParse(rest);
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.status, "pagado");
  });

  it("rejects a malformed date", () => {
    const result = expenseSchema.safeParse({ ...validInput, date: "14/08/2026" });
    assert.equal(result.success, false);
  });

  it("rejects a missing time", () => {
    const result = expenseSchema.safeParse({ ...validInput, time: "" });
    assert.equal(result.success, false);
  });

  it("accepts optional notes and receipt photo", () => {
    const result = expenseSchema.safeParse({
      ...validInput,
      notes: "Período mensual",
      receiptPhoto: "data:image/png;base64,abc",
    });
    assert.equal(result.success, true);
  });
});
