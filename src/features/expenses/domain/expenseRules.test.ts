import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  buildExpense,
  canEditExpense,
  canVoidExpense,
  isVoided,
  filterExpenses,
  computeSubtotal,
  computeExpenseTotal,
  buildExpenseDetail,
} from "./expenseRules.ts";
import type { NewExpenseInput } from "./expenseRules.ts";

const now = "2026-08-14T10:00:00.000Z";

const baseInput: NewExpenseInput = {
  description: "  Recibo de luz  ",
  amount: 98.3,
  categoryId: "cat-servicios",
  paymentMethod: "transferencia",
  status: "pagado",
  date: "2026-08-14",
  time: "14:00",
};

describe("buildExpense", () => {
  it("creates an expense with trimmed description and defaults", () => {
    const expense = buildExpense({ data: baseInput, code: "G000001", now });
    assert.equal(expense.id.length > 0, true);
    assert.equal(expense.code, "G000001");
    assert.equal(expense.description, "Recibo de luz");
    assert.equal(expense.amount, 98.3);
    assert.equal(expense.categoryId, "cat-servicios");
    assert.equal(expense.paymentMethod, "transferencia");
    assert.equal(expense.status, "pagado");
    assert.equal(expense.date, "2026-08-14");
    assert.equal(expense.time, "14:00");
    assert.equal(expense.notes, "");
    assert.equal(expense.voidedAt, null);
    assert.equal(expense.deleted, false);
    assert.equal(expense.syncStatus, "pending");
    assert.equal(expense.createdAt, now);
    assert.equal(expense.updatedAt, now);
  });

  it("preserves optional notes and receipt photo", () => {
    const expense = buildExpense({
      data: { ...baseInput, notes: "Período mensual", receiptPhoto: "data:image/png;base64,abc" },
      code: "G000002",
      now,
    });
    assert.equal(expense.notes, "Período mensual");
    assert.equal(expense.receiptPhoto, "data:image/png;base64,abc");
  });
});

describe("status lifecycle", () => {
  it("allows editing and voiding non-voided expenses", () => {
    for (const status of ["pagado", "pendiente"] as const) {
      assert.equal(canEditExpense(status), true);
      assert.equal(canVoidExpense(status), true);
      assert.equal(isVoided({ status }), false);
    }
  });

  it("forbids editing and voiding an anulado expense", () => {
    assert.equal(canEditExpense("anulado"), false);
    assert.equal(canVoidExpense("anulado"), false);
    assert.equal(isVoided({ status: "anulado" }), true);
  });

  it("exposes the canonical status and payment method lists", () => {
    assert.deepEqual([...EXPENSE_STATUSES], ["pagado", "pendiente", "anulado"]);
    assert.deepEqual([...PAYMENT_METHODS], [
      "efectivo",
      "tarjeta_credito",
      "tarjeta_debito",
      "yape",
      "plin",
      "transferencia",
      "otro",
    ]);
  });
});

describe("computeSubtotal", () => {
  it("multiplies quantity by unit price", () => {
    assert.equal(computeSubtotal(4, 120), 480);
  });

  it("rounds to 2 decimals", () => {
    assert.equal(computeSubtotal(3, 10.333), 31);
  });

  it("avoids floating point errors", () => {
    assert.equal(computeSubtotal(0.1, 0.2), 0.02);
  });
});

describe("computeExpenseTotal", () => {
  it("sums subtotals across detail lines", () => {
    const total = computeExpenseTotal([
      { productId: "p1", code: "TEL", name: "Tela", color: "", quantity: 4, unitPrice: 120 },
      { productId: "p2", code: "CIE", name: "Cierres", color: "", quantity: 5, unitPrice: 1.5 },
    ]);
    assert.equal(total, 487.5);
  });

  it("returns 0 with no details", () => {
    assert.equal(computeExpenseTotal([]), 0);
  });

  it("rounds the final total to 2 decimals", () => {
    const total = computeExpenseTotal([
      { productId: "p1", code: "A", name: "A", color: "", quantity: 1, unitPrice: 0.1 },
      { productId: "p2", code: "B", name: "B", color: "", quantity: 1, unitPrice: 0.2 },
    ]);
    assert.equal(total, 0.3);
  });
});

