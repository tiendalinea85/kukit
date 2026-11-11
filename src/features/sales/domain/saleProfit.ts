import type { SaleDetail } from "@/types";

// Costo de venta: promedio ponderado de las compras recibidas de cada
// producto. No se guarda en el producto para no duplicar la fuente de verdad
// (el historial de compras) ni exigir migraciones de esquema.
export interface PurchaseCostRow {
  productId: string;
  quantity: number;
  unitPrice: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeWeightedCosts(rows: PurchaseCostRow[]): Map<string, number> {
  const accumulated = new Map<string, { amount: number; quantity: number }>();

  for (const row of rows) {
    if (!row.productId || row.quantity <= 0 || row.unitPrice < 0) continue;
    const current = accumulated.get(row.productId) ?? { amount: 0, quantity: 0 };
    current.amount += row.unitPrice * row.quantity;
    current.quantity += row.quantity;
    accumulated.set(row.productId, current);
  }

  const costs = new Map<string, number>();
  for (const [productId, { amount, quantity }] of accumulated) {
    if (quantity > 0) costs.set(productId, round2(amount / quantity));
  }
  return costs;
}

export interface SaleProfitLine extends SaleDetail {
  unitCost: number;
  cost: number;
  profit: number;
  missingCost: boolean;
}

export interface SaleProfitResult {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  missingCostCount: number;
  lines: SaleProfitLine[];
}

export function computeSaleProfit(
  details: SaleDetail[],
  costs: ReadonlyMap<string, number>,
): SaleProfitResult {
  const lines: SaleProfitLine[] = details.map((detail) => {
    const known = costs.get(detail.productId);
    const missingCost = known === undefined;
    const unitCost = known ?? 0;
    const cost = round2(unitCost * detail.quantity);
    return {
      ...detail,
      unitCost,
      cost,
      profit: round2(detail.subtotal - cost),
      missingCost,
    };
  });

  const revenue = round2(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const cost = round2(lines.reduce((sum, line) => sum + line.cost, 0));
  const profit = round2(revenue - cost);

  return {
    revenue,
    cost,
    profit,
    margin: revenue > 0 ? profit / revenue : 0,
    missingCostCount: lines.filter((line) => line.missingCost).length,
    lines,
  };
}

export interface ProfitSummary {
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  operatingExpenses: number;
  profit: number;
  margin: number;
  salesCount: number;
  missingCostCount: number;
}

export function buildProfitSummary(
  saleProfit: SaleProfitResult,
  operatingExpenses: number,
  salesCount: number,
): ProfitSummary {
  const expenses = round2(operatingExpenses);
  const profit = round2(saleProfit.profit - expenses);
  return {
    revenue: saleProfit.revenue,
    costOfGoods: saleProfit.cost,
    grossProfit: saleProfit.profit,
    operatingExpenses: expenses,
    profit,
    margin: saleProfit.revenue > 0 ? profit / saleProfit.revenue : 0,
    salesCount,
    missingCostCount: saleProfit.missingCostCount,
  };
}
