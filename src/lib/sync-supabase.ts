import { getSupabase, getCurrentUser } from "./supabase.ts";
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
  PaymentMethod,
} from "../types/index.ts";
import type { OutboxOperation, SyncErrorInfo, SyncTransportEntity } from "../types/sync.ts";
import { classifySyncError } from "./sync/errors.ts";

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

function categoryFromRow(row: Record<string, unknown>): Category {
  return {
    id: asStr(row.id),
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
    name: asStr(row.name),
    createdAt: asStr(row.created_at),
    syncStatus: "synced",
  };
}

function investmentFromRow(row: Record<string, unknown>): Investment {
  return {
    id: asStr(row.id),
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
// Construcción del transporte
// ---------------------------------------------------------------------------

const ENTITY_SPECS: EntitySpec[] = [
  { name: "categories", serverTable: "categories", order: 1, mode: "master", toPayload: categoryToPayload, fromRow: categoryFromRow },
  { name: "types", serverTable: "types", order: 2, mode: "master", toPayload: typeToPayload, fromRow: typeFromRow },
  { name: "investmentCategories", serverTable: "investment_categories", order: 3, mode: "master", toPayload: investmentCategoryToPayload, fromRow: investmentCategoryFromRow },
  { name: "customers", serverTable: "customers", order: 4, mode: "master", toPayload: customerToPayload, fromRow: customerFromRow },
  { name: "products", serverTable: "products", order: 5, mode: "master", toPayload: productToPayload, fromRow: productFromRow },
  { name: "expenses", serverTable: "expenses", order: 6, mode: "guarded", toPayload: expenseToPayload, fromRow: expenseFromRow },
  { name: "investments", serverTable: "investments", order: 7, mode: "guarded", toPayload: investmentToPayload, fromRow: investmentFromRow },
  { name: "sales", serverTable: "sales", order: 8, mode: "guarded", toPayload: saleToPayload, fromRow: saleFromRow },
  { name: "saleDetails", serverTable: "sale_details", order: 9, mode: "guarded", orderColumn: "created_at", toPayload: saleDetailToPayload, fromRow: saleDetailFromRow },
  { name: "purchases", serverTable: "purchases", order: 10, mode: "guarded", toPayload: purchaseToPayload, fromRow: purchaseFromRow },
  { name: "purchaseDetails", serverTable: "purchase_details", order: 11, mode: "guarded", orderColumn: "created_at", toPayload: purchaseDetailToPayload, fromRow: purchaseDetailFromRow },
  { name: "inventoryMovements", serverTable: "inventory_movements", order: 12, mode: "append", orderColumn: "created_at", toPayload: movementToPayload, fromRow: movementFromRow },
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
