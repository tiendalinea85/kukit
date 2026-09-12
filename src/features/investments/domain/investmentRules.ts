import type { Investment, InvestmentStatus, PaymentMethod } from "@/types";

export const INVESTMENT_STATUSES = ["pagado", "pendiente", "anulado"] as const satisfies readonly InvestmentStatus[];

// Taxonomía por defecto de inversiones (activo fijo del negocio).
export const INVESTMENT_CATEGORY_DEFAULTS = [
  { name: "Maquinaria", color: "#6366f1", icon: "⚙️" },
  { name: "Equipamiento", color: "#06b6d4", icon: "🖨️" },
  { name: "Herramientas", color: "#f97316", icon: "🔧" },
  { name: "Computación", color: "#3b82f6", icon: "💻" },
  { name: "Muebles", color: "#a16207", icon: "🪑" },
  { name: "Inmuebles", color: "#22c55e", icon: "🏠" },
  { name: "Otros", color: "#78716c", icon: "📦" },
] as const;

export interface NewInvestmentInput {
  name: string;
  value: number;
  categoryId: string;
  supplier?: string;
  paymentMethod: PaymentMethod;
  status: InvestmentStatus;
  date: string;
  notes?: string;
  workspaceId?: string;
}

export function canEditInvestment(status: InvestmentStatus): boolean {
  return status !== "anulado";
}

export function canVoidInvestment(status: InvestmentStatus): boolean {
  return status !== "anulado";
}

export function isVoided(investment: Pick<Investment, "status">): boolean {
  return investment.status === "anulado";
}

// Nota de arquitectura: para la futura gestión de activos/depreciación se
// incorporarán (sin implementar hoy) campos como vida útil, método de
// depreciación y valor residual, manteniendo `value` como base depreciable.
export function buildInvestment(input: {
  data: NewInvestmentInput;
  now: string;
}): Investment {
  const { data, now } = input;
  return {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    value: data.value,
    categoryId: data.categoryId,
    supplier: data.supplier || "",
    paymentMethod: data.paymentMethod,
    status: data.status,
    date: data.date,
    notes: data.notes || "",
    workspaceId: data.workspaceId ?? "default",
    voidedAt: null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: "pending",
  };
}

export interface FilterableInvestment {
  id: string;
  name: string;
  categoryId: string;
  supplier: string;
  paymentMethod: string;
  value: number;
  date: string;
  deleted?: boolean;
  status?: string;
}

export interface InvestmentFilters {
  search?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function filterInvestments<T extends FilterableInvestment>(
  investments: T[],
  filters: InvestmentFilters = {},
  categoryNames: Record<string, string> = {}
): T[] {
  const search = (filters.search || "").trim().toLowerCase();

  return investments.filter((investment) => {
    if (investment.deleted === true) return false;

    if (filters.categoryId && investment.categoryId !== filters.categoryId) return false;
    if (filters.dateFrom && investment.date < filters.dateFrom) return false;
    if (filters.dateTo && investment.date > filters.dateTo) return false;

    if (search) {
      const haystack = [
        investment.name,
        investment.supplier,
        categoryNames[investment.categoryId] || "",
        investment.paymentMethod,
        String(investment.value),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}
