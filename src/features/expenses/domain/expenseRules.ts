import type { Expense, ExpenseStatus, PaymentMethod } from "@/types";

export const EXPENSE_STATUSES = ["pagado", "pendiente", "anulado"] as const satisfies readonly ExpenseStatus[];

export const PAYMENT_METHODS = [
  "efectivo",
  "tarjeta_credito",
  "tarjeta_debito",
  "yape",
  "plin",
  "transferencia",
  "otro",
] as const satisfies readonly PaymentMethod[];

export interface NewExpenseInput {
  description: string;
  amount: number;
  categoryId: string;
  paymentMethod: PaymentMethod;
  status: ExpenseStatus;
  date: string;
  time: string;
  notes?: string;
  receiptPhoto?: string;
  workspaceId?: string;
}

export function canEditExpense(status: ExpenseStatus): boolean {
  return status !== "anulado";
}

export function canVoidExpense(status: ExpenseStatus): boolean {
  return status !== "anulado";
}

export function isVoided(expense: Pick<Expense, "status">): boolean {
  return expense.status === "anulado";
}

export function buildExpense(input: {
  data: NewExpenseInput;
  code: string;
  now: string;
}): Expense {
  const { data, code, now } = input;
  return {
    id: crypto.randomUUID(),
    code,
    description: data.description.trim(),
    amount: data.amount,
    categoryId: data.categoryId,
    paymentMethod: data.paymentMethod,
    status: data.status,
    date: data.date,
    time: data.time,
    notes: data.notes || "",
    receiptPhoto: data.receiptPhoto,
    workspaceId: data.workspaceId ?? "default",
    voidedAt: null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: "pending",
  };
}

export interface FilterableExpense {
  id: string;
  code: string;
  description: string;
  categoryId: string;
  paymentMethod: string;
  amount: number;
  date: string;
  deleted?: boolean;
  status?: string;
}

export interface ExpenseFilters {
  search?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function filterExpenses<T extends FilterableExpense>(
  expenses: T[],
  filters: ExpenseFilters = {},
  categoryNames: Record<string, string> = {}
): T[] {
  const search = (filters.search || "").trim().toLowerCase();

  return expenses.filter((expense) => {
    if (expense.deleted === true) return false;

    if (filters.categoryId && expense.categoryId !== filters.categoryId) return false;
    if (filters.dateFrom && expense.date < filters.dateFrom) return false;
    if (filters.dateTo && expense.date > filters.dateTo) return false;

    if (search) {
      const haystack = [
        expense.code,
        expense.description,
        categoryNames[expense.categoryId] || "",
        expense.paymentMethod,
        String(expense.amount),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}
