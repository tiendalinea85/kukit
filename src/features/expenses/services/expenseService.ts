import { db } from "@/lib/db";
import { generateExpenseCode } from "@/utils/code";
import { buildExpense, canEditExpense } from "../domain/expenseRules";
import type { Expense } from "@/types";
import { expenseSchema, type ExpenseFormData } from "../schemas/expenseSchema";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function getWorkspaceId(): string {
  return useWorkspaceStore.getState().activeWorkspaceId ?? "default";
}

export async function createExpense(
  data: ExpenseFormData,
  code?: string
): Promise<Expense> {
  const parsed = expenseSchema.parse(data);
  const finalCode = code || (await generateExpenseCode());
  const now = new Date().toISOString();
  const expense = buildExpense({ data: { ...parsed, workspaceId: getWorkspaceId() }, code: finalCode, now });
  await db.expenses.add(expense);
  return expense;
}

export async function updateExpense(id: string, data: ExpenseFormData): Promise<void> {
  const existing = await db.expenses.get(id);
  if (!existing) throw new Error("Gasto no encontrado");
  if (!canEditExpense(existing.status)) {
    throw new Error("Un gasto anulado no puede editarse");
  }

  await db.expenses.update(id, {
    description: data.description.trim(),
    amount: data.amount,
    categoryId: data.categoryId,
    paymentMethod: data.paymentMethod,
    status: data.status,
    date: data.date,
    time: data.time,
    notes: data.notes || "",
    receiptPhoto: data.receiptPhoto,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function voidExpense(id: string): Promise<void> {
  const existing = await db.expenses.get(id);
  if (!existing) throw new Error("Gasto no encontrado");
  if (existing.status === "anulado") throw new Error("El gasto ya está anulado");

  await db.expenses.update(id, {
    status: "anulado" as const,
    voidedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteExpense(id: string): Promise<void> {
  await db.expenses.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}
