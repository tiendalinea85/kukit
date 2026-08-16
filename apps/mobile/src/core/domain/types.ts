export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';

export type SyncStatus = 'pending' | 'synced' | 'error';

export type ExpenseStatus = 'activo' | 'pendiente' | 'pagado' | 'cancelado';

export type PurchaseStatus = 'pendiente' | 'recibida' | 'cancelada';

export type SaleStatus = 'borrador' | 'completada' | 'cancelada';

export type MovementType = 'entrada' | 'salida' | 'ajuste' | 'transferencia';

export type MovementReference = 'purchase' | 'sale' | 'ajuste' | 'transferencia';

export type InvestmentType = 'activo' | 'ahorro' | 'crypto' | 'inmobiliaria' | 'otro';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
  deleted?: number;
  sync_status?: SyncStatus;
  product_count?: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  sku: string;
  category_id: string | null;
  cost_price: number;
  sale_price: number;
  unit: string;
  tax_rate: number;
  stock: number;
  min_stock: number;
  active: number;
  created_at: string;
  updated_at: string;
  deleted?: number;
  sync_status?: SyncStatus;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  code: string;
  supplier: string;
  date: string;
  time: string;
  status: PurchaseStatus;
  total_amount: number;
  items_count: number;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted?: number;
  sync_status?: SyncStatus;
  items?: PurchaseItem[];
}

export interface ExpenseDetail {
  id: string;
  expense_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Expense {
  id: string;
  code: string;
  name: string;
  description: string;
  amount: number;
  total_amount: number;
  items_count: number;
  has_details: number;
  category_id: string | null;
  type_id: string | null;
  payment_method: PaymentMethod;
  status: ExpenseStatus;
  date: string;
  time: string;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted?: number;
  sync_status?: SyncStatus;
  category_name?: string;
  type_name?: string;
  details?: ExpenseDetail[];
}

export interface ExpenseType {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  sync_status?: SyncStatus;
}

export interface Investment {
  id: string;
  code: string;
  asset_name: string;
  asset_type: InvestmentType;
  amount: number;
  current_value: number;
  return_rate: number;
  date: string;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted?: number;
  sync_status?: SyncStatus;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  reference_type: MovementReference | null;
  reference_id: string | null;
  date: string;
  notes: string;
  created_at: string;
  sync_status?: SyncStatus;
}

export interface Client {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted?: number;
  sync_status?: SyncStatus;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  code: string;
  client_id: string | null;
  date: string;
  time: string;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  items_count: number;
  payment_method: PaymentMethod;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted?: number;
  sync_status?: SyncStatus;
  client_name?: string;
  items?: SaleItem[];
}

export type EntityType =
  | 'category'
  | 'product'
  | 'purchase'
  | 'purchase_item'
  | 'expense'
  | 'expense_detail'
  | 'expense_type'
  | 'investment'
  | 'stock_movement'
  | 'client'
  | 'sale'
  | 'sale_item';

export type OutboxOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface OutboxEntry {
  id: number;
  entity_type: EntityType;
  entity_id: string;
  operation: OutboxOperation;
  payload: string;
  attempts: number;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
  synced_at: string | null;
}

export interface AuditEntry {
  id: number;
  action: string;
  entity_type: EntityType;
  entity_id: string;
  before: string | null;
  after: string | null;
  created_at: string;
}

export interface SyncState {
  key: string;
  value: string;
}

export type SettingsValue = string | number | boolean;
