import type { Purchase, PurchaseDetail, PurchaseStatus } from "@/types";
import { PAYMENT_METHODS } from "../../expenses/domain/expenseRules.ts";

export const PURCHASE_STATUSES = ["pendiente", "recibida", "anulada"] as const satisfies readonly PurchaseStatus[];

export interface PurchaseDetailInput {
  productId: string;
  code: string;
  name: string;
  color: string;
  quantity: number;
  unitPrice: number;
}

export interface NewPurchaseInput {
  supplier: string;
  date: string;
  paymentMethod: (typeof PAYMENT_METHODS)[number];
  notes: string;
  status?: PurchaseStatus;
  details: PurchaseDetailInput[];
}

export function computeSubtotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function computePurchaseTotal(details: Pick<PurchaseDetailInput, "quantity" | "unitPrice">[]): number {
  return details.reduce((sum, d) => sum + computeSubtotal(d.quantity, d.unitPrice), 0);
}

// Solo las compras pendientes pueden editarse; las recibidas ya tocaron inventario.
export function canEditPurchase(status: PurchaseStatus): boolean {
  return status === "pendiente";
}

export function canVoidPurchase(status: PurchaseStatus): boolean {
  return status !== "anulada";
}

export function isReceived(purchase: Pick<Purchase, "status">): boolean {
  return purchase.status === "recibida";
}

export function buildPurchaseDetail(input: PurchaseDetailInput, purchaseId: string, now: string): PurchaseDetail {
  return {
    id: crypto.randomUUID(),
    purchaseId,
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

export function buildPurchase(input: NewPurchaseInput, code: string, now: string): Purchase {
  return {
    id: crypto.randomUUID(),
    code,
    supplier: input.supplier.trim(),
    date: input.date,
    paymentMethod: input.paymentMethod,
    total: computePurchaseTotal(input.details),
    notes: input.notes.trim(),
    status: input.status ?? "pendiente",
    receivedAt: input.status === "recibida" ? now : null,
    voidedAt: null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: "pending",
  };
}
