import { getSupabase, getCurrentUser } from "./supabase.ts";
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
  PaymentMethod,
} from "../types/index.ts";
import type { OutboxOperation, SyncErrorInfo, SyncTransportEntity } from "../types/sync.ts";
import { classifySyncError } from "./sync/errors.ts";
import { useWorkspaceStore } from "../stores/useWorkspaceStore.ts";

function defaultWorkspaceId(): string {
  return useWorkspaceStore.getState().activeWorkspaceId || "default";
}

// TRANSPORTE: refleja las tablas locales (Dexie) en Supabase.
//
// Cada entidad define cómo se convierte un payload local al esquema del
// servidor (push) y cómo una fila del servidor vuelve al modelo local (pull).
//
// Modos de push:
//   - master:  upsert idempotente por `id` (categorías, tipos, clientes, productos).
//   - append:  INSERT ... ON CONFLICT DO NOTHING — movimientos de inventario
//              (operaciones registradas, inmutables, nunca se sobrescriben).
//   - guarded: guardado condicional por `revision` — ventas, compras, gastos,
//              inversiones y sus detalles (operaciones históricas; si el
//              servidor tiene una revisión más nueva → conflicto).

type PushMode = "master" | "append" | "guarded";

interface EntitySpec {
  name: string;
  serverTable: string;
  order: number;
  mode: PushMode;
  orderColumn?: "updated_at" | "created_at";
  toPayload: (row: Record<string, unknown>, userId: string) => Record<string, unknown>;
  fromRow: (row: Record<string, unknown>) => unknown;
}

const asStr = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const asBool = (v: unknown, fallback = false): boolean => (typeof v === "boolean" ? v : fallback);

function normalizeStatus<T extends string>(
  v: unknown,
  map: Record<string, T>,
  fallback: T,
): T {
  const key = asStr(v);
  return key in map ? map[key] : fallback;
}

// ---------------------------------------------------------------------------
// Mapeos push (local → servidor)
// ---------------------------------------------------------------------------

function expenseToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    code: asStr(row.code),
    description: asStr(row.description),
    amount: asNum(row.amount),
    category_id: asStr(row.categoryId) || null,
    payment_method: asStr(row.paymentMethod, "efectivo"),
    status: asStr(row.status, "pagado"),
    date: asStr(row.date),
    time: asStr(row.time, "00:00"),
    notes: asStr(row.notes),
    deleted: asBool(row.deleted),
    voided_at: row.voidedAt ?? null,
    created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}

function expenseDetailToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    expense_id: asStr(row.expenseId),
    product_id: asStr(row.productId) || null,
    code: asStr(row.code),
    name: asStr(row.name),
    color: asStr(row.color),
    quantity: asNum(row.quantity),
    unit_price: asNum(row.unitPrice),
    subtotal: asNum(row.subtotal),
    created_at: asStr(row.createdAt),
    revision: asNum(row.revision, 1),
  };
}

function categoryToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    name: asStr(row.name),
    color: asStr(row.color, "#8b5cf6"),
    icon: asStr(row.icon, "📦"),
    created_at: asStr(row.createdAt),
  };
}

function typeToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    name: asStr(row.name),
    created_at: asStr(row.createdAt),
  };
}

function investmentToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    name: asStr(row.name),
    value: asNum(row.value),
    category_id: asStr(row.categoryId) || null,
    supplier: asStr(row.supplier),
    payment_method: asStr(row.paymentMethod, "efectivo"),
    status: asStr(row.status, "pagado"),
    date: asStr(row.date),
    notes: asStr(row.notes),
    deleted: asBool(row.deleted),
    voided_at: row.voidedAt ?? null,
    created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}

function investmentCategoryToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    name: asStr(row.name),
    color: asStr(row.color, "#6366f1"),
    icon: asStr(row.icon, "📦"),
    created_at: asStr(row.createdAt),
  };
}

function customerToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    name: asStr(row.name),
    phone: asStr(row.phone),
    address: asStr(row.address),
    notes: asStr(row.notes),
    deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}

function productToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    code: asStr(row.code),
    name: asStr(row.name),
    color: asStr(row.color),
    category_id: asStr(row.categoryId) || null,
    deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}

function movementToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    product_id: asStr(row.productId),
    type: asStr(row.type),
    quantity: asNum(row.quantity),
    reference_type: asStr(row.referenceType, "inventario_inicial"),
    reference_id: asStr(row.referenceId) || null,
    notes: asStr(row.notes),
    created_at: asStr(row.createdAt),
  };
}

function saleToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    code: asStr(row.code),
    customer_id: asStr(row.customerId) || null,
    date: asStr(row.date),
    payment_method: asStr(row.paymentMethod, "efectivo"),
    total: asNum(row.total),
    notes: asStr(row.notes),
    status: asStr(row.status, "pendiente"),
    confirmed_at: row.confirmedAt ?? null,
    voided_at: row.voidedAt ?? null,
    deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}

function saleDetailToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    sale_id: asStr(row.saleId),
    product_id: asStr(row.productId) || null,
    code: asStr(row.code),
    name: asStr(row.name),
    color: asStr(row.color),
    quantity: asNum(row.quantity),
    unit_price: asNum(row.unitPrice),
    subtotal: asNum(row.subtotal),
    created_at: asStr(row.createdAt),
    revision: asNum(row.revision, 1),
  };
}

function purchaseToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    code: asStr(row.code),
    supplier: asStr(row.supplier),
    date: asStr(row.date),
    payment_method: asStr(row.paymentMethod, "efectivo"),
    total: asNum(row.total),
    notes: asStr(row.notes),
    status: asStr(row.status, "pendiente"),
    received_at: row.receivedAt ?? null,
    voided_at: row.voidedAt ?? null,
    deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}

function purchaseDetailToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id),
    user_id: userId,
    purchase_id: asStr(row.purchaseId),
    product_id: asStr(row.productId) || null,
    code: asStr(row.code),
    name: asStr(row.name),
    color: asStr(row.color),
    quantity: asNum(row.quantity),
    unit_price: asNum(row.unitPrice),
    subtotal: asNum(row.subtotal),
    created_at: asStr(row.createdAt),
    revision: asNum(row.revision, 1),
  };
}

// ---------------------------------------------------------------------------
// Mapeos pull (servidor → local)
// ---------------------------------------------------------------------------

function expenseFromRow(row: Record<string, unknown>): Expense {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    code: asStr(row.code),
    description: asStr(row.description),
    amount: asNum(row.amount),
    categoryId: asStr(row.category_id),
    paymentMethod: asStr(row.payment_method, "efectivo") as PaymentMethod,
    status: normalizeStatus(
      row.status,
      { pagado: "pagado", pendiente: "pendiente", anulado: "anulado" },
      "pagado",
    ),
    date: asStr(row.date),
    time: asStr(row.time, "00:00"),
    notes: asStr(row.notes),
    voidedAt: row.voided_at ? asStr(row.voided_at) : null,
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted),
    syncStatus: "synced",
    revision: asNum(row.revision, 1),
  };
}

function expenseDetailFromRow(row: Record<string, unknown>): ExpenseDetail {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    expenseId: asStr(row.expense_id),
    productId: asStr(row.product_id),
    code: asStr(row.code),
    name: asStr(row.name),
    color: asStr(row.color),
    quantity: asNum(row.quantity),
    unitPrice: asNum(row.unit_price),
    subtotal: asNum(row.subtotal),
    createdAt: asStr(row.created_at),
    syncStatus: "synced",
    revision: asNum(row.revision, 1),
  };
}

function categoryFromRow(row: Record<string, unknown>): Category {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    name: asStr(row.name),
    color: asStr(row.color, "#8b5cf6"),
    icon: asStr(row.icon, "📦"),
    createdAt: asStr(row.created_at),
    syncStatus: "synced",
  };
}

function typeFromRow(row: Record<string, unknown>): Type {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    name: asStr(row.name),
    createdAt: asStr(row.created_at),
    syncStatus: "synced",
  };
}

function investmentFromRow(row: Record<string, unknown>): Investment {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    name: asStr(row.name),
    value: asNum(row.value),
    categoryId: asStr(row.category_id),
    supplier: asStr(row.supplier),
    paymentMethod: asStr(row.payment_method, "efectivo") as PaymentMethod,
    status: normalizeStatus(
      row.status,
      { pagado: "pagado", pendiente: "pendiente", anulado: "anulado" },
      "pagado",
    ),
    date: asStr(row.date),
    notes: asStr(row.notes),
    voidedAt: row.voided_at ? asStr(row.voided_at) : null,
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted),
    syncStatus: "synced",
    revision: asNum(row.revision, 1),
  };
}

function investmentCategoryFromRow(row: Record<string, unknown>): InvestmentCategory {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    name: asStr(row.name),
    color: asStr(row.color, "#6366f1"),
    icon: asStr(row.icon, "📦"),
    createdAt: asStr(row.created_at),
    syncStatus: "synced",
  };
}

function customerFromRow(row: Record<string, unknown>): Customer {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    name: asStr(row.name),
    phone: asStr(row.phone),
    address: asStr(row.address),
    notes: asStr(row.notes),
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted),
    syncStatus: "synced",
    revision: asNum(row.revision, 1),
  };
}

function productFromRow(row: Record<string, unknown>): Product {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    code: asStr(row.code),
    name: asStr(row.name),
    color: asStr(row.color),
    categoryId: asStr(row.category_id),
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted),
    syncStatus: "synced",
    revision: asNum(row.revision, 1),
  };
}

