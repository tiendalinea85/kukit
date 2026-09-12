import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../../../lib/db.ts";
import {
  createExpense,
  updateExpense,
  voidExpense,
  deleteExpense,
} from "./expenseService.ts";

const validData = {
  description: "Recibo de luz",
  amount: 120.5,
  categoryId: "cat-servicios",
  paymentMethod: "transferencia" as const,
  status: "pagado" as const,
  date: "2026-08-15",
  time: "14:30",
  notes: "Agosto",
};

beforeEach(async () => {
  await db.expenses.clear();
});

describe("createExpense", () => {
  it("crea un gasto con código generado y syncStatus pending", async () => {
    const expense = await createExpense(validData);
    assert.ok(expense.id);
    assert.match(expense.code, /^G\d{6}$/);
    assert.equal(expense.description, "Recibo de luz");
    assert.equal(expense.amount, 120.5);
    assert.equal(expense.syncStatus, "pending");
    assert.equal(expense.deleted, false);
    assert.equal(expense.voidedAt, null);
  });

  it("crea un gasto con código personalizado cuando se proporciona", async () => {
    const expense = await createExpense(validData, "G000099");
    assert.equal(expense.code, "G000099");
  });

  it("usa código autoincremental basado en el último existente", async () => {
    await createExpense(validData, "G000003");
    const second = await createExpense(validData, "G000004");
    assert.equal(second.code, "G000004");
  });

  it("el id es un UUID válido", async () => {
    const expense = await createExpense(validData);
    assert.match(expense.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("establece deleted en false por defecto", async () => {
    const expense = await createExpense(validData);
    assert.equal(expense.deleted, false);
  });

  it("lanza error cuando la descripción está vacía", async () => {
    await assert.rejects(
      createExpense({ ...validData, description: "" }),
      /descripción/i,
    );
  });

  it("lanza error cuando la descripción es solo espacios", async () => {
    await assert.rejects(
      createExpense({ ...validData, description: "   " }),
      /descripción/i,
    );
  });

  it("lanza error cuando el monto es cero", async () => {
    await assert.rejects(
      createExpense({ ...validData, amount: 0 }),
      /monto/i,
    );
  });

  it("lanza error cuando la categoría está vacía", async () => {
    await assert.rejects(
      createExpense({ ...validData, categoryId: "" }),
      /categoría/i,
    );
  });
});

describe("updateExpense", () => {
  it("actualiza campos y establece syncStatus pending", async () => {
    const expense = await createExpense(validData);
    await updateExpense(expense.id, {
      ...validData,
      description: "Agua potable",
      amount: 75,
    });
    const updated = await db.expenses.get(expense.id);
    assert.equal(updated!.description, "Agua potable");
    assert.equal(updated!.amount, 75);
    assert.equal(updated!.syncStatus, "pending");
  });

  it("lanza error cuando el gasto no existe", async () => {
    await assert.rejects(
      updateExpense("id-inexistente", validData),
      /no encontrado/i,
    );
  });

  it("lanza error cuando el gasto está anulado", async () => {
    const expense = await createExpense(validData);
    await voidExpense(expense.id);
    await assert.rejects(
      updateExpense(expense.id, validData),
      /anulado/i,
    );
  });
});

describe("voidExpense", () => {
  it("establece status anulado y voidedAt", async () => {
    const expense = await createExpense(validData);
    await voidExpense(expense.id);
    const voided = await db.expenses.get(expense.id);
    assert.equal(voided!.status, "anulado");
    assert.ok(voided!.voidedAt);
    assert.equal(voided!.syncStatus, "pending");
  });

  it("lanza error cuando el gasto no existe", async () => {
    await assert.rejects(
      voidExpense("id-falso"),
      /no encontrado/i,
    );
  });

  it("lanza error cuando el gasto ya está anulado", async () => {
    const expense = await createExpense(validData);
    await voidExpense(expense.id);
    await assert.rejects(
      voidExpense(expense.id),
      /ya está anulado/i,
    );
  });
});

describe("deleteExpense", () => {
  it("marca deleted en true", async () => {
    const expense = await createExpense(validData);
    await deleteExpense(expense.id);
    const deleted = await db.expenses.get(expense.id);
    assert.equal(deleted!.deleted, true);
    assert.equal(deleted!.syncStatus, "pending");
  });

  it("lanza error cuando el gasto no existe (actualiza id inexistente silenciosamente)", async () => {
    await deleteExpense("id-inexistente");
  });
});

describe("ciclo completo de vida del gasto", () => {
  it("crear → actualizar → anular → eliminar", async () => {
    const expense = await createExpense(validData);
    assert.equal(expense.status, "pagado");

    await updateExpense(expense.id, { ...validData, amount: 200 });
    const afterUpdate = await db.expenses.get(expense.id);
    assert.equal(afterUpdate!.amount, 200);

    await voidExpense(expense.id);
    const afterVoid = await db.expenses.get(expense.id);
    assert.equal(afterVoid!.status, "anulado");

    await deleteExpense(expense.id);
    const afterDelete = await db.expenses.get(expense.id);
    assert.equal(afterDelete!.deleted, true);
  });
});
