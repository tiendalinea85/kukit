import type { Sale, SaleDetail, SaleStatus } from "@/types";
import { PAYMENT_METHODS } from "../../expenses/domain/expenseRules.ts";

export const SALE_STATUSES = ["pendiente", "confirmada", "anulada"] as const satisfies readonly SaleStatus[];

export interface SaleDetailInput {
  productId: string;
  code: string;
  name: string;
  color: string;
  quantity: number;
  unitPrice: number;
}

export interface NewSaleInput {
  customerId: string;
  date: string;
  paymentMethod: (typeof PAYMENT_METHODS)[number];
  notes: string;
  status?: SaleStatus;
  details: SaleDetailInput[];
  workspaceId?: string;
}

export function computeSubtotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function computeSaleTotal(details: Pick<SaleDetailInput, "quantity" | "unitPrice">[]): number {
  return details.reduce((sum, d) => sum + computeSubtotal(d.quantity, d.unitPrice), 0);
}

export function canEditSale(status: SaleStatus): boolean {
  return status === "pendiente";
}

export function canVoidSale(status: SaleStatus): boolean {
  return status !== "anulada";
}

export function isConfirmed(sale: Pick<Sale, "status">): boolean {
  return sale.status === "confirmada";
}

export function isVoided(sale: Pick<Sale, "status">): boolean {
  return sale.status === "anulada";
}

export function buildSaleDetail(input: SaleDetailInput, saleId: string, now: string, workspaceId: string = "default"): SaleDetail {
  return {
    id: crypto.randomUUID(),
    workspaceId,
    saleId,
    productId: input.productId,
    code: input.code.trim(),
    name: input.name.trim(),
    color: input.color.trim(),
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    subtotal: computeSubtotal(input.quantity, input.unitPrice),
    createdAt: now,
    syncStatus: "pending",
  };
}

export function buildSale(input: NewSaleInput, code: string, now: string): Sale {
  return {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId ?? "default",
    code,
    customerId: input.customerId,
    date: input.date,
    paymentMethod: input.paymentMethod,
    total: computeSaleTotal(input.details),
    notes: input.notes.trim(),
    status: input.status ?? "pendiente",
    confirmedAt: input.status === "confirmada" ? now : null,
    voidedAt: null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: "pending",
  };
}

export interface FilterableSale {
  id: string;
  code: string;
  date: string;
  paymentMethod: string;
  total: number;
  status: SaleStatus;
  customerId: string;
  customerName: string;
  detailLabels: string[];
  deleted: boolean;
}

export interface SaleFilters {
  search?: string;
  status?: SaleStatus | "all";
  paymentMethod?: string | "all";
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
}

export function filterSales<T extends FilterableSale>(sales: T[], filters: SaleFilters): T[] {
  const q = filters.search?.trim().toLowerCase() ?? "";
  return sales.filter((s) => {
    if (s.deleted) return false;
    if (filters.status && filters.status !== "all" && s.status !== filters.status) return false;
    if (filters.paymentMethod && filters.paymentMethod !== "all" && s.paymentMethod !== filters.paymentMethod) return false;
    if (filters.customerId && s.customerId !== filters.customerId) return false;
    if (filters.dateFrom && s.date < filters.dateFrom) return false;
    if (filters.dateTo && s.date > filters.dateTo) return false;
    if (q) {
      const haystack = [
        s.code,
        s.customerName,
        s.paymentMethod,
        s.status,
        String(s.total),
        ...s.detailLabels,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
