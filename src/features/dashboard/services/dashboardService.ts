import { db } from "@/lib/db";
import { format, startOfWeek, subDays } from "date-fns";
import { computeStockById } from "@/features/sales/domain/stockRules";
import { listCategories } from "@/features/categories/services/categoryService";
import type { Product, Category, Sale, SaleDetail } from "@/types";

// Dashboard 100% offline: todas las agregaciones se resuelven desde IndexedDB
// con consultas indexadas (rangos por fecha, anyOf por clave). Ninguna llamada
// al servidor; el estado de sync se deriva de registros locales pendientes.

export const LOW_STOCK_THRESHOLD = 5;
export const SALES_BY_DAY_WINDOW = 7;

export interface SalesByDayPoint {
  date: string;
  label: string;
  total: number;
  count: number;
}

export interface SalesByCategoryPoint {
  name: string;
  value: number;
  color: string;
}

export interface TopProduct {
  code: string;
  name: string;
  color: string;
  units: number;
  revenue: number;
}

export interface LowStockItem {
  product: Product;
  stock: number;
}

export interface DashboardData {
  salesToday: number;
  salesCountToday: number;
  salesWeek: number;
  salesCountWeek: number;
  unitsSold: number;
  purchasesTotal: number;
  purchasesCount: number;
  expensesTotal: number;
  expensesCount: number;
  investmentsTotal: number;
  investmentsCount: number;
  lowStockCount: number;
  lowStockItems: LowStockItem[];
  salesByDay: SalesByDayPoint[];
  salesByCategory: SalesByCategoryPoint[];
  topProducts: TopProduct[];
  pendingChanges: number;
}

const SALE_STATUS_INDEXED = "confirmada";

async function queryConfirmedSales(dateFrom: string, dateTo: string, workspaceId?: string): Promise<Sale[]> {
  let sales = await db.sales
    .where("date")
    .between(dateFrom, dateTo, true, true)
    .toArray();
  if (workspaceId) {
    sales = sales.filter((s) => s.workspaceId === workspaceId);
  }
  return sales.filter((s) => !s.deleted && s.status === SALE_STATUS_INDEXED);
}

// Los pendientes se cuentan solo del workspace activo: mezclar el contador
// mostraría datos de otros espacios de trabajo.
async function countPending(tableName: string, workspaceId?: string): Promise<number> {
  try {
    const table = db[tableName as keyof typeof db];
    if (typeof table === "object" && table && typeof (table as { where?: unknown }).where === "function") {
      const collection = (table as unknown as {
        where(key: string): {
          equals(v: string): {
            filter(fn: (row: { workspaceId?: string }) => boolean): { count(): Promise<number> };
          };
        };
      }).where("syncStatus").equals("pending");
      if (!workspaceId) return 0;
      return await collection.filter((row) => row.workspaceId === workspaceId).count();
    }
  } catch {
    // Tabla o índice no disponible: se ignora.
  }
  return 0;
}

