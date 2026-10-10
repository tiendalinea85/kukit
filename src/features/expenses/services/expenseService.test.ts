import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../../../lib/db.ts";
import { createExpense, updateExpense, voidExpense } from "./expenseService.ts";
import { useWorkspaceStore } from "../../../stores/useWorkspaceStore.ts";
import type { ExpenseFormData } from "../schemas/expenseSchema.ts";
import type { Expense } from "../../../types/index.ts";

const validInput: ExpenseFormData = {
  description: "Recibo de luz",
  amount: 98.3,
  categoryId: "cat-servicios",
  paymentMethod: "transferencia",
  status: "pagado",
  date: "2026-08-14",
  time: "14:00",
};

function makeExpense(id: string, workspaceId: string): Expense {
  return {
    id,
    workspaceId,
    code: `G00000${id}`,
    description: "Recibo de luz",
    amount: 98.3,
    categoryId: "cat-servicios",
    paymentMethod: "transferencia",
    status: "pagado",
    date: "2026-08-14",
    time: "14:00",
    notes: "",
    voidedAt: null,
    createdAt: "2026-08-14T10:00:00.000Z",
    updatedAt: "2026-08-14T10:00:00.000Z",
    deleted: false,
    syncStatus: "pending",
  };
}

beforeEach(async () => {
  await db.open();
  await db.expenses.clear();
  useWorkspaceStore.setState({ activeWorkspaceId: "default" });
});

describe("createExpense (validación runtime)", () => {
  it("rejects a legacy status instead of persisting it", async () => {
    await assert.rejects(
      createExpense({ ...validInput, status: "activo" } as unknown as ExpenseFormData, "G000001"),
      (err: unknown) => err instanceof Error,
    );
    assert.equal(await db.expenses.count(), 0);
  });

  it("accepts each canonical status", async () => {
    for (const status of ["pagado", "pendiente", "anulado"] as const) {
      await createExpense({ ...validInput, status }, `G0000${status[0]}1`);
      assert.ok(await db.expenses.where("status").equals(status).first());
    }
  });
});

describe("updateExpense", () => {
  it("rejects a legacy status at runtime and does not touch the row", async () => {
    await db.expenses.add(makeExpense("e1", "default"));
    await assert.rejects(
      updateExpense("e1", { ...validInput, status: "cancelado" } as unknown as ExpenseFormData),
      (err: unknown) => err instanceof Error,
    );
    const row = await db.expenses.get("e1");
    assert.equal(row?.status, "pagado");
  });

  it("persists only the canonical status sent by the edit form", async () => {
    await db.expenses.add(makeExpense("e1", "default"));
    await updateExpense("e1", { ...validInput, status: "pendiente" });
    const row = await db.expenses.get("e1");
    assert.equal(row?.status, "pendiente");
    assert.equal(row?.updatedAt !== "2026-08-14T10:00:00.000Z", true);
  });

  it("keeps an unchanged status without accidental resets", async () => {
    await db.expenses.add(makeExpense("e1", "default"));
    await updateExpense("e1", validInput);
    const row = await db.expenses.get("e1");
    assert.equal(row?.status, "pagado");
  });

  it("forbids editing an anulado expense", async () => {
    await db.expenses.add({ ...makeExpense("e1", "default"), status: "anulado", voidedAt: "2026-08-15T10:00:00.000Z" });
    await assert.rejects(updateExpense("e1", validInput), /anulado/);
  });

  it("voidExpense guards an expense already anulado", async () => {
    await db.expenses.add({ ...makeExpense("e1", "default"), status: "anulado", voidedAt: "2026-08-15T10:00:00.000Z" });
    await assert.rejects(voidExpense("e1"), /anulado/);
  });
});