function movementFromRow(row: Record<string, unknown>): InventoryMovement {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    productId: asStr(row.product_id),
    type: normalizeStatus(
      row.type,
      { entrada: "entrada", salida: "salida", ajuste: "ajuste" },
      "entrada",
    ),
    quantity: asNum(row.quantity),
    referenceType: normalizeStatus(
      row.reference_type,
      {
        inventario_inicial: "inventario_inicial",
        compra: "compra",
        anulacion_compra: "anulacion_compra",
        venta: "venta",
        anulacion_venta: "anulacion_venta",
        ajuste: "ajuste",
      },
      "inventario_inicial",
    ),
    referenceId: asStr(row.reference_id),
    notes: asStr(row.notes),
    createdAt: asStr(row.created_at),
    syncStatus: "synced",
  };
}

function saleFromRow(row: Record<string, unknown>): Sale {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    code: asStr(row.code),
    customerId: asStr(row.customer_id),
    date: asStr(row.date),
    paymentMethod: asStr(row.payment_method, "efectivo") as PaymentMethod,
    total: asNum(row.total),
    notes: asStr(row.notes),
    status: normalizeStatus(
      row.status,
      { pendiente: "pendiente", confirmada: "confirmada", anulada: "anulada" },
      "pendiente",
    ),
    confirmedAt: row.confirmed_at ? asStr(row.confirmed_at) : null,
    voidedAt: row.voided_at ? asStr(row.voided_at) : null,
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted),
    syncStatus: "synced",
    revision: asNum(row.revision, 1),
  };
}

function saleDetailFromRow(row: Record<string, unknown>): SaleDetail {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    saleId: asStr(row.sale_id),
    productId: asStr(row.product_id),
    code: asStr(row.code),
    name: asStr(row.name),
    color: asStr(row.color),
    quantity: asNum(row.quantity),
    unitPrice: asNum(row.unit_price),
    subtotal: asNum(row.subtotal),
    createdAt: asStr(row.created_at),
    syncStatus: "synced",
    revision: asNum(row.revision, 1),
  };
}

function purchaseFromRow(row: Record<string, unknown>): Purchase {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    code: asStr(row.code),
    supplier: asStr(row.supplier),
    date: asStr(row.date),
    paymentMethod: asStr(row.payment_method, "efectivo") as PaymentMethod,
    total: asNum(row.total),
    notes: asStr(row.notes),
    status: normalizeStatus(
      row.status,
      { pendiente: "pendiente", recibida: "recibida", anulada: "anulada" },
      "pendiente",
    ),
    receivedAt: row.received_at ? asStr(row.received_at) : null,
    voidedAt: row.voided_at ? asStr(row.voided_at) : null,
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted),
    syncStatus: "synced",
    revision: asNum(row.revision, 1),
  };
}

function purchaseDetailFromRow(row: Record<string, unknown>): PurchaseDetail {
  return {
    id: asStr(row.id),
    workspaceId: asStr(row.workspace_id, defaultWorkspaceId()),
    purchaseId: asStr(row.purchase_id),
    productId: asStr(row.product_id),
    code: asStr(row.code),
    name: asStr(row.name),
    color: asStr(row.color),
    quantity: asNum(row.quantity),
    unitPrice: asNum(row.unit_price),
    subtotal: asNum(row.subtotal),
    createdAt: asStr(row.created_at),
    syncStatus: "synced",
    revision: asNum(row.revision, 1),
  };
}

// ---------------------------------------------------------------------------
// Módulos especializados: mapeos push
// ---------------------------------------------------------------------------

function garmentToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), name: asStr(row.name), description: asStr(row.description),
    category_id: asStr(row.categoryId) || null, sale_price: asNum(row.salePrice),
    notes: asStr(row.notes), deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt), updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}
function sizeToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    name: asStr(row.name), sort_order: asNum(row.sortOrder),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt),
  };
}
function garmentColorToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    name: asStr(row.name), hex: asStr(row.hex, "#8b5cf6"),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt),
  };
}
function materialToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), name: asStr(row.name), unit: asStr(row.unit),
    cost_per_unit: asNum(row.costPerUnit), stock: asNum(row.stock),
    notes: asStr(row.notes), deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt), updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}
function productionOrderToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), garment_id: asStr(row.garmentId),
    garment_name: asStr(row.garmentName), size_id: asStr(row.sizeId),
    size_name: asStr(row.sizeName), color_id: asStr(row.colorId),
    color_name: asStr(row.colorName), quantity: asNum(row.quantity),
    unit_cost: asNum(row.unitCost), total_cost: asNum(row.totalCost),
    status: asStr(row.status, "pendiente"), start_date: asStr(row.startDate),
    due_date: asStr(row.dueDate), completed_at: row.completedAt ?? null,
    notes: asStr(row.notes), voided_at: row.voidedAt ?? null,
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt), revision: asNum(row.revision, 1),
  };
}
function productionMaterialToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    production_order_id: asStr(row.productionOrderId),
    material_id: asStr(row.materialId), material_name: asStr(row.materialName),
    quantity: asNum(row.quantity), unit_cost: asNum(row.unitCost),
    total_cost: asNum(row.totalCost), created_at: asStr(row.createdAt),
  };
}

function cropToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), name: asStr(row.name), description: asStr(row.description),
    season: asStr(row.season), status: asStr(row.status, "activa"),
    start_date: asStr(row.startDate), end_date: row.endDate ?? null,
    notes: asStr(row.notes), deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt), updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}
function farmLotToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), name: asStr(row.name), area: asNum(row.area),
    area_unit: asStr(row.areaUnit), location: asStr(row.location),
    soil_type: asStr(row.soilType), notes: asStr(row.notes),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt), revision: asNum(row.revision, 1),
  };
}
function agroInputToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), name: asStr(row.name), type: asStr(row.type, "otro"),
    unit: asStr(row.unit), cost_per_unit: asNum(row.costPerUnit),
    stock: asNum(row.stock), supplier: asStr(row.supplier),
    notes: asStr(row.notes), deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt), updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}
function applicationToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), crop_id: asStr(row.cropId), crop_name: asStr(row.cropName),
    lot_id: asStr(row.lotId), lot_name: asStr(row.lotName),
    input_id: asStr(row.inputId), input_name: asStr(row.inputName),
    quantity: asNum(row.quantity), unit: asStr(row.unit),
    application_date: asStr(row.applicationDate), notes: asStr(row.notes),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt), revision: asNum(row.revision, 1),
  };
}
function laborToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), crop_id: asStr(row.cropId), crop_name: asStr(row.cropName),
    lot_id: asStr(row.lotId), lot_name: asStr(row.lotName),
    type: asStr(row.type, "otro"), description: asStr(row.description),
    labor_date: asStr(row.laborDate), labor_cost: asNum(row.laborCost),
    worker_count: asNum(row.workerCount), notes: asStr(row.notes),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt), revision: asNum(row.revision, 1),
  };
}
function harvestToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), crop_id: asStr(row.cropId), crop_name: asStr(row.cropName),
    lot_id: asStr(row.lotId), lot_name: asStr(row.lotName),
    product: asStr(row.product), quantity: asNum(row.quantity),
    unit: asStr(row.unit), unit_price: asNum(row.unitPrice),
    total_value: asNum(row.totalValue), harvest_date: asStr(row.harvestDate),
    quality: asStr(row.quality, "estandar"), notes: asStr(row.notes),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt), revision: asNum(row.revision, 1),
  };
}

function vehicleBrandToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    name: asStr(row.name), country: asStr(row.country),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt),
  };
}
function vehicleModelToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    brand_id: asStr(row.brandId), brand_name: asStr(row.brandName),
    name: asStr(row.name), start_year: asNum(row.startYear),
    end_year: row.endYear ?? null, engine: asStr(row.engine),
    notes: asStr(row.notes), deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt),
  };
}
function autoPartToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), name: asStr(row.name), part_number: asStr(row.partNumber),
    brand: asStr(row.brand), category: asStr(row.category, "otro"),
    unit_price: asNum(row.unitPrice), cost_price: asNum(row.costPrice),
    stock: asNum(row.stock), min_stock: asNum(row.minStock),
    notes: asStr(row.notes), deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt), updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}
function partCompatibilityToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    part_id: asStr(row.partId), model_id: asStr(row.modelId),
    brand_name: asStr(row.brandName), model_name: asStr(row.modelName),
    year_from: asNum(row.yearFrom), year_to: row.yearTo ?? null,
    engine: asStr(row.engine), notes: asStr(row.notes),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
  };
}

function speciesToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    name: asStr(row.name), category: asStr(row.category, "otro"),
    unit: asStr(row.unit), notes: asStr(row.notes),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt),
  };
}
function animalToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), name: asStr(row.name),
    species_id: asStr(row.speciesId), species_name: asStr(row.speciesName),
    gender: asStr(row.gender, "macho"), birth_date: asStr(row.birthDate),
    lot_id: asStr(row.lotId), lot_name: asStr(row.lotName),
    status: asStr(row.status, "activo"), notes: asStr(row.notes),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt), revision: asNum(row.revision, 1),
  };
}
function breedingLotToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), name: asStr(row.name),
    species_id: asStr(row.speciesId), species_name: asStr(row.speciesName),
    location: asStr(row.location), capacity: asNum(row.capacity),
    current_count: asNum(row.currentCount), notes: asStr(row.notes),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt), revision: asNum(row.revision, 1),
  };
}
function feedingToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), lot_id: asStr(row.lotId), lot_name: asStr(row.lotName),
    feed_type: asStr(row.feedType, "otro"), feed_name: asStr(row.feedName),
    quantity: asNum(row.quantity), unit: asStr(row.unit),
    cost: asNum(row.cost), feeding_date: asStr(row.feedingDate),
    notes: asStr(row.notes), deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt), updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}
function reproductionToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), animal_id: asStr(row.animalId),
    animal_name: asStr(row.animalName), event: asStr(row.event, "otro"),
    event_date: asStr(row.eventDate), target_animal: asStr(row.targetAnimal),
    result: asStr(row.result), notes: asStr(row.notes),
    deleted: asBool(row.deleted), created_at: asStr(row.createdAt),
    updated_at: asStr(row.updatedAt), revision: asNum(row.revision, 1),
  };
}
function livestockProductionToPayload(row: Record<string, unknown>, userId: string) {
  return {
    id: asStr(row.id), user_id: userId, workspace_id: asStr(row.workspaceId),
    code: asStr(row.code), lot_id: asStr(row.lotId), lot_name: asStr(row.lotName),
    type: asStr(row.type, "otro"), quantity: asNum(row.quantity),
    unit: asStr(row.unit), unit_price: asNum(row.unitPrice),
    total_value: asNum(row.totalValue), production_date: asStr(row.productionDate),
    notes: asStr(row.notes), deleted: asBool(row.deleted),
    created_at: asStr(row.createdAt), updated_at: asStr(row.updatedAt),
    revision: asNum(row.revision, 1),
  };
}

// ---------------------------------------------------------------------------
// Módulos especializados: mapeos pull
// ---------------------------------------------------------------------------

function garmentFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), name: asStr(row.name),
    description: asStr(row.description), categoryId: asStr(row.category_id),
    salePrice: asNum(row.sale_price), notes: asStr(row.notes),
    voidedAt: null, createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id), revision: asNum(row.revision, 1),
  };
}
function sizeFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), name: asStr(row.name), sortOrder: asNum(row.sort_order),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id),
  };
}
function garmentColorFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), name: asStr(row.name), hex: asStr(row.hex, "#8b5cf6"),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id),
  };
}
function materialFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), name: asStr(row.name),
    unit: asStr(row.unit), costPerUnit: asNum(row.cost_per_unit),
    stock: asNum(row.stock), notes: asStr(row.notes),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id), revision: asNum(row.revision, 1),
  };
}
function productionOrderFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), garmentId: asStr(row.garment_id),
    garmentName: asStr(row.garment_name), sizeId: asStr(row.size_id),
    sizeName: asStr(row.size_name), colorId: asStr(row.color_id),
    colorName: asStr(row.color_name), quantity: asNum(row.quantity),
    unitCost: asNum(row.unit_cost), totalCost: asNum(row.total_cost),
    status: asStr(row.status, "pendiente"), startDate: asStr(row.start_date),
    dueDate: asStr(row.due_date), completedAt: row.completed_at ? asStr(row.completed_at) : null,
    notes: asStr(row.notes), voidedAt: row.voided_at ? asStr(row.voided_at) : null,
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id), revision: asNum(row.revision, 1),
  };
}
function productionMaterialFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), productionOrderId: asStr(row.production_order_id),
    materialId: asStr(row.material_id), materialName: asStr(row.material_name),
    quantity: asNum(row.quantity), unitCost: asNum(row.unit_cost),
    totalCost: asNum(row.total_cost), createdAt: asStr(row.created_at),
    syncStatus: "synced" as const, workspaceId: asStr(row.workspace_id),
  };
}

function cropFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), name: asStr(row.name),
    description: asStr(row.description), season: asStr(row.season),
    status: asStr(row.status, "activa"), startDate: asStr(row.start_date),
    endDate: row.end_date ? asStr(row.end_date) : null, notes: asStr(row.notes),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id), revision: asNum(row.revision, 1),
  };
}
function farmLotFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), name: asStr(row.name),
    area: asNum(row.area), areaUnit: asStr(row.area_unit),
    location: asStr(row.location), soilType: asStr(row.soil_type),
    notes: asStr(row.notes), createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at), deleted: asBool(row.deleted),
    syncStatus: "synced" as const, workspaceId: asStr(row.workspace_id),
    revision: asNum(row.revision, 1),
  };
}
function agroInputFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), name: asStr(row.name),
    type: asStr(row.type, "otro"), unit: asStr(row.unit),
    costPerUnit: asNum(row.cost_per_unit), stock: asNum(row.stock),
    supplier: asStr(row.supplier), notes: asStr(row.notes),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id), revision: asNum(row.revision, 1),
  };
}
function applicationFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), cropId: asStr(row.crop_id),
    cropName: asStr(row.crop_name), lotId: asStr(row.lot_id),
    lotName: asStr(row.lot_name), inputId: asStr(row.input_id),
    inputName: asStr(row.input_name), quantity: asNum(row.quantity),
    unit: asStr(row.unit), applicationDate: asStr(row.application_date),
    notes: asStr(row.notes), createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at), deleted: asBool(row.deleted),
    syncStatus: "synced" as const, workspaceId: asStr(row.workspace_id),
    revision: asNum(row.revision, 1),
  };
}
function laborFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), cropId: asStr(row.crop_id),
    cropName: asStr(row.crop_name), lotId: asStr(row.lot_id),
    lotName: asStr(row.lot_name), type: asStr(row.type, "otro"),
    description: asStr(row.description), laborDate: asStr(row.labor_date),
    laborCost: asNum(row.labor_cost), workerCount: asNum(row.worker_count),
    notes: asStr(row.notes), createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at), deleted: asBool(row.deleted),
    syncStatus: "synced" as const, workspaceId: asStr(row.workspace_id),
    revision: asNum(row.revision, 1),
  };
}
function harvestFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), cropId: asStr(row.crop_id),
    cropName: asStr(row.crop_name), lotId: asStr(row.lot_id),
    lotName: asStr(row.lot_name), product: asStr(row.product),
    quantity: asNum(row.quantity), unit: asStr(row.unit),
    unitPrice: asNum(row.unit_price), totalValue: asNum(row.total_value),
    harvestDate: asStr(row.harvest_date), quality: asStr(row.quality, "estandar"),
    notes: asStr(row.notes), createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at), deleted: asBool(row.deleted),
    syncStatus: "synced" as const, workspaceId: asStr(row.workspace_id),
    revision: asNum(row.revision, 1),
  };
}

function vehicleBrandFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), name: asStr(row.name), country: asStr(row.country),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id),
  };
}
function vehicleModelFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), brandId: asStr(row.brand_id), brandName: asStr(row.brand_name),
    name: asStr(row.name), startYear: asNum(row.start_year),
    endYear: row.end_year != null ? asNum(row.end_year) : null,
    engine: asStr(row.engine), notes: asStr(row.notes),
    createdAt: asStr(row.created_at), deleted: asBool(row.deleted),
    syncStatus: "synced" as const, workspaceId: asStr(row.workspace_id),
  };
}
function autoPartFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), name: asStr(row.name),
    partNumber: asStr(row.part_number), brand: asStr(row.brand),
    category: asStr(row.category, "otro"), unitPrice: asNum(row.unit_price),
    costPrice: asNum(row.cost_price), stock: asNum(row.stock),
    minStock: asNum(row.min_stock), notes: asStr(row.notes),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id), revision: asNum(row.revision, 1),
  };
}
function partCompatibilityFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), partId: asStr(row.part_id), modelId: asStr(row.model_id),
    brandName: asStr(row.brand_name), modelName: asStr(row.model_name),
    yearFrom: asNum(row.year_from), yearTo: row.year_to != null ? asNum(row.year_to) : null,
    engine: asStr(row.engine), notes: asStr(row.notes),
    createdAt: asStr(row.created_at), deleted: asBool(row.deleted),
    syncStatus: "synced" as const, workspaceId: asStr(row.workspace_id),
  };
}

function speciesFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), name: asStr(row.name), category: asStr(row.category, "otro"),
    unit: asStr(row.unit), notes: asStr(row.notes),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id),
  };
}
function animalFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), name: asStr(row.name),
    speciesId: asStr(row.species_id), speciesName: asStr(row.species_name),
    gender: asStr(row.gender, "macho"), birthDate: asStr(row.birth_date),
    lotId: asStr(row.lot_id), lotName: asStr(row.lot_name),
    status: asStr(row.status, "activo"), notes: asStr(row.notes),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id), revision: asNum(row.revision, 1),
  };
}
function breedingLotFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), name: asStr(row.name),
    speciesId: asStr(row.species_id), speciesName: asStr(row.species_name),
    location: asStr(row.location), capacity: asNum(row.capacity),
    currentCount: asNum(row.current_count), notes: asStr(row.notes),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id), revision: asNum(row.revision, 1),
  };
}
function feedingFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), lotId: asStr(row.lot_id),
    lotName: asStr(row.lot_name), feedType: asStr(row.feed_type, "otro"),
    feedName: asStr(row.feed_name), quantity: asNum(row.quantity),
    unit: asStr(row.unit), cost: asNum(row.cost),
    feedingDate: asStr(row.feeding_date), notes: asStr(row.notes),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id), revision: asNum(row.revision, 1),
  };
}
function reproductionFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), animalId: asStr(row.animal_id),
    animalName: asStr(row.animal_name), event: asStr(row.event, "otro"),
    eventDate: asStr(row.event_date), targetAnimal: asStr(row.target_animal),
    result: asStr(row.result), notes: asStr(row.notes),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id), revision: asNum(row.revision, 1),
  };
}
function livestockProductionFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: asStr(row.id), code: asStr(row.code), lotId: asStr(row.lot_id),
    lotName: asStr(row.lot_name), type: asStr(row.type, "otro"),
    quantity: asNum(row.quantity), unit: asStr(row.unit),
    unitPrice: asNum(row.unit_price), totalValue: asNum(row.total_value),
    productionDate: asStr(row.production_date), notes: asStr(row.notes),
    createdAt: asStr(row.created_at), updatedAt: asStr(row.updated_at),
    deleted: asBool(row.deleted), syncStatus: "synced" as const,
    workspaceId: asStr(row.workspace_id), revision: asNum(row.revision, 1),
  };
}

// ---------------------------------------------------------------------------
// Construcción del transporte
// ---------------------------------------------------------------------------