describe("buildExpenseDetail", () => {
  it("computes subtotal and snapshots the product", () => {
    const detail = buildExpenseDetail({
      data: { productId: "p1", code: "TEL-001", name: "Rollo de tela", color: "Negro", quantity: 4, unitPrice: 120 },
      expenseId: "exp-1",
      workspaceId: "default",
      now: "2026-08-14T10:00:00.000Z",
    });
    assert.equal(detail.expenseId, "exp-1");
    assert.equal(detail.productId, "p1");
    assert.equal(detail.code, "TEL-001");
    assert.equal(detail.name, "Rollo de tela");
    assert.equal(detail.color, "Negro");
    assert.equal(detail.quantity, 4);
    assert.equal(detail.unitPrice, 120);
    assert.equal(detail.subtotal, 480);
    assert.equal(detail.createdAt, "2026-08-14T10:00:00.000Z");
    assert.equal(detail.syncStatus, "pending");
    assert.equal(detail.deleted, false);
    assert.ok(detail.id);
  });
});

describe("filterExpenses", () => {
  const expenses = [
    { id: "1", code: "G000001", description: "Recibo de luz", categoryId: "servicios", paymentMethod: "transferencia", amount: 98.3, date: "2026-08-10", status: "pagado" },
    { id: "2", code: "G000002", description: "Combustible camioneta", categoryId: "transporte", paymentMethod: "efectivo", amount: 45, date: "2026-08-11", status: "pagado" },
    { id: "3", code: "G000003", description: "Arriendo local", categoryId: "arriendo", paymentMethod: "transferencia", amount: 850, date: "2026-08-12", status: "pendiente" },
    { id: "4", code: "G000004", description: "Gasto borrado", categoryId: "otros", paymentMethod: "efectivo", amount: 10, date: "2026-08-13", status: "pagado", deleted: true },
  ];
  const names: Record<string, string> = {
    servicios: "Servicios",
    transporte: "Transporte",
    arriendo: "Arriendo",
    otros: "Otros",
  };

  it("returns all non-deleted expenses with no filters", () => {
    const result = filterExpenses(expenses);
    assert.equal(result.length, 3);
  });

  it("filters by category", () => {
    const result = filterExpenses(expenses, { categoryId: "transporte" });
    assert.equal(result.length, 1);
    assert.equal(result[0].code, "G000002");
  });

  it("filters by date range (inclusive)", () => {
    const result = filterExpenses(expenses, { dateFrom: "2026-08-11", dateTo: "2026-08-12" });
    assert.deepEqual(result.map((e) => e.code), ["G000002", "G000003"]);
  });

  it("searches by description text", () => {
    const result = filterExpenses(expenses, { search: "luz" });
    assert.equal(result.length, 1);
    assert.equal(result[0].code, "G000001");
  });

  it("searches by code", () => {
    const result = filterExpenses(expenses, { search: "g000003" });
    assert.equal(result.length, 1);
    assert.equal(result[0].code, "G000003");
  });

  it("searches by category name", () => {
    const result = filterExpenses(expenses, { search: "arriendo" }, names);
    assert.equal(result.length, 1);
    assert.equal(result[0].code, "G000003");
  });

  it("searches by payment method", () => {
    const result = filterExpenses(expenses, { search: "efectivo" });
    assert.equal(result.length, 1);
    assert.equal(result[0].code, "G000002");
  });

  it("searches by amount", () => {
    const result = filterExpenses(expenses, { search: "850" });
    assert.equal(result.length, 1);
    assert.equal(result[0].code, "G000003");
  });

  it("combines search and category filters", () => {
    const result = filterExpenses(expenses, { search: "luz", categoryId: "servicios" });
    assert.equal(result.length, 1);
  });

  it("excludes deleted expenses even when matching search", () => {
    const result = filterExpenses(expenses, { search: "borrado" });
    assert.equal(result.length, 0);
  });

  it("does not include deleted expenses in category filter", () => {
    const result = filterExpenses(expenses, { categoryId: "otros" });
    assert.equal(result.length, 0);
  });
});
