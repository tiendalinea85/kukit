import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../../../lib/db.ts";
import { queryExpensesReport } from "./reportService.ts";
import { useWorkspaceStore } from "../../../stores/useWorkspaceStore.ts";
import type { Expense } from "../../../types/index.ts";

function makeExpense(id: string, workspaceId: string, amount: number): Expense {
  return {
    id,
    workspaceId,
    code: `G00000${id}`,
    description: `Gasto ${id}`,
    amount,
    categoryId: "cat-servicios",
    paymentMethod: "efectivo",
    status: "pagado",
    date: "2026-08-15",
    time: "10:00",
    notes: "",
    createdAt: "2026-08-15T10:00:00.000Z",
    updatedAt: "2026-08-15T10:00:00.000Z",
    deleted: false,
    syncStatus: "pending",
  } as Expense;
}

const options = {
  period: "year" as const,
  language: "es" as const,
};

beforeEach(async () => {
  await db.open();
  await db.expenses.clear();
  useWorkspaceStore.setState({ activeWorkspaceId: "default" });
});

describe("queryExpensesReport", () => {
  it("solo agrega los gastos del workspace activo", async () => {
    await db.expenses.bulkAdd([
      makeExpense("a", "default", 100),
      makeExpense("b", "otro", 900),
    ]);

    const result = await queryExpensesReport(options);
    assert.equal(result.count, 1);
    assert.equal(result.totalAmount, 100);
    assert.deepEqual(
      result.expenses.map((e) => e.id),
      ["a"],
    );
  });

  it("cambia de datos al cambiar de workspace activo", async () => {
    await db.expenses.bulkAdd([
      makeExpense("a", "default", 100),
      makeExpense("b", "otro", 900),
    ]);

    useWorkspaceStore.setState({ activeWorkspaceId: "otro" });
    const result = await queryExpensesReport(options);
    assert.equal(result.count, 1);
    assert.equal(result.totalAmount, 900);
  });

  it("permite forzar un workspace concreto y no lo pisa el activo", async () => {
    await db.expenses.bulkAdd([
      makeExpense("a", "default", 100),
      makeExpense("b", "otro", 900),
    ]);

    const result = await queryExpensesReport({ ...options, workspaceId: "otro" });
    assert.equal(result.totalAmount, 900);
  });

  it("devuelve vacío cuando no hay workspace activo", async () => {
    await db.expenses.add(makeExpense("a", "default", 100));
    useWorkspaceStore.setState({ activeWorkspaceId: null });

    const result = await queryExpensesReport(options);
    assert.equal(result.count, 0);
    assert.equal(result.totalAmount, 0);
  });

  it("excluye los gastos borrados (soft delete) del workspace activo", async () => {
    await db.expenses.bulkAdd([
      makeExpense("a", "default", 100),
      { ...makeExpense("b", "default", 50), deleted: true },
    ]);

    const result = await queryExpensesReport(options);
    assert.equal(result.count, 1);
    assert.equal(result.totalAmount, 100);
  });
});