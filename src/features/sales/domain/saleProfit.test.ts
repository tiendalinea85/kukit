import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildProfitSummary, computeSaleProfit, computeWeightedCosts } from "./saleProfit.ts";
import type { SaleDetail } from "@/types";

function detail(overrides: Partial<SaleDetail>): SaleDetail {
  return {
    id: "detail-1",
    workspaceId: "ws-1",
    saleId: "sale-1",
    productId: "product-1",
    code: "P-001",
    name: "Producto",
    color: "",
    quantity: 1,
    unitPrice: 10,
    subtotal: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
    deleted: false,
    syncStatus: "synced",
    ...overrides,
  };
}

describe("computeWeightedCosts", () => {
  it("averages unit cost weighted by quantity", () => {
    const costs = computeWeightedCosts([
      { productId: "p1", quantity: 10, unitPrice: 2 },
      { productId: "p1", quantity: 30, unitPrice: 4 },
    ]);

    assert.equal(costs.get("p1"), 3.5);
  });

  it("keeps products independent", () => {
    const costs = computeWeightedCosts([
      { productId: "p1", quantity: 2, unitPrice: 5 },
      { productId: "p2", quantity: 1, unitPrice: 9 },
    ]);

    assert.equal(costs.get("p1"), 5);
    assert.equal(costs.get("p2"), 9);
  });

  it("ignores rows without positive quantity", () => {
    const costs = computeWeightedCosts([
      { productId: "p1", quantity: 0, unitPrice: 5 },
      { productId: "p2", quantity: -1, unitPrice: 5 },
    ]);

    assert.equal(costs.size, 0);
  });
});

describe("computeSaleProfit", () => {
  it("computes revenue, cost and profit from weighted costs", () => {
    const costs = new Map([["product-1", 4]]);
    const result = computeSaleProfit(
      [detail({ quantity: 3, unitPrice: 10, subtotal: 30 })],
      costs,
    );

    assert.equal(result.revenue, 30);
    assert.equal(result.cost, 12);
    assert.equal(result.profit, 18);
    assert.equal(result.margin, 0.6);
    assert.equal(result.missingCostCount, 0);
  });

  it("treats products without purchase cost as zero cost and flags them", () => {
    const result = computeSaleProfit(
      [detail({ productId: "unknown", quantity: 2, unitPrice: 5, subtotal: 10 })],
      new Map(),
    );

    assert.equal(result.cost, 0);
    assert.equal(result.profit, 10);
    assert.equal(result.missingCostCount, 1);
  });

  it("returns zero margin when there is no revenue", () => {
    const result = computeSaleProfit([], new Map());

    assert.equal(result.revenue, 0);
    assert.equal(result.margin, 0);
  });
});

describe("buildProfitSummary", () => {
  it("subtracts operating expenses from gross profit", () => {
    const costs = new Map([["product-1", 4]]);
    const sale = computeSaleProfit(
      [detail({ quantity: 2, unitPrice: 10, subtotal: 20 })],
      costs,
    );
    const summary = buildProfitSummary(sale, 5, 1);

    assert.equal(summary.revenue, 20);
    assert.equal(summary.costOfGoods, 8);
    assert.equal(summary.grossProfit, 12);
    assert.equal(summary.operatingExpenses, 5);
    assert.equal(summary.profit, 7);
    assert.equal(summary.margin, 0.35);
    assert.equal(summary.salesCount, 1);
  });
});
