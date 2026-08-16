import { getDb } from '../../core/db/database';

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
  const [sales, expenses, purchases, investments, products, low] = await Promise.all([
    db.getFirstAsync<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM sales
       WHERE deleted = 0 AND status = 'completada'`
    ),
    db.getFirstAsync<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM expenses
       WHERE deleted = 0 AND status != 'cancelado'`
    ),
    db.getFirstAsync<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM purchases
       WHERE deleted = 0 AND status = 'recibida'`
    ),
    db.getFirstAsync<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM investments
       WHERE deleted = 0`
    ),
    db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM products WHERE deleted = 0 AND active = 1`
    ),
    db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM products WHERE deleted = 0 AND active = 1 AND stock <= min_stock`
    ),
  ]);

  return {
    total_sales: sales?.total ?? 0,
    sales_count: sales?.count ?? 0,
    total_expenses: expenses?.total ?? 0,
    expenses_count: expenses?.count ?? 0,
    total_purchases: purchases?.total ?? 0,
    purchases_count: purchases?.count ?? 0,
    total_invested: investments?.total ?? 0,
    investments_count: investments?.count ?? 0,
    product_count: products?.count ?? 0,
    low_stock_count: low?.count ?? 0,
  };
}

export async function salesSeries(days: number = 30): Promise<SeriesPoint[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; value: number }>(
    `SELECT date, SUM(total_amount) as value
     FROM sales
     WHERE deleted = 0 AND status = 'completada' AND date >= date('now', '-${days - 1} days')
     GROUP BY date ORDER BY date`
  );
  return rows.map((r) => ({ label: r.date.slice(5), value: r.value }));
}

export async function expensesSeries(days: number = 30): Promise<SeriesPoint[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; value: number }>(
    `SELECT date, SUM(total_amount) as value
     FROM expenses
     WHERE deleted = 0 AND status != 'cancelado' AND date >= date('now', '-${days - 1} days')
     GROUP BY date ORDER BY date`
  );
  return rows.map((r) => ({ label: r.date.slice(5), value: r.value }));
}

export async function topProducts(limit: number = 5): Promise<TopProduct[]> {
  const db = await getDb();
  return db.getAllAsync<TopProduct>(
    `SELECT si.product_name as product, SUM(si.quantity) as quantity, SUM(si.subtotal) as revenue
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.deleted = 0 AND s.status = 'completada'
     GROUP BY si.product_name ORDER BY quantity DESC LIMIT ?`,
    limit
  );
}

export async function stockValue(): Promise<{ cost_value: number; sale_value: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cost_value: number; sale_value: number }>(
    `SELECT COALESCE(SUM(stock * cost_price), 0) as cost_value,
            COALESCE(SUM(stock * sale_price), 0) as sale_value
     FROM products WHERE deleted = 0`
  );
  return row ?? { cost_value: 0, sale_value: 0 };
}
