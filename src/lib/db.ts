import Dexie, { type Table } from "dexie";
import type {
  Expense,
  ExpenseDetail,
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
  Garment,
  Size,
  Color,
  Material,
  ProductionOrder,
  ProductionMaterial,
  Crop,
  FarmLot,
  AgroInput,
  Application,
  Labor,
  Harvest,
  VehicleBrand,
  VehicleModel,
  AutoPart,
  PartCompatibility,
  Species,
  Animal,
  BreedingLot,
  Feeding,
  Reproduction,
  LivestockProduction,
} from "../types/modules.ts";
import type {
  OutboxOperation,
  SyncLogEntry,
  SyncStateRecord,
} from "../types/sync.ts";
import type { InvoiceDraft } from "../features/invoice/domain/types.ts";

class ZaneDB extends Dexie {
  expenses!: Table<Expense, string>;
  expenseDetails!: Table<ExpenseDetail, string>;
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

  // Taller de confección
  garments!: Table<Garment, string>;
  sizes!: Table<Size, string>;
  garmentColors!: Table<Color, string>;
  materials!: Table<Material, string>;
  productionOrders!: Table<ProductionOrder, string>;
  productionMaterials!: Table<ProductionMaterial, string>;

  // Agricultura
  crops!: Table<Crop, string>;
  farmLots!: Table<FarmLot, string>;
  agroInputs!: Table<AgroInput, string>;
  applications!: Table<Application, string>;
  labors!: Table<Labor, string>;
  harvests!: Table<Harvest, string>;

  // Repuestos automotrices
  vehicleBrands!: Table<VehicleBrand, string>;
  vehicleModels!: Table<VehicleModel, string>;
  autoParts!: Table<AutoPart, string>;
  partCompatibilities!: Table<PartCompatibility, string>;

  // Crianza
  species!: Table<Species, string>;
  animals!: Table<Animal, string>;
  breedingLots!: Table<BreedingLot, string>;
  feedings!: Table<Feeding, string>;
  reproductions!: Table<Reproduction, string>;
  livestockProductions!: Table<LivestockProduction, string>;

