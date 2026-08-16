import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeStock, computeStockById, missingStock } from "./stockRules.ts";

describe("computeStock", () => {
  it("sums entradas and subtracts salidas", () => {
    const movements = [
      { type: "entrada" as const, quantity: 40 },
      { type: "salida" as const, quantity: 2 },
      { type: "entrada" as const, quantity: 10 },
      { type: "salida" as const, quantity: 5 },
    ];
    assert.equal(computeStock(movements), 43);
  });

  it("returns zero for empty movements", () => {
    assert.equal(computeStock([]), 0);
  });
});

describe("computeStockById", () => {
  it("computes stock per product", () => {
    const movements = [
      { productId: "a", type: "entrada" as const, quantity: 40 },
      { productId: "a", type: "salida" as const, quantity: 2 },
      { productId: "b", type: "entrada" as const, quantity: 10 },
    ];
    const byId = computeStockById(movements);
    assert.equal(byId["a"], 38);
    assert.equal(byId["b"], 10);
  });

  it("handles products with only salidas (no stock)", () => {
    const byId = computeStockById([{ productId: "a", type: "salida" as const, quantity: 5 }]);
    assert.equal(byId["a"], -5);
  });
});

describe("missingStock", () => {
  it("reports products whose requirement exceeds available stock", () => {
    const missing = missingStock(
      [
        { productId: "a", label: "LEG-001", quantity: 2 },
        { productId: "b", label: "TOP-001", quantity: 3 },
      ],
      { a: 2, b: 1 },
    );
    assert.equal(missing.length, 1);
    assert.equal(missing[0].productId, "b");
    assert.equal(missing[0].required, 3);
    assert.equal(missing[0].available, 1);
  });

  it("reports nothing when stock is sufficient", () => {
    const missing = missingStock(
      [{ productId: "a", label: "LEG-001", quantity: 2 }],
      { a: 5 },
    );
    assert.equal(missing.length, 0);
  });

  it("reports products with no stock at all", () => {
    const missing = missingStock(
      [{ productId: "a", label: "LEG-001", quantity: 1 }],
      {},
    );
    assert.equal(missing.length, 1);
    assert.equal(missing[0].available, 0);
  });
});