const ENTITY_SPECS: EntitySpec[] = [
  { name: "categories", serverTable: "categories", order: 1, mode: "master", toPayload: categoryToPayload, fromRow: categoryFromRow },
  { name: "types", serverTable: "types", order: 2, mode: "master", toPayload: typeToPayload, fromRow: typeFromRow },
  { name: "investmentCategories", serverTable: "investment_categories", order: 3, mode: "master", toPayload: investmentCategoryToPayload, fromRow: investmentCategoryFromRow },
  { name: "customers", serverTable: "customers", order: 4, mode: "master", toPayload: customerToPayload, fromRow: customerFromRow },
  { name: "products", serverTable: "products", order: 5, mode: "master", toPayload: productToPayload, fromRow: productFromRow },
  { name: "expenses", serverTable: "expenses", order: 6, mode: "guarded", toPayload: expenseToPayload, fromRow: expenseFromRow },
  { name: "expenseDetails", serverTable: "expense_details", order: 6.5, mode: "guarded", orderColumn: "created_at", toPayload: expenseDetailToPayload, fromRow: expenseDetailFromRow },
  { name: "investments", serverTable: "investments", order: 7, mode: "guarded", toPayload: investmentToPayload, fromRow: investmentFromRow },
  { name: "sales", serverTable: "sales", order: 8, mode: "guarded", toPayload: saleToPayload, fromRow: saleFromRow },
  { name: "saleDetails", serverTable: "sale_details", order: 9, mode: "guarded", orderColumn: "created_at", toPayload: saleDetailToPayload, fromRow: saleDetailFromRow },
  { name: "purchases", serverTable: "purchases", order: 10, mode: "guarded", toPayload: purchaseToPayload, fromRow: purchaseFromRow },
  { name: "purchaseDetails", serverTable: "purchase_details", order: 11, mode: "guarded", orderColumn: "created_at", toPayload: purchaseDetailToPayload, fromRow: purchaseDetailFromRow },
  { name: "inventoryMovements", serverTable: "inventory_movements", order: 12, mode: "append", orderColumn: "created_at", toPayload: movementToPayload, fromRow: movementFromRow },

  // Taller de confección
  { name: "garments", serverTable: "garments", order: 13, mode: "master", toPayload: garmentToPayload, fromRow: garmentFromRow },
  { name: "sizes", serverTable: "sizes", order: 14, mode: "master", toPayload: sizeToPayload, fromRow: sizeFromRow },
  { name: "garmentColors", serverTable: "garment_colors", order: 15, mode: "master", toPayload: garmentColorToPayload, fromRow: garmentColorFromRow },
  { name: "materials", serverTable: "materials", order: 16, mode: "master", toPayload: materialToPayload, fromRow: materialFromRow },
  { name: "productionOrders", serverTable: "production_orders", order: 17, mode: "guarded", toPayload: productionOrderToPayload, fromRow: productionOrderFromRow },
  { name: "productionMaterials", serverTable: "production_materials", order: 18, mode: "append", orderColumn: "created_at", toPayload: productionMaterialToPayload, fromRow: productionMaterialFromRow },

  // Agricultura
  { name: "crops", serverTable: "crops", order: 19, mode: "guarded", toPayload: cropToPayload, fromRow: cropFromRow },
  { name: "farmLots", serverTable: "farm_lots", order: 20, mode: "guarded", toPayload: farmLotToPayload, fromRow: farmLotFromRow },
  { name: "agroInputs", serverTable: "agro_inputs", order: 21, mode: "master", toPayload: agroInputToPayload, fromRow: agroInputFromRow },
  { name: "applications", serverTable: "applications", order: 22, mode: "guarded", toPayload: applicationToPayload, fromRow: applicationFromRow },
  { name: "labors", serverTable: "labors", order: 23, mode: "guarded", toPayload: laborToPayload, fromRow: laborFromRow },
  { name: "harvests", serverTable: "harvests", order: 24, mode: "guarded", toPayload: harvestToPayload, fromRow: harvestFromRow },

  // Repuestos automotrices
  { name: "vehicleBrands", serverTable: "vehicle_brands", order: 25, mode: "master", toPayload: vehicleBrandToPayload, fromRow: vehicleBrandFromRow },
  { name: "vehicleModels", serverTable: "vehicle_models", order: 26, mode: "master", orderColumn: "created_at", toPayload: vehicleModelToPayload, fromRow: vehicleModelFromRow },
  { name: "autoParts", serverTable: "auto_parts", order: 27, mode: "master", toPayload: autoPartToPayload, fromRow: autoPartFromRow },
  { name: "partCompatibilities", serverTable: "part_compatibilities", order: 28, mode: "append", orderColumn: "created_at", toPayload: partCompatibilityToPayload, fromRow: partCompatibilityFromRow },

  // Crianza
  { name: "species", serverTable: "species", order: 29, mode: "master", toPayload: speciesToPayload, fromRow: speciesFromRow },
  { name: "breedingLots", serverTable: "breeding_lots", order: 30, mode: "guarded", toPayload: breedingLotToPayload, fromRow: breedingLotFromRow },
  { name: "animals", serverTable: "animals", order: 31, mode: "guarded", toPayload: animalToPayload, fromRow: animalFromRow },
  { name: "feedings", serverTable: "feedings", order: 32, mode: "guarded", toPayload: feedingToPayload, fromRow: feedingFromRow },
  { name: "reproductions", serverTable: "reproductions", order: 33, mode: "guarded", toPayload: reproductionToPayload, fromRow: reproductionFromRow },
  { name: "livestockProductions", serverTable: "livestock_productions", order: 34, mode: "guarded", toPayload: livestockProductionToPayload, fromRow: livestockProductionFromRow },
];

