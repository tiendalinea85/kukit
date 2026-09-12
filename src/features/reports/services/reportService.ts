import { db } from "@/lib/db";
import { normalizeText } from "@/utils/text";
import type { Category, PeriodFilter, Expense } from "@/types";

export interface ReportQueryResult {
  expenses: Expense[];
  categories: Category[];
  totalAmount: number;
  count: number;
  average: number;
  byCategory: { name: string; value: number; color: string }[];
  byDate: { date: string; amount: number }[];
  topCategory?: { name: string; value: number };
  rangeText: string;
}

export const PERIODS: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "week", label: "Esta semana" },
  { value: "lastWeek", label: "Semana pasada" },
  { value: "month", label: "Este mes" },
  { value: "lastMonth", label: "Mes pasado" },
  { value: "year", label: "Este año" },
  { value: "custom", label: "Personalizado" },
];

export function getDateRange(period: PeriodFilter): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  switch (period) {
    case "today":
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case "week":
      start.setDate(start.getDate() - start.getDay());
      break;
    case "lastWeek":
      start.setDate(start.getDate() - start.getDay() - 7);
      end.setDate(start.getDate() + 6);
      break;
    case "month":
      start.setDate(1);
      break;
    case "lastMonth":
      start.setMonth(start.getMonth() - 1, 1);
      end.setMonth(end.getMonth(), 0);
      break;
    case "year":
      start.setMonth(0, 1);
      break;
    default:
      break;
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isInRange(expense: Expense, start: Date, end: Date): boolean {
  const [y, m, d] = expense.date.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date >= start && date <= end;
}

export async function queryExpensesReport(options: {
  period: PeriodFilter;
  dateFrom?: string;
  dateTo?: string;
  categoryName?: string;
  language: "es" | "en";
  workspaceId?: string;
}): Promise<ReportQueryResult> {
  const [all, categories] = await Promise.all([
    options.workspaceId
      ? db.expenses.where("workspaceId").equals(options.workspaceId).toArray()
      : db.expenses.toArray(),
    db.categories.toArray(),
  ]);

  let filtered = all.filter((e) => e.deleted !== true);

  if (options.period === "custom" && options.dateFrom && options.dateTo) {
    const start = new Date(options.dateFrom);
    const end = new Date(options.dateTo);
    end.setHours(23, 59, 59, 999);
    filtered = filtered.filter((ex) => isInRange(ex, start, end));
  } else if (options.period !== "custom") {
    const { start, end } = getDateRange(options.period);
    filtered = filtered.filter((ex) => isInRange(ex, start, end));
  }

  if (options.categoryName) {
    const cat = categories.find(
      (c) => normalizeText(c.name) === normalizeText(options.categoryName!)
    );
    if (cat) filtered = filtered.filter((ex) => ex.categoryId === cat.id);
  }

  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);
  const count = filtered.length;
  const average = count ? totalAmount / count : 0;

  const byCategory = Object.entries(
    filtered.reduce<Record<string, number>>((map, e) => {
      map[e.categoryId] = (map[e.categoryId] || 0) + e.amount;
      return map;
    }, {})
  )
    .map(([id, amount]) => ({
      name: categories.find((c) => c.id === id)?.name || "Sin categoría",
      value: amount,
      color: categories.find((c) => c.id === id)?.color || "#78716c",
    }))
    .sort((a, b) => b.value - a.value);

  const byDate = Object.entries(
    filtered.reduce<Record<string, number>>((map, e) => {
      map[e.date] = (map[e.date] || 0) + e.amount;
      return map;
    }, {})
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));

  const topCategory = byCategory[0];

  const loc = options.language === "es" ? "es-EC" : "en-US";
  const rangeText =
    options.period === "custom" && options.dateFrom && options.dateTo
      ? options.language === "es"
        ? `${options.dateFrom} al ${options.dateTo}`
        : `${options.dateFrom} to ${options.dateTo}`
      : (() => {
          const { start, end } = getDateRange(options.period);
          return `${start.toLocaleDateString(loc)} ${
            options.language === "es" ? "al" : "to"
          } ${end.toLocaleDateString(loc)}`;
        })();

  return {
    expenses: filtered,
    categories,
    totalAmount,
    count,
    average,
    byCategory,
    byDate,
    topCategory,
    rangeText,
  };
}