  // Borradores de facturas (OCR)
  invoiceDrafts!: Table<InvoiceDraft, string>;

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
        "id, [entity+entityId], entity, entityId, workspaceId, state, retryAt, createdAt, updatedAt, attempts",
      syncLog:
        "id, ts, level, event, entity, errorType",
      syncState:
        "key, updatedAt",
    });

    // MÓDULOS ESPECIALIZADOS: talleres, agricultura, repuestos, crianza.
    // Cada tabla incluye workspaceId para aislamiento por workspace.
    this.version(9).stores({
      garments:
        "id, code, name, categoryId, workspaceId, deleted, syncStatus",
      sizes:
        "id, name, workspaceId, deleted, syncStatus",
      garmentColors:
        "id, name, workspaceId, deleted, syncStatus",
      materials:
        "id, code, name, workspaceId, deleted, syncStatus",
      productionOrders:
        "id, code, garmentId, sizeId, colorId, status, workspaceId, deleted, syncStatus",
      productionMaterials:
        "id, productionOrderId, materialId, workspaceId, syncStatus",
      crops:
        "id, code, name, status, workspaceId, deleted, syncStatus",
      farmLots:
        "id, code, name, workspaceId, deleted, syncStatus",
      agroInputs:
        "id, code, name, type, workspaceId, deleted, syncStatus",
      applications:
        "id, code, cropId, lotId, inputId, workspaceId, deleted, syncStatus",
      labors:
        "id, code, cropId, lotId, type, workspaceId, deleted, syncStatus",
      harvests:
        "id, code, cropId, lotId, workspaceId, deleted, syncStatus",
      vehicleBrands:
        "id, name, workspaceId, deleted, syncStatus",
      vehicleModels:
        "id, brandId, name, workspaceId, deleted, syncStatus",
      autoParts:
        "id, code, name, partNumber, category, workspaceId, deleted, syncStatus",
      partCompatibilities:
        "id, partId, modelId, workspaceId, deleted, syncStatus",
      species:
        "id, name, workspaceId, deleted, syncStatus",
      animals:
        "id, code, name, speciesId, lotId, gender, status, workspaceId, deleted, syncStatus",
      breedingLots:
        "id, code, name, speciesId, workspaceId, deleted, syncStatus",
      feedings:
        "id, code, lotId, feedType, workspaceId, deleted, syncStatus",
      reproductions:
        "id, code, animalId, event, workspaceId, deleted, syncStatus",
      livestockProductions:
        "id, code, lotId, type, workspaceId, deleted, syncStatus",
    });

    // FIX: agregar updatedAt a catálogos simples para que sync pull
    // detecte updates remotos (orderColumn = updated_at por defecto).
    this.version(10).stores({
      sizes:
        "id, name, updatedAt, workspaceId, deleted, syncStatus",
      garmentColors:
        "id, name, updatedAt, workspaceId, deleted, syncStatus",
      vehicleBrands:
        "id, name, updatedAt, workspaceId, deleted, syncStatus",
      species:
        "id, name, updatedAt, workspaceId, deleted, syncStatus",
    });

    // BORRADORES DE FACTURAS: capturas OCR locales (no se sincronizan).
    this.version(11).stores({
      invoiceDrafts:
        "id, status, createdAt, updatedAt",
    });

    // WORKSPACE ISOLATION: agregar workspaceId como indice en todas las
    // tablas core para filtrado por workspace activo. Los registros
    // existentes reciben workspaceId "default" en la migracion.
    this.version(12).stores({
      expenses:
        "id, workspaceId, code, description, categoryId, date, createdAt, updatedAt, status, amount, deleted, syncStatus",
      categories:
        "id, workspaceId, name, syncStatus",
      types:
        "id, workspaceId, name, syncStatus",
      investments:
        "id, workspaceId, name, categoryId, date, status, value, createdAt, updatedAt, deleted, syncStatus",
      investmentCategories:
        "id, workspaceId, name, syncStatus",
      customers:
        "id, workspaceId, name, phone, createdAt, updatedAt, deleted, syncStatus",
      products:
        "id, workspaceId, code, name, categoryId, createdAt, updatedAt, deleted, syncStatus",
      inventoryMovements:
        "id, workspaceId, productId, type, referenceType, referenceId, createdAt, syncStatus",
      sales:
        "id, workspaceId, code, customerId, date, paymentMethod, status, total, createdAt, updatedAt, deleted, syncStatus",
      saleDetails:
        "id, workspaceId, saleId, productId, createdAt, syncStatus",
      purchases:
        "id, workspaceId, code, supplier, date, paymentMethod, status, total, createdAt, updatedAt, deleted, syncStatus",
      purchaseDetails:
        "id, workspaceId, purchaseId, productId, createdAt, syncStatus",
    }).upgrade(async (tx) => {
      const tables = [
        "expenses", "categories", "types", "investments", "investmentCategories",
        "customers", "products", "inventoryMovements", "sales", "saleDetails",
        "purchases", "purchaseDetails",
      ];
      for (const tableName of tables) {
        await tx.table(tableName).toCollection().modify((row: Record<string, unknown>) => {
          if (typeof row.workspaceId !== "string") {
            row.workspaceId = "default";
          }
        });
      }
    });

    // GASTOS CON PARTIDAS: detalle por producto dentro de un gasto.
    // Cada línea guarda el snapshot del producto (code, name, color) para
    // conservar el historial si el producto se edita o elimina.
    this.version(13).stores({
      expenses:
        "id, workspaceId, code, description, categoryId, date, createdAt, updatedAt, status, amount, deleted, syncStatus",
      expenseDetails:
        "id, workspaceId, expenseId, productId, createdAt, syncStatus",
    });
  }
}

export const db = new ZaneDB();

export async function clearLocalData(): Promise<void> {
  await Promise.all([
    db.expenses.clear(),
    db.expenseDetails.clear(),
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
    db.garments.clear(),
    db.sizes.clear(),
    db.garmentColors.clear(),
    db.materials.clear(),
    db.productionOrders.clear(),
    db.productionMaterials.clear(),
    db.crops.clear(),
    db.farmLots.clear(),
    db.agroInputs.clear(),
    db.applications.clear(),
    db.labors.clear(),
    db.harvests.clear(),
    db.vehicleBrands.clear(),
    db.vehicleModels.clear(),
    db.autoParts.clear(),
    db.partCompatibilities.clear(),
    db.species.clear(),
    db.animals.clear(),
    db.breedingLots.clear(),
    db.feedings.clear(),
    db.reproductions.clear(),
    db.livestockProductions.clear(),
    db.invoiceDrafts.clear(),
    db.syncOutbox.clear(),
    db.syncLog.clear(),
    db.syncState.clear(),
  ]);
}
