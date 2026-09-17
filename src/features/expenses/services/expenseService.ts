import { db } from "@/lib/db";
import { generateExpenseCode } from "@/utils/code";
import { buildExpense, buildExpenseDetail, canEditExpense, computeExpenseTotal } from "../domain/expenseRules";
import type { Expense, ExpenseDetail, ExpenseDetailInput, Product } from "@/types";
import { expenseSchema, type ExpenseFormData } from "../schemas/expenseSchema";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function getWorkspaceId(): string {
  return useWorkspaceStore.getState().activeWorkspaceId ?? "default";
}

export async function createExpense(
  data: ExpenseFormData,
  code?: string,
  details: ExpenseDetailInput[] = []
): Promise<Expense> {
  const parsed = expenseSchema.parse(data);
  const finalCode = code || (await generateExpenseCode());
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();

  let amount = parsed.amount;
  if (details.length > 0) {
    amount = computeExpenseTotal(details);
  }

  const expense = buildExpense({ data: { ...parsed, amount, workspaceId }, code: finalCode, now });
  const detailRows =
    details.length > 0
      ? details.map((d) =>
          buildExpenseDetail({ data: d, expenseId: expense.id, workspaceId, now }),
        )
      : [];

  await db.transaction("rw", db.expenses, db.expenseDetails, async () => {
    await db.expenses.add(expense);
    if (detailRows.length > 0) await db.expenseDetails.bulkAdd(detailRows);
  });

  return expense;
}

export async function updateExpense(
  id: string,
  data: ExpenseFormData,
  details: ExpenseDetailInput[] = []
): Promise<void> {
  const existing = await db.expenses.get(id);
  if (!existing) throw new Error("Gasto no encontrado");
  if (!canEditExpense(existing.status)) {
    throw new Error("Un gasto anulado no puede editarse");
  }

  let amount = data.amount;
  if (details.length > 0) {
    amount = computeExpenseTotal(details);
  }

  const now = new Date().toISOString();
  const workspaceId = existing.workspaceId || "default";
  const detailRows =
    details.length > 0
      ? details.map((d) =>
          buildExpenseDetail({ data: d, expenseId: id, workspaceId, now }),
        )
      : [];

  await db.transaction("rw", db.expenses, db.expenseDetails, async () => {
    await db.expenses.update(id, {
      description: data.description.trim(),
      amount,
      categoryId: data.categoryId,
      paymentMethod: data.paymentMethod,
      status: data.status,
      date: data.date,
      time: data.time,
      notes: data.notes || "",
      receiptPhoto: data.receiptPhoto,
      updatedAt: now,
      syncStatus: "pending" as const,
    });
    // Soft-delete: las líneas anteriores se marcan deleted=true y quedan en
    // "pending" para que el Sync Engine propague el tombstone al servidor.
    // (Un DELETE físico impediría que el servidor se entere del borrado y
    //  resucitaría las líneas huérfanas en otros dispositivos.)
    await db.expenseDetails
      .where("expenseId")
      .equals(id)
      .modify({ deleted: true, syncStatus: "pending" as const });
    if (detailRows.length > 0) await db.expenseDetails.bulkAdd(detailRows);
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
  await db.transaction("rw", db.expenses, db.expenseDetails, async () => {
    // Soft-delete de las líneas: el tombstone se propaga por el Sync Engine
    // (deleted=true) en lugar de un DELETE físico que el servidor nunca vería.
    await db.expenseDetails
      .where("expenseId")
      .equals(id)
      .modify({ deleted: true, syncStatus: "pending" as const });
    await db.expenses.update(id, {
      deleted: true,
      syncStatus: "pending" as const,
    });
  });
}

export async function listExpenseDetails(expenseId: string): Promise<ExpenseDetail[]> {
  const all = await db.expenseDetails.where("expenseId").equals(expenseId).toArray();
  return all.filter((d) => !d.deleted);
}

export async function quickCreateProduct(data: {
  code: string;
  name: string;
}): Promise<Product> {
  const t = new Date().toISOString();
  const product: Product = {
    id: crypto.randomUUID(),
    workspaceId: getWorkspaceId(),
    code: data.code.trim(),
    name: data.name.trim(),
    color: "",
    categoryId: "",
    createdAt: t,
    updatedAt: t,
    deleted: false,
    syncStatus: "pending",
  };
  await db.products.add(product);
  return product;
}

export async function listProducts(): Promise<Product[]> {
  const workspaceId = getWorkspaceId();
  const all = await db.products.toArray();
  return all
    .filter((p) => !p.deleted && p.workspaceId === workspaceId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
