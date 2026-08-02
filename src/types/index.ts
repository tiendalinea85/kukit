export interface ExpenseDetail {
  id: string;
  expenseId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  createdAt: string;
  syncStatus: "local" | "synced" | "pending";
}

export interface Expense {
  id: string;
  code: string;
  name: string;
  description: string;
  amount: number;
  categoryId: string;
  typeId: string;
  paymentMethod: string;
  status: "activo" | "pagado" | "pendiente" | "cancelado";
  date: string;
  time: string;
  notes: string;
  invoicePhoto?: string;
  hasDetails: boolean;
  totalAmount: number;
  itemsCount: number;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: "local" | "synced" | "pending";
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  syncStatus: "local" | "synced" | "pending";
}

export interface Type {
  id: string;
  name: string;
  createdAt: string;
  syncStatus: "local" | "synced" | "pending";
}

export type PeriodFilter = "today" | "yesterday" | "week" | "lastWeek" | "month" | "lastMonth" | "year" | "custom";
export type ThemeMode = "dark" | "light";
export type Language = "es" | "en";
export type ViewMode = "card" | "list";
