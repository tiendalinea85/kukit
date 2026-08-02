import { db } from "@/lib/db";
import { t } from "@/lib/translations";
import { normalizeText } from "@/utils/text";
import {
  queryExpensesReport,
  type ReportQueryResult,
} from "@/features/reports/services/reportService";
import type { PeriodFilter } from "@/types";
import type { Expense } from "@/types";
import type { ExpenseFormData } from "@/features/expenses/schemas/expenseSchema";
import type {
  VoiceIntent,
  AddExpenseIntent,
  QueryReportIntent,
  DeleteExpenseIntent,
} from "./schemas";

export type VoiceActionResult =
  | { type: "show_confirmation"; expenseData: ExpenseFormData; intent: AddExpenseIntent }
  | { type: "show_report"; report: ReportQueryResult; summaryText: string; intent: QueryReportIntent }
  | { type: "confirm_delete"; candidates: Expense[]; intent: DeleteExpenseIntent }
  | { type: "navigate"; target: string }
  | { type: "unclear"; reason: string };

const VOICE_PERIOD_MAP: Record<string, PeriodFilter> = {
  today: "today",
  this_week: "week",
  this_month: "month",
  this_year: "year",
  custom: "custom",
};

const RANGE_KEY_MAP: Record<string, string> = {
  today: "rangeToday",
  this_week: "rangeWeek",
  this_month: "rangeMonth",
  this_year: "rangeYear",
};

function buildSummaryText(
  report: ReportQueryResult,
  intent: QueryReportIntent,
  language: "es" | "en"
): string {
  const fmt = (value: number) =>
    new Intl.NumberFormat(language === "es" ? "es-EC" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  if (report.count === 0) return t(language, "voice.reportEmpty");

  const rangeKey = RANGE_KEY_MAP[intent.period] || "rangeMonth";
  const range = t(language, `voice.${rangeKey}`);

  switch (intent.metric) {
    case "total":
      return t(language, "voice.summaryTotal")
        .replace("{range}", range)
        .replace("{amount}", fmt(report.totalAmount));
    case "average":
      return t(language, "voice.summaryAverage").replace("{amount}", fmt(report.average));
    case "count":
      return t(language, "voice.summaryCount")
        .replace("{count}", String(report.count))
        .replace("{range}", range);
    case "breakdown": {
      const parts = report.byCategory
        .slice(0, 5)
        .map((c) => `${c.name}: ${fmt(c.value)}`);
      return `${t(language, "voice.summaryBreakdown")} ${parts.join(", ")}.`;
    }
    default:
      return t(language, "voice.summaryTotal")
        .replace("{range}", range)
        .replace("{amount}", fmt(report.totalAmount));
  }
}

async function handleAddExpense(
  intent: AddExpenseIntent,
  language: "es" | "en"
): Promise<VoiceActionResult> {
  const [categories, types] = await Promise.all([
    db.categories.toArray(),
    db.types.toArray(),
  ]);

  const categoryName = intent.category;
  const category = categoryName
    ? categories.find((c) => normalizeText(c.name) === normalizeText(categoryName))
    : undefined;

  const typeName = intent.type;
  const type = typeName
    ? types.find((x) => normalizeText(x.name) === normalizeText(typeName))
    : undefined;

  const details = (intent.details || []).map((d) => ({
    id: crypto.randomUUID(),
    productName: d.productName,
    quantity: d.quantity,
    unitPrice: d.unitPrice,
    subtotal: Math.round(d.quantity * d.unitPrice * 100) / 100,
  }));

  const hasDetails = details.length > 0;
  const detailsTotal = details.reduce((s, d) => s + d.subtotal, 0);

  const today = new Date().toISOString().split("T")[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  const expenseData: ExpenseFormData = {
    name:
      intent.description ||
      (intent.category ? `Gasto en ${intent.category}` : "Gasto por voz"),
    description: intent.description || "",
    amount: hasDetails ? detailsTotal : intent.amount,
    categoryId: category?.id || "",
    typeId: type?.id || types[0]?.id || "",
    paymentMethod: "efectivo",
    status: "activo",
    date: intent.date || today,
    time: nowTime,
    notes: "",
    hasDetails,
    details,
  };

  return { type: "show_confirmation", expenseData, intent };
}

async function handleQueryReport(
  intent: QueryReportIntent,
  language: "es" | "en"
): Promise<VoiceActionResult> {
  const period = VOICE_PERIOD_MAP[intent.period] || "month";
  const report = await queryExpensesReport({
    period,
    dateFrom: intent.dateFrom,
    dateTo: intent.dateTo,
    categoryName: intent.category,
    language,
  });
  const summaryText = buildSummaryText(report, intent, language);
  return { type: "show_report", report, summaryText, intent };
}

async function handleDeleteExpense(
  intent: DeleteExpenseIntent,
  language: "es" | "en"
): Promise<VoiceActionResult> {
  const all = await db.expenses.toArray();
  const active = all.filter((e) => e.deleted !== true);
  const needle = normalizeText(intent.reference);

  const candidates = active.filter((e) => {
    const haystack = normalizeText(`${e.code} ${e.name} ${e.description}`);
    return haystack.includes(needle);
  });

  return { type: "confirm_delete", candidates: candidates.slice(0, 5), intent };
}

function resolveTarget(target: string): string {
  const trimmed = normalizeText(target);
  if (trimmed.startsWith("/")) return target.trim();

  const map: Record<string, string> = {
    home: "/",
    inicio: "/",
    dashboard: "/",
    expenses: "/expenses",
    gastos: "/expenses",
    reports: "/reports",
    reportes: "/reports",
    settings: "/settings",
    ajustes: "/settings",
    configuracion: "/settings",
    configuration: "/settings",
    categories: "/categories",
    categorias: "/categories",
    types: "/types",
    tipos: "/types",
    trash: "/trash",
    papelera: "/trash",
    basura: "/trash",
    "nuevo gasto": "/expenses/new",
    "new expense": "/expenses/new",
    new: "/expenses/new",
    nuevo: "/expenses/new",
  };

  return map[trimmed] || "/";
}

export async function dispatchVoiceIntent(
  intent: VoiceIntent,
  ctx: { language: "es" | "en"; router?: { push: (path: string) => void } }
): Promise<VoiceActionResult> {
  switch (intent.intent) {
    case "add_expense":
      return handleAddExpense(intent, ctx.language);
    case "query_report":
      return handleQueryReport(intent, ctx.language);
    case "delete_expense":
      return handleDeleteExpense(intent, ctx.language);
    case "navigate": {
      const target = resolveTarget(intent.target);
      ctx.router?.push(target);
      return { type: "navigate", target };
    }
    case "unclear":
      return { type: "unclear", reason: intent.reason };
  }
}
