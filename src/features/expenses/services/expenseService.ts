import { db } from "@/lib/db";
import { generateExpenseCode } from "@/utils/code";
import type { Expense, ExpenseDetail } from "@/types";
import type { ExpenseFormData } from "../schemas/expenseSchema";

export async function createExpense(
  data: ExpenseFormData,
  code?: string
): Promise<Expense> {
  const expenseId = crypto.randomUUID();
  const now = new Date().toISOString();
  const finalCode = code || (await generateExpenseCode());
  const totalAmount = data.hasDetails
    ? (data.details || []).reduce((s, d) => s + d.subtotal, 0)
    : data.amount || 0;

  const expense: Expense = {
    id: expenseId,
    code: finalCode,
    name: data.name,
    description: data.description || "",
    amount: totalAmount,
    categoryId: data.categoryId,
    typeId: data.typeId,
    paymentMethod: data.paymentMethod,
    status: data.status,
    date: data.date,
    time: data.time,
    notes: data.notes || "",
    invoicePhoto: data.invoicePhoto,
    hasDetails: data.hasDetails,
    totalAmount,
    itemsCount: data.hasDetails ? (data.details || []).length : 0,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: "pending",
  };
  await db.expenses.add(expense);

  if (data.hasDetails && data.details) {
    const expenseDetails: ExpenseDetail[] = data.details.map((d) => ({
      id: d.id,
      expenseId,
      productName: d.productName,
      quantity: d.quantity,
      unitPrice: d.unitPrice,
      subtotal: d.subtotal,
      createdAt: now,
      syncStatus: "pending" as const,
    }));
    await db.expenseDetails.bulkAdd(expenseDetails);
  }

  return expense;
}
