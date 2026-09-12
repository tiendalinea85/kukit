import type { BusinessModelKey, ModuleCode, WorkspaceType } from '../domain/types';

export interface ModuleDef {
  code: ModuleCode;
  name: string;
  description: string;
  category: 'finance' | 'catalog' | 'operations' | 'people' | 'analytics' | 'specialized';
  status: 'active' | 'disabled';
  version: number;
}

export const MODULES: Record<ModuleCode, ModuleDef> = {
  expenses: { code: 'expenses', name: 'Gastos', description: 'Gastos, categorías y detalles', category: 'finance', status: 'active', version: 1 },
  products: { code: 'products', name: 'Productos', description: 'Catálogo de productos', category: 'catalog', status: 'active', version: 1 },
  inventory: { code: 'inventory', name: 'Inventario', description: 'Stock y movimientos', category: 'operations', status: 'active', version: 1 },
  purchases: { code: 'purchases', name: 'Compras', description: 'Compras a proveedores', category: 'operations', status: 'active', version: 1 },
  suppliers: { code: 'suppliers', name: 'Proveedores', description: 'Proveedores', category: 'people', status: 'active', version: 1 },
  sales: { code: 'sales', name: 'Ventas', description: 'Ventas', category: 'operations', status: 'active', version: 1 },
  customers: { code: 'customers', name: 'Clientes', description: 'Clientes', category: 'people', status: 'active', version: 1 },
  investments: { code: 'investments', name: 'Inversiones', description: 'Inversiones', category: 'finance', status: 'active', version: 1 },
  reports: { code: 'reports', name: 'Reportes', description: 'Reportes y dashboard', category: 'analytics', status: 'active', version: 1 },
  tailoring: { code: 'tailoring', name: 'Confección', description: 'Producción, órdenes y costos', category: 'specialized', status: 'disabled', version: 1 },
  agriculture: { code: 'agriculture', name: 'Agricultura', description: 'Cultivos, lotes e insumos', category: 'specialized', status: 'disabled', version: 1 },
  automotive_parts: { code: 'automotive_parts', name: 'Repuestos', description: 'Repuestos automotrices', category: 'specialized', status: 'disabled', version: 1 },
  breeding: { code: 'breeding', name: 'Crianza', description: 'Animales, lotes y producción', category: 'specialized', status: 'disabled', version: 1 },
};

export interface BusinessModelDef {
  key: BusinessModelKey;
  name: string;
  modules: ModuleCode[];
}

export const BUSINESS_MODELS: BusinessModelDef[] = [
  { key: 'tailoring', name: 'Taller de confección', modules: ['expenses', 'products', 'inventory', 'purchases', 'suppliers', 'sales', 'customers', 'investments', 'reports'] },
  { key: 'agriculture', name: 'Agricultura', modules: ['expenses', 'purchases', 'inventory', 'suppliers', 'reports'] },
  { key: 'automotive_parts', name: 'Repuestos automotrices', modules: ['expenses', 'products', 'inventory', 'purchases', 'sales', 'customers', 'suppliers', 'reports'] },
  { key: 'breeding', name: 'Crianza', modules: ['expenses', 'purchases', 'inventory', 'suppliers', 'reports'] },
  { key: 'commerce', name: 'Comercio', modules: ['expenses', 'products', 'inventory', 'purchases', 'sales', 'customers', 'suppliers', 'reports'] },
  { key: 'services', name: 'Servicios', modules: ['expenses', 'customers', 'sales', 'reports'] },
  { key: 'custom', name: 'Modelo personalizado', modules: [] },
];

export const TRANSVERSAL_MODULES: ModuleCode[] = ['expenses', 'reports'];

export interface PrincipalWorkspaceDef {
  name: string;
  type: WorkspaceType;
  modules: ModuleCode[];
}

export const PRINCIPAL_WORKSPACES: PrincipalWorkspaceDef[] = [
  { name: 'Personal', type: 'PERSONAL', modules: TRANSVERSAL_MODULES },
  { name: 'Trabajo', type: 'TRABAJO', modules: TRANSVERSAL_MODULES },
  { name: 'Estudio', type: 'ESTUDIO', modules: TRANSVERSAL_MODULES },
  { name: 'Negocio', type: 'NEGOCIO', modules: [] },
];

export function modulesForModel(key: BusinessModelKey): ModuleCode[] {
  return BUSINESS_MODELS.find((m) => m.key === key)?.modules ?? [];
}

export function isTransversal(code: ModuleCode): boolean {
  return TRANSVERSAL_MODULES.includes(code);
}

export function moduleEnabled(code: ModuleCode): boolean {
  return MODULES[code].status === 'active';
}
