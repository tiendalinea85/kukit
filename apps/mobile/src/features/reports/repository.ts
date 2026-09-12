import { getDb } from '../../core/db/database';
import { requireActiveWorkspaceId } from '../../core/workspace/isolation';
import { getEnabledModuleCodes } from '../../core/workspace/moduleRegistry';
import type { ModuleCode } from '../../core/domain/types';

export interface DashboardSummary {
  total_sales: number;
  sales_count: number;
  total_expenses: number;
  expenses_count: number;
  total_purchases: number;
  purchases_count: number;
  total_invested: number;
  investments_count: number;
  product_count: number;
  low_stock_count: number;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface TopProduct {
  product: string;
  quantity: number;
  revenue: number;
}

export async function dashboardSummary(): Promise<DashboardSummary> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const enabled = await getEnabledModuleCodes();
  const zero = { total: 0, count: 0 };

  const q = async (sql: string): Promise<{ total: number; count: number }> => {
    const row = await db.getFirstAsync<{ total: number; count: number }>(sql, wsId);
    return row ?? zero;
  };

  const qCount = async (sql: string): Promise<{ count: number }> => {
    const row = await db.getFirstAsync<{ count: number }>(sql, wsId);
    return row ?? { count: 0 };
  };

  const [sales, expenses, purchases, investments, products, low] = await Promise.all([
    enabled.has('sales')
      ? q(`SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM sales
           WHERE deleted = 0 AND status = 'completada' AND workspace_id = ?`)
      : Promise.resolve(zero),
    enabled.has('expenses')
      ? q(`SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM expenses
           WHERE deleted = 0 AND status != 'cancelado' AND workspace_id = ?`)
      : Promise.resolve(zero),
    enabled.has('purchases')
      ? q(`SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM purchases
           WHERE deleted = 0 AND status = 'recibida' AND workspace_id = ?`)
      : Promise.resolve(zero),
    enabled.has('investments')
      ? q(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM investments
           WHERE deleted = 0 AND workspace_id = ?`)
      : Promise.resolve(zero),
    enabled.has('products')
      ? qCount(`SELECT COUNT(*) as count FROM products WHERE deleted = 0 AND active = 1 AND workspace_id = ?`)
      : Promise.resolve({ count: 0 }),
    enabled.has('products')
      ? qCount(`SELECT COUNT(*) as count FROM products WHERE deleted = 0 AND active = 1 AND stock <= min_stock AND workspace_id = ?`)
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    total_sales: sales.total,
    sales_count: sales.count,
    total_expenses: expenses.total,
    expenses_count: expenses.count,
    total_purchases: purchases.total,
    purchases_count: purchases.count,
    total_invested: investments.total,
    investments_count: investments.count,
    product_count: products.count,
    low_stock_count: low.count,
  };
}

export async function salesSeries(days: number = 30): Promise<SeriesPoint[]> {
  const enabled = await getEnabledModuleCodes();
  if (!enabled.has('sales')) return [];
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const rows = await db.getAllAsync<{ date: string; value: number }>(
    `SELECT date, SUM(total_amount) as value
     FROM sales
     WHERE deleted = 0 AND status = 'completada' AND date >= date('now', '-${days - 1} days') AND workspace_id = ?
     GROUP BY date ORDER BY date`,
    wsId
  );
  return rows.map((r) => ({ label: r.date.slice(5), value: r.value }));
}

export async function expensesSeries(days: number = 30): Promise<SeriesPoint[]> {
  const enabled = await getEnabledModuleCodes();
  if (!enabled.has('expenses')) return [];
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const rows = await db.getAllAsync<{ date: string; value: number }>(
    `SELECT date, SUM(total_amount) as value
     FROM expenses
     WHERE deleted = 0 AND status != 'cancelado' AND date >= date('now', '-${days - 1} days') AND workspace_id = ?
     GROUP BY date ORDER BY date`,
    wsId
  );
  return rows.map((r) => ({ label: r.date.slice(5), value: r.value }));
}

export async function topProducts(limit: number = 5): Promise<TopProduct[]> {
  const enabled = await getEnabledModuleCodes();
  if (!enabled.has('products') || !enabled.has('sales')) return [];
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  return db.getAllAsync<TopProduct>(
    `SELECT si.product_name as product, SUM(si.quantity) as quantity, SUM(si.subtotal) as revenue
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.deleted = 0 AND s.status = 'completada' AND s.workspace_id = ?
     GROUP BY si.product_name ORDER BY quantity DESC LIMIT ?`,
    wsId, limit
  );
}

export async function stockValue(): Promise<{ cost_value: number; sale_value: number }> {
  const enabled = await getEnabledModuleCodes();
  if (!enabled.has('products')) return { cost_value: 0, sale_value: 0 };
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const row = await db.getFirstAsync<{ cost_value: number; sale_value: number }>(
    `SELECT COALESCE(SUM(stock * cost_price), 0) as cost_value,
            COALESCE(SUM(stock * sale_price), 0) as sale_value
     FROM products WHERE deleted = 0 AND workspace_id = ?`,
    wsId
  );
  return row ?? { cost_value: 0, sale_value: 0 };
}
