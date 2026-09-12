import type { SyncStatus } from "./sync.ts";
export type { SyncStatus };

export type ExpenseStatus = "pagado" | "pendiente" | "anulado";
export type PaymentMethod =
  | "efectivo"
  | "tarjeta_credito"
  | "tarjeta_debito"
  | "yape"
  | "plin"
  | "transferencia"
  | "otro";

// INVERSIONES: activo fijo adquirido por el negocio.
// Se mantiene separado de compras, gastos y ventas (no genera inventario
// de productos comerciales). Los estados reflejan el ciclo de pago + anulación;
// la gestión de activos y depreciación vendrá en una etapa futura.
export type InvestmentStatus = "pagado" | "pendiente" | "anulado";

export interface InvestmentCategory {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  syncStatus: SyncStatus;
}

export interface Investment {
  id: string;
  workspaceId: string;
  name: string;
  value: number;
  categoryId: string;
  supplier: string;
  paymentMethod: PaymentMethod;
  status: InvestmentStatus;
  date: string;
  notes: string;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  revision?: number;
}

export interface Expense {
  id: string;
  workspaceId: string;
  code: string;
  description: string;
  amount: number;
  categoryId: string;
  paymentMethod: PaymentMethod;
  status: ExpenseStatus;
  date: string;
  time: string;
  notes: string;
  receiptPhoto?: string;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  revision?: number;
}

export interface Category {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  syncStatus: SyncStatus;
}

export interface Type {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
  syncStatus: SyncStatus;
}

// VENTAS: registro de ventas realizadas. No es e-commerce: no hay carrito,
// checkout ni catálogo público. Una venta confirmada genera un movimiento
// de inventario tipo SALIDA; el stock nunca se modifica directamente.
export type SaleStatus = "pendiente" | "confirmada" | "anulada";

export interface Customer {
  id: string;
  workspaceId: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  revision?: number;
}

export interface Product {
  id: string;
  workspaceId: string;
  code: string;
  name: string;
  color: string;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  revision?: number;
}

// Movimientos de inventario (append-only). El stock nunca se modifica directa-
// mente: se deriva de la suma de movimientos. `ajuste` lleva cantidad firmada
// (positivo agrega, negativo descuenta); `entrada`/`salida` siempre positivas.
export type InventoryMovementType = "entrada" | "salida" | "ajuste";

export interface InventoryMovement {
  id: string;
  workspaceId: string;
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  referenceType:
    | "inventario_inicial"
    | "compra"
    | "anulacion_compra"
    | "venta"
    | "anulacion_venta"
    | "ajuste";
  referenceId: string;
  notes: string;
  createdAt: string;
  syncStatus: SyncStatus;
}

export interface SaleDetail {
  id: string;
  workspaceId: string;
  saleId: string;
  productId: string;
  code: string;
  name: string;
  color: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  createdAt: string;
  syncStatus: SyncStatus;
  revision?: number;
}

export interface Sale {
  id: string;
  workspaceId: string;
  code: string;
  customerId: string;
  date: string;
  paymentMethod: PaymentMethod;
  total: number;
  notes: string;
  status: SaleStatus;
  confirmedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  revision?: number;
}

// COMPRAS: entrada de mercadería/proveedores. Una compra recibida genera un
// movimiento ENTRADA de inventario (tipo "compra"); la anulación revierte con
// un movimiento de compensación "anulacion_compra". Separada de gastos e
// inversiones (solo la compra alimenta inventario).
export type PurchaseStatus = "pendiente" | "recibida" | "anulada";

export interface PurchaseDetail {
  id: string;
  workspaceId: string;
  purchaseId: string;
  productId: string;
  code: string;
  name: string;
  color: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  createdAt: string;
  syncStatus: SyncStatus;
  revision?: number;
}

export interface Purchase {
  id: string;
  workspaceId: string;
  code: string;
  supplier: string;
  date: string;
  paymentMethod: PaymentMethod;
  total: number;
  notes: string;
  status: PurchaseStatus;
  receivedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  revision?: number;
}

export type PeriodFilter = "today" | "yesterday" | "week" | "lastWeek" | "month" | "lastMonth" | "year" | "custom";
export type ThemeMode = "dark" | "light";
export type Language = "es" | "en";
export type ViewMode = "card" | "list";
