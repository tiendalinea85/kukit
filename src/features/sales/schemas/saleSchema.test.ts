import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { saleSchema, saleDetailSchema } from "./saleSchema.ts";

const validSale = {
  customerId: "c1",
  date: "2026-08-14",
  paymentMethod: "efectivo",
  notes: "Primera venta",
};

describe("saleSchema", () => {
  it("accepts a valid sale header", () => {
    assert.equal(saleSchema.safeParse(validSale).success, true);
  });

  it("accepts an empty notes field", () => {
    assert.equal(saleSchema.safeParse({ ...validSale, notes: "" }).success, true);
  });

  it("rejects a missing customer", () => {
    assert.equal(saleSchema.safeParse({ ...validSale, customerId: "" }).success, false);
  });

  it("rejects a malformed date", () => {
    assert.equal(saleSchema.safeParse({ ...validSale, date: "14/08/2026" }).success, false);
  });

  it("rejects an invalid payment method", () => {
    assert.equal(saleSchema.safeParse({ ...validSale, paymentMethod: "bitcoin" }).success, false);
  });
});

describe("saleDetailSchema", () => {
  const validDetail = { productId: "p1", quantity: 2, unitPrice: 15 };

  it("accepts a valid detail", () => {
    assert.equal(saleDetailSchema.safeParse(validDetail).success, true);
  });

  it("coerces quantity and unit price strings to numbers", () => {
    const result = saleDetailSchema.safeParse({ productId: "p1", quantity: "2", unitPrice: "15.50" });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.quantity, 2);
      assert.equal(result.data.unitPrice, 15.5);
    }
  });

  it("rejects a missing product", () => {
    assert.equal(saleDetailSchema.safeParse({ ...validDetail, productId: "" }).success, false);
  });

  it("rejects zero or negative quantity", () => {
    assert.equal(saleDetailSchema.safeParse({ ...validDetail, quantity: 0 }).success, false);
    assert.equal(saleDetailSchema.safeParse({ ...validDetail, quantity: -1 }).success, false);
  });

  it("rejects a negative unit price", () => {
    assert.equal(saleDetailSchema.safeParse({ ...validDetail, unitPrice: -5 }).success, false);
  });
});
