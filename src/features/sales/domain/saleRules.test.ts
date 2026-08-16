import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSale,
  buildSaleDetail,
  canEditSale,
  canVoidSale,
  computeSaleTotal,
  computeSubtotal,
  isConfirmed,
  isVoided,
  filterSales,
  SALE_STATUSES,
  type SaleDetailInput,
  type FilterableSale,
} from "./saleRules.ts";

const details: SaleDetailInput[] = [
  { productId: "p1", code: "LEG-001", name: "Leggings", color: "Negro", quantity: 2, unitPrice: 15 },
  { productId: "p2", code: "TOP-001", name: "Top deportivo", color: "Blanco", quantity: 3, unitPrice: 7.5 },
];

describe("buildSale / buildSaleDetail", () => {
  it("builds a pending sale with computed total and trimmed fields", () => {
    const sale = buildSale(
      { customerId: "c1", date: "2026-08-14", paymentMethod: "efectivo", notes: "  primera venta  ", details },
      "V000001",
      "2026-08-14T10:00:00.000Z",
    );
    assert.equal(sale.code, "V000001");
    assert.equal(sale.status, "pendiente");
    assert.equal(sale.total, 52.5);
    assert.equal(sale.notes, "primera venta");
    assert.equal(sale.confirmedAt, null);
    assert.equal(sale.deleted, false);
  });

  it("marks a sale confirmed when built with status confirmada", () => {
    const sale = buildSale(
      { customerId: "c1", date: "2026-08-14", paymentMethod: "yape", notes: "", status: "confirmada", details },
      "V000002",
      "2026-08-14T10:00:00.000Z",
    );
    assert.equal(sale.status, "confirmada");
    assert.equal(sale.confirmedAt, "2026-08-14T10:00:00.000Z");
  });

  it("computes subtotals rounded to 2 decimals", () => {
    assert.equal(computeSubtotal(3, 7.5), 22.5);
    assert.equal(computeSubtotal(2, 15), 30);
    assert.equal(computeSubtotal(3, 0.1), 0.3);
  });

  it("builds sale details with snapshot fields", () => {
    const detail = buildSaleDetail(details[0], "sale-1", "2026-08-14T10:00:00.000Z");
    assert.equal(detail.saleId, "sale-1");
    assert.equal(detail.subtotal, 30);
    assert.equal(detail.name, "Leggings");
    assert.equal(detail.color, "Negro");
  });

  it("computes the total from unit prices", () => {
    assert.equal(computeSaleTotal(details), 52.5);
  });
});

describe("sale status lifecycle", () => {
  it("exposes the canonical status list", () => {
    assert.deepEqual([...SALE_STATUSES], ["pendiente", "confirmada", "anulada"]);
  });

  it("only allows editing pending sales", () => {
    assert.equal(canEditSale("pendiente"), true);
    assert.equal(canEditSale("confirmada"), false);
    assert.equal(canEditSale("anulada"), false);
  });

  it("allows voiding pending and confirmed sales but not anuladas", () => {
    assert.equal(canVoidSale("pendiente"), true);
    assert.equal(canVoidSale("confirmada"), true);
    assert.equal(canVoidSale("anulada"), false);
  });

  it("identifies confirmed and voided sales", () => {
    assert.equal(isConfirmed({ status: "confirmada" }), true);
    assert.equal(isVoided({ status: "anulada" }), true);
    assert.equal(isVoided({ status: "pendiente" }), false);
  });
});

describe("filterSales", () => {
  const base = (over: Partial<FilterableSale>): FilterableSale => ({
    id: "s1",
    code: "V000001",
    date: "2026-08-10",
    paymentMethod: "efectivo",
    total: 30,
    status: "confirmada",
    customerId: "c-mary",
    customerName: "Mary",
    detailLabels: ["LEG-001 Leggings Negro"],
    deleted: false,
    ...over,
  });

  const sales = [
    base({}),
    base({ id: "s2", code: "V000002", date: "2026-08-12", status: "pendiente", total: 22.5, detailLabels: ["TOP-001 Top blanco"] }),
    base({ id: "s3", code: "V000003", status: "anulada", deleted: false, customerId: "c-carlos", customerName: "Carlos" }),
    base({ id: "s4", code: "V000004", deleted: true }),
  ];

  it("returns all non-deleted sales with no filters", () => {
    assert.equal(filterSales(sales, {}).length, 3);
  });

  it("filters by status", () => {
    assert.equal(filterSales(sales, { status: "confirmada" }).length, 1);
    assert.equal(filterSales(sales, { status: "pendiente" }).length, 1);
  });

  it("filters by payment method", () => {
    assert.equal(filterSales(sales, { paymentMethod: "yape" }).length, 0);
  });

  it("filters by date range (inclusive)", () => {
    assert.equal(filterSales(sales, { dateFrom: "2026-08-11", dateTo: "2026-08-12" }).length, 1);
  });

  it("filters by customer name", () => {
    assert.equal(filterSales(sales, { customerId: "carlos" }).length, 0);
  });

  it("searches by code", () => {
    assert.equal(filterSales(sales, { search: "V000002" }).length, 1);
  });

  it("searches by customer name and product labels", () => {
    assert.equal(filterSales(sales, { search: "Mary" }).length, 2);
    assert.equal(filterSales(sales, { search: "LEG-001" }).length, 2);
  });

  it("searches by total", () => {
    assert.equal(filterSales(sales, { search: "22.5" }).length, 1);
  });

  it("never includes deleted sales", () => {
    assert.equal(filterSales(sales, { search: "V000004" }).length, 0);
  });
});
