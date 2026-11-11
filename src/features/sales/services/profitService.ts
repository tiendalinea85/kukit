import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { buildProfitSummary, computeSaleProfit, computeWeightedCosts } from "../domain/saleProfit";
import type { Expense, Sale, SaleDetail } from "@/types";
import type { ProfitSummary, SaleProfitResult } from "../domain/saleProfit";

export interface SaleProfitData extends SaleProfitResult {
  sale: Sale;
}

export interface ProfitRange {
  dateFrom: string;
  dateTo: string;
  workspaceId?: string;
}

function activeWorkspaceId(): string | undefined {
  return useWorkspaceStore.getState().activeWorkspaceId ?? undefined;
}

// Solo las compras recibidas representan mercadería que realmente entró: una
// compra pendiente o anulada no debe fijar el costo de lo vendido.
async function loadProductCosts(workspaceId: string): Promise<Map<string, number>> {
  const [purchases, details] = await Promise.all([
    db.purchases.where("workspaceId").equals(workspaceId).toArray(),
    db.purchaseDetails.where("workspaceId").equals(workspaceId).toArray(),
  ]);

  const receivedIds = new Set(
    purchases
      .filter((purchase) => !purchase.deleted && purchase.status === "recibida")
      .map((purchase) => purchase.id),
  );

  return computeWeightedCosts(
    details
      .filter((detail) => !detail.deleted && receivedIds.has(detail.purchaseId))
      .map((detail) => ({
        productId: detail.productId,
        quantity: detail.quantity,
        unitPrice: detail.unitPrice,
      })),
  );
}

async function loadSaleDetails(saleIds: string[], workspaceId: string): Promise<SaleDetail[]> {
  if (saleIds.length === 0) return [];
  const rows = await db.saleDetails.where("saleId").anyOf(saleIds).toArray();
  return rows.filter((detail) => !detail.deleted && detail.workspaceId === workspaceId);
}

export async function getSaleProfit(
  saleId: string,
  workspaceId?: string,
): Promise<SaleProfitData | null> {
  const sale = await db.sales.get(saleId);
  if (!sale || sale.deleted) return null;

  const ws = workspaceId ?? activeWorkspaceId();
  if (ws && sale.workspaceId !== ws) return null;

  const [details, costs] = await Promise.all([
    loadSaleDetails([sale.id], sale.workspaceId),
    loadProductCosts(sale.workspaceId),
  ]);

  return { sale, ...computeSaleProfit(details, costs) };
}

export async function getProfitSummary(range: ProfitRange): Promise<ProfitSummary> {
  const workspaceId = range.workspaceId ?? activeWorkspaceId();
  if (!workspaceId) return buildProfitSummary(computeSaleProfit([], new Map()), 0, 0);

  const [sales, expenses] = await Promise.all([
    db.sales.where("workspaceId").equals(workspaceId).toArray(),
    db.expenses.where("workspaceId").equals(workspaceId).toArray(),
  ]);

  const confirmed = sales.filter(
    (sale) =>
      !sale.deleted &&
      sale.status === "confirmada" &&
      sale.date >= range.dateFrom &&
      sale.date <= range.dateTo,
  );

  const [details, costs] = await Promise.all([
    loadSaleDetails(confirmed.map((sale) => sale.id), workspaceId),
    loadProductCosts(workspaceId),
  ]);

  const operatingExpenses = expenses
    .filter(
      (expense: Expense) =>
        !expense.deleted &&
        expense.status !== "anulado" &&
        expense.date >= range.dateFrom &&
        expense.date <= range.dateTo,
    )
    .reduce((sum, expense) => sum + expense.amount, 0);

  return buildProfitSummary(
    computeSaleProfit(details, costs),
    operatingExpenses,
    confirmed.length,
  );
}
