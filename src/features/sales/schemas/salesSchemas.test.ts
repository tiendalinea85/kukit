import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { customerSchema } from "./customerSchema.ts";
import { productSchema, productWithStockSchema } from "./productSchema.ts";

describe("customerSchema", () => {
  it("accepts a valid customer", () => {
    assert.equal(customerSchema.safeParse({ name: "Mary", phone: "987 654 321", address: "Av. Principal", notes: "Frecuente" }).success, true);
  });

  it("accepts only the name", () => {
    assert.equal(customerSchema.safeParse({ name: "Mary" }).success, true);
  });

  it("trims and rejects empty names", () => {
    assert.equal(customerSchema.safeParse({ name: "   " }).success, false);
  });

  it("rejects an empty name", () => {
    assert.equal(customerSchema.safeParse({}).success, false);
  });
});

describe("productSchema", () => {
  it("accepts a valid product", () => {
    assert.equal(productSchema.safeParse({ code: "LEG-001", name: "Leggings", color: "Negro" }).success, true);
  });

  it("accepts a product without color", () => {
    assert.equal(productSchema.safeParse({ code: "LEG-001", name: "Leggings" }).success, true);
  });

  it("rejects empty code or name", () => {
    assert.equal(productSchema.safeParse({ code: "", name: "Leggings" }).success, false);
    assert.equal(productSchema.safeParse({ code: "LEG-001", name: "  " }).success, false);
  });
});

describe("productWithStockSchema", () => {
  it("accepts an initial stock of zero or a positive number", () => {
    assert.equal(productWithStockSchema.safeParse({ code: "LEG-001", name: "Leggings", initialStock: 0 }).success, true);
    assert.equal(productWithStockSchema.safeParse({ code: "LEG-001", name: "Leggings", initialStock: 50 }).success, true);
    assert.equal(productWithStockSchema.safeParse({ code: "LEG-001", name: "Leggings", initialStock: "10" }).success, true);
  });

  it("rejects a negative initial stock", () => {
    assert.equal(productWithStockSchema.safeParse({ code: "LEG-001", name: "Leggings", initialStock: -1 }).success, false);
  });

  it("makes initialStock optional", () => {
    assert.equal(productWithStockSchema.safeParse({ code: "LEG-001", name: "Leggings" }).success, true);
  });
});