export async function loadDashboard(workspaceId?: string): Promise<DashboardData> {
  const now = new Date();
  const todayKey = format(now, "yyyy-MM-dd");
  const weekStartKey = format(startOfWeek(now, { weekStartsOn: 0 }), "yyyy-MM-dd");
  const windowStartKey = format(subDays(now, SALES_BY_DAY_WINDOW - 1), "yyyy-MM-dd");

  const filterByWorkspace = <T extends { workspaceId?: string }>(arr: T[]): T[] =>
    workspaceId ? arr.filter((item) => item.workspaceId === workspaceId) : arr;

  const [
    confirmedToday,
    confirmedWeek,
    weekSales,
    purchases,
    expenses,
    investments,
    products,
    categories,
    movements,
    pendingChanges,
  ] = await Promise.all([
    queryConfirmedSales(todayKey, todayKey, workspaceId),
    queryConfirmedSales(weekStartKey, todayKey, workspaceId),
    queryConfirmedSales(windowStartKey, todayKey, workspaceId),
    filterByWorkspace(await db.purchases.toArray()),
    filterByWorkspace(await db.expenses.toArray()),
    filterByWorkspace(await db.investments.toArray()),
    filterByWorkspace(await db.products.toArray()),
    listCategories(workspaceId),
    filterByWorkspace(await db.inventoryMovements.toArray()),
    Promise.all([
      countPending("expenses", workspaceId),
      countPending("categories", workspaceId),
      countPending("types", workspaceId),
      countPending("investments", workspaceId),
      countPending("investmentCategories", workspaceId),
      countPending("customers", workspaceId),
      countPending("products", workspaceId),
      countPending("inventoryMovements", workspaceId),
      countPending("sales", workspaceId),
      countPending("saleDetails", workspaceId),
      countPending("purchases", workspaceId),
      countPending("purchaseDetails", workspaceId),
    ]).then((counts) => counts.reduce((s, c) => s + c, 0)),
  ]);

  const validSales = (sales: Sale[]) => sales.filter((s) => s.status === SALE_STATUS_INDEXED);
  const confirmedIds = new Set(weekSales.filter((s) => s.status === SALE_STATUS_INDEXED).map((s) => s.id));

  const salesToday = validSales(confirmedToday).reduce((s, x) => s + x.total, 0);
  const salesWeek = validSales(confirmedWeek).reduce((s, x) => s + x.total, 0);

  const activeProducts = products.filter((p) => !p.deleted);
  const stockById = computeStockById(movements);

  const lowStockItems: LowStockItem[] = activeProducts
    .map((p) => ({ product: p, stock: stockById[p.id] ?? 0 }))
    .filter((x) => x.stock <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock - b.stock);

  // Detalle de ventas confirmadas del rango (índice por saleId).
  let confirmedDetails: SaleDetail[] = [];
  if (confirmedIds.size > 0) {
    confirmedDetails = (await db.saleDetails.where("saleId").anyOf([...confirmedIds]).toArray()).filter((d) => !d.deleted);
  }

  const unitsSold = confirmedDetails.reduce((s, d) => s + d.quantity, 0);

  const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const productById = new Map<string, Product>(activeProducts.map((p) => [p.id, p]));

  const byCategory = new Map<string, { value: number; color: string }>();
  const byProduct = new Map<string, TopProduct>();

  for (const d of confirmedDetails) {
    const catId = productById.get(d.productId)?.categoryId ?? "";
    const cat = catId ? categoryMap.get(catId) : undefined;
    const key = cat?.name ?? "Sin categoría";
    const current = byCategory.get(key) ?? { value: 0, color: cat?.color ?? "#78716c" };
    current.value += d.subtotal;
    byCategory.set(key, current);

    const pKey = `${d.code}|${d.name}`;
    const tp = byProduct.get(pKey) ?? { code: d.code, name: d.name, color: d.color, units: 0, revenue: 0 };
    tp.units += d.quantity;
    tp.revenue += d.subtotal;
    byProduct.set(pKey, tp);
  }

  const salesByDay: SalesByDayPoint[] = [];
  for (let i = SALES_BY_DAY_WINDOW - 1; i >= 0; i--) {
    const day = format(subDays(now, i), "yyyy-MM-dd");
    const daySales = validSales(weekSales).filter((s) => s.date === day);
    salesByDay.push({
      date: day,
      label: format(subDays(now, i), "EEE d"),
      total: daySales.reduce((s, x) => s + x.total, 0),
      count: daySales.length,
    });
  }

  const validExpenses = expenses.filter((e) => !e.deleted && e.status !== "anulado");
  const validInvestments = investments.filter((i) => !i.deleted && i.status !== "anulado");
  const validPurchases = purchases.filter((p) => !p.deleted && p.status !== "anulada");

  return {
    salesToday,
    salesCountToday: validSales(confirmedToday).length,
    salesWeek,
    salesCountWeek: validSales(confirmedWeek).length,
    unitsSold,
    purchasesTotal: validPurchases.reduce((s, p) => s + p.total, 0),
    purchasesCount: validPurchases.length,
    expensesTotal: validExpenses.reduce((s, e) => s + e.amount, 0),
    expensesCount: validExpenses.length,
    investmentsTotal: validInvestments.reduce((s, i) => s + i.value, 0),
    investmentsCount: validInvestments.length,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    salesByDay,
    salesByCategory: [...byCategory.entries()]
      .map(([name, v]) => ({ name, value: v.value, color: v.color }))
      .sort((a, b) => b.value - a.value),
    topProducts: [...byProduct.values()].sort((a, b) => b.units - a.units).slice(0, 5),
    pendingChanges,
  };
}
