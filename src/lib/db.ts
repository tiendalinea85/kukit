import Dexie, { type Table } from "dexie";
import type {
  Expense,
  Category,
  Type,
  Investment,
  InvestmentCategory,
  Customer,
  Product,
  InventoryMovement,
  Sale,
  SaleDetail,
  Purchase,
  PurchaseDetail,
} from "../types/index.ts";
import type {
  OutboxOperation,
  SyncLogEntry,
  SyncStateRecord,
} from "../types/sync.ts";

class ZaneDB extends Dexie {
  expenses!: Table<Expense, string>;
  categories!: Table<Category, string>;
  types!: Table<Type, string>;
  investments!: Table<Investment, string>;
  investmentCategories!: Table<InvestmentCategory, string>;
  customers!: Table<Customer, string>;
  products!: Table<Product, string>;
  inventoryMovements!: Table<InventoryMovement, string>;
  sales!: Table<Sale, string>;
  saleDetails!: Table<SaleDetail, string>;
  purchases!: Table<Purchase, string>;
  purchaseDetails!: Table<PurchaseDetail, string>;
  syncOutbox!: Table<OutboxOperation, string>;
  syncLog!: Table<SyncLogEntry, string>;
  syncState!: Table<SyncStateRecord, string>;

  constructor() {
    super("zane-db");

    this.version(4).stores({
      expenses:
        "id, code, description, categoryId, date, createdAt, updatedAt, status, amount, deleted, syncStatus",
      categories:
        "id, name, syncStatus",
      types:
        "id, name, syncStatus",
    }).upgrade(async (tx) => {
      // El gasto no tiene partidas: se descarta el detalle tipo compra.
      await tx.table("expenseDetails").clear();

      // Migración del modelo anterior (compra) al modelo GASTOS.
      await tx
        .table("expenses")
        .toCollection()
        .modify((expense: Record<string, unknown>) => {
          if (!expense.description && typeof expense.name === "string") {
            expense.description = expense.name;
          }
          delete expense.name;
          delete expense.typeId;
          delete expense.hasDetails;
          delete expense.totalAmount;
          delete expense.itemsCount;
          if (expense.status === "activo") expense.status = "pagado";
          if (expense.status === "cancelado") {
            expense.status = "anulado";
            expense.voidedAt = expense.updatedAt ?? null;
          }
          if (expense.voidedAt === undefined) expense.voidedAt = null;
        });
    });

    // INVERSIONES: módulo separado de compras/gastos/ventas.
    this.version(5).stores({
      expenses:
        "id, code, description, categoryId, date, createdAt, updatedAt, status, amount, deleted, syncStatus",
      categories:
        "id, name, syncStatus",
      types:
        "id, name, syncStatus",
      investments:
        "id, name, categoryId, date, status, value, createdAt, updatedAt, deleted, syncStatus",
      investmentCategories:
        "id, name, syncStatus",
    });

    // VENTAS: clientes, productos y movimientos de inventario.
    // El stock NO se almacena en el producto: se deriva de inventoryMovements
    // (entradas - salidas). Una venta confirmada crea movimientos SALIDA.
    this.version(6).stores({
      expenses:
        "id, code, description, categoryId, date, createdAt, updatedAt, status, amount, deleted, syncStatus",
      categories:
        "id, name, syncStatus",
      types:
        "id, name, syncStatus",
      investments:
        "id, name, categoryId, date, status, value, createdAt, updatedAt, deleted, syncStatus",
      investmentCategories:
        "id, name, syncStatus",
      customers:
        "id, name, phone, createdAt, updatedAt, deleted, syncStatus",
      products:
        "id, code, name, createdAt, updatedAt, deleted, syncStatus",
      inventoryMovements:
        "id, productId, type, referenceType, referenceId, createdAt, syncStatus",
      sales:
        "id, code, customerId, date, paymentMethod, status, total, createdAt, updatedAt, deleted, syncStatus",
      saleDetails:
        "id, saleId, productId, createdAt, syncStatus",
    });

    // COMPRAS: proveedores y entrada de mercadería. Una compra recibida genera
    // movimientos ENTRADA de inventario (referenceType "compra"). Se agrega
    // categoryId al producto para los reportes por categoría (ventas e inventario).
    // inventoryMovements admite type "ajuste" (cantidad firmada).
    this.version(7).stores({
      expenses:
        "id, code, description, categoryId, date, createdAt, updatedAt, status, amount, deleted, syncStatus",
      categories:
        "id, name, syncStatus",
      types:
        "id, name, syncStatus",
      investments:
        "id, name, categoryId, date, status, value, createdAt, updatedAt, deleted, syncStatus",
      investmentCategories:
        "id, name, syncStatus",
      customers:
        "id, name, phone, createdAt, updatedAt, deleted, syncStatus",
      products:
        "id, code, name, categoryId, createdAt, updatedAt, deleted, syncStatus",
      inventoryMovements:
        "id, productId, type, referenceType, referenceId, createdAt, syncStatus",
      sales:
        "id, code, customerId, date, paymentMethod, status, total, createdAt, updatedAt, deleted, syncStatus",
      saleDetails:
        "id, saleId, productId, createdAt, syncStatus",
      purchases:
        "id, code, supplier, date, paymentMethod, status, total, createdAt, updatedAt, deleted, syncStatus",
      purchaseDetails:
        "id, purchaseId, productId, createdAt, syncStatus",
    }).upgrade(async (tx) => {
      // Productos existentes sin categoría: se asigna vacío (sin categoría).
      await tx
        .table("products")
        .toCollection()
        .modify((product: Record<string, unknown>) => {
          if (typeof product.categoryId !== "string") {
            product.categoryId = "";
          }
        });
    });

    // SINCRONIZACIÓN: outbox (cola local de operaciones), log de errores y
    // metadatos (watermarks de pull incremental, última sincronización).
    this.version(8).stores({
      syncOutbox:
        "id, [entity+entityId], entity, entityId, state, retryAt, createdAt, updatedAt, attempts",
      syncLog:
        "id, ts, level, event, entity, errorType",
      syncState:
        "key, updatedAt",
    });
  }
}

export const db = new ZaneDB();

export async function clearLocalData(): Promise<void> {
  await Promise.all([
    db.expenses.clear(),
    db.categories.clear(),
    db.types.clear(),
    db.investments.clear(),
    db.investmentCategories.clear(),
    db.customers.clear(),
    db.products.clear(),
    db.inventoryMovements.clear(),
    db.sales.clear(),
    db.saleDetails.clear(),
    db.purchases.clear(),
    db.purchaseDetails.clear(),
    db.syncOutbox.clear(),
    db.syncLog.clear(),
    db.syncState.clear(),
  ]);
}