const PULL_PAGE_SIZE = 500;

export function buildSupabaseTransport(): SyncTransportEntity[] {
  return ENTITY_SPECS.map((spec) => ({
    name: spec.name,
    serverTable: spec.serverTable,
    order: spec.order,
    async push(op: OutboxOperation): Promise<SyncErrorInfo | null> {
      return pushOp(spec, op);
    },
    async pull(sinceIso: string) {
      return pullTable(spec, sinceIso);
    },
  }));
}

async function pushOp(spec: EntitySpec, op: OutboxOperation): Promise<SyncErrorInfo | null> {
  const sb = getSupabase();
  if (!sb) return { type: "network", message: "Supabase no configurado", retryable: true };
  const userId = await currentUserId();
  if (!userId) return { type: "auth", message: "Sin sesión activa", retryable: false };

  const payload = spec.toPayload(op.payload, userId);

  try {
    if (op.op === "delete") {
      const { error } = await sb.from(spec.serverTable).delete().eq("id", op.entityId);
      return error ? classifySyncError(error) : null;
    }

    if (spec.mode === "append") {
      // Movimientos de inventario: INSERT idempotente, nunca se actualizan.
      const { error } = await sb.from(spec.serverTable).upsert(payload, {
        onConflict: "id",
        ignoreDuplicates: true,
      });
      return error ? classifySyncError(error) : null;
    }

    if (spec.mode === "guarded") {
      // Operaciones registradas: guardado condicional por revisión.
      const localRevision = asNum(payload.revision, 1);
      const { data: existing, error: selErr } = await sb
        .from(spec.serverTable)
        .select("id, revision")
        .eq("id", op.entityId)
        .maybeSingle();
      if (selErr) return classifySyncError(selErr);

      if (existing) {
        if (asNum((existing as { revision?: unknown }).revision, 1) > localRevision) {
          return {
            type: "conflict",
            message: `Versión remota más nueva (${(existing as { revision?: unknown }).revision} > ${localRevision})`,
            retryable: false,
          };
        }
        const { error: updErr } = await sb
          .from(spec.serverTable)
          .update(payload)
          .eq("id", op.entityId);
        return updErr ? classifySyncError(updErr) : null;
      }

      const { error: insErr } = await sb
        .from(spec.serverTable)
        .upsert(payload, { onConflict: "id", ignoreDuplicates: true });
      return insErr ? classifySyncError(insErr) : null;
    }

    // Master data: upsert idempotente por id.
    const { error } = await sb
      .from(spec.serverTable)
      .upsert(payload, { onConflict: "id", ignoreDuplicates: false });
    return error ? classifySyncError(error) : null;
  } catch (err) {
    return classifySyncError(err);
  }
}

async function pullTable(
  spec: EntitySpec,
  sinceIso: string,
): Promise<{ rows: Array<Record<string, unknown>>; watermark: string | null }> {
  const sb = getSupabase();
  if (!sb) return { rows: [], watermark: sinceIso };
  const userId = await currentUserId();
  if (!userId) return { rows: [], watermark: sinceIso };

  const orderColumn = spec.orderColumn ?? "updated_at";
  const rows: Array<Record<string, unknown>> = [];
  let page = 0;
  let lastWatermark = sinceIso;

  try {
    while (true) {
      let query = sb
        .from(spec.serverTable)
        .select("*")
        .eq("user_id", userId)
        .order(orderColumn, { ascending: true });

      if (sinceIso) query = query.gte(orderColumn, sinceIso);
      query = query.range(page * PULL_PAGE_SIZE, page * PULL_PAGE_SIZE + PULL_PAGE_SIZE - 1);

      const { data, error } = await query;
      if (error) throw error;

      const pageRows = (data ?? []) as Array<Record<string, unknown>>;
      rows.push(...pageRows);
      if (!pageRows.length || pageRows.length < PULL_PAGE_SIZE) break;
      page++;
    }

    if (rows.length) {
      const ordered = rows
        .map((r) => asStr(r[orderColumn]))
        .filter(Boolean)
        .sort();
      lastWatermark = ordered[ordered.length - 1];
    }

    return {
      rows: rows.map((r) => spec.fromRow(r) as Record<string, unknown>),
      watermark: lastWatermark,
    };
  } catch (err) {
    throw classifySyncError(err);
  }
}

async function currentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}
