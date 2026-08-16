export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  Settings: undefined;
  Audit: undefined;
};

export type CatalogStackParamList = {
  ProductList: undefined;
  ProductForm: { id?: string } | undefined;
  CategoryList: undefined;
  CategoryForm: { id?: string } | undefined;
};

export type SalesStackParamList = {
  SaleList: undefined;
  SaleForm: { id?: string } | undefined;
};

export type OpsStackParamList = {
  OpsHome: undefined;
  PurchaseList: undefined;
  PurchaseForm: { id?: string } | undefined;
  ExpenseList: undefined;
  ExpenseForm: { id?: string } | undefined;
  InvestmentList: undefined;
  InvestmentForm: { id?: string } | undefined;
  InventoryList: undefined;
  MovementForm: { productId?: string } | undefined;
  ClientList: undefined;
  ClientForm: { id?: string } | undefined;
};

export type ReportsStackParamList = {
  ReportsHome: undefined;
};

export type MainTabParamList = {
  Inicio: undefined;
  Catalogo: undefined;
  Ventas: undefined;
  Operaciones: undefined;
  Reportes: undefined;
};
