import { MODULES } from './modules.ts';
import type { ModuleCode } from '../domain/types.ts';

// ── Mapa de módulo → feature (para navegación y dashboard) ────────

/** Relación entre ModuleCode y los elementos de UI que habilita. */
export interface ModuleUIBinding {
  /** Tab principal en el bottom tab bar. null = no tiene tab propio. */
  tab: string | null;
  /** Screens dentro de un tab. */
  screens: string[];
  /** Tarjetas del dashboard. */
  dashboardCards: string[];
  /** Quick links del dashboard. */
  quickLinks: string[];
}

export const MODULE_UI: Record<ModuleCode, ModuleUIBinding> = {
  expenses:      { tab: 'Operaciones', screens: ['ExpenseList', 'ExpenseForm'], dashboardCards: ['Gastos'], quickLinks: ['Nuevo gasto'] },
  products:      { tab: 'Catalogo',   screens: ['ProductList', 'ProductForm', 'CategoryList', 'CategoryForm'], dashboardCards: [], quickLinks: ['Productos'] },
  inventory:     { tab: 'Operaciones', screens: ['InventoryList', 'MovementForm'], dashboardCards: [], quickLinks: [] },
  purchases:     { tab: 'Operaciones', screens: ['PurchaseList', 'PurchaseForm'], dashboardCards: ['Compras'], quickLinks: [] },
  suppliers:     { tab: null,          screens: [], dashboardCards: [], quickLinks: [] },
  sales:         { tab: 'Ventas',      screens: ['SaleList', 'SaleForm'], dashboardCards: ['Ventas'], quickLinks: ['Nueva venta'] },
  customers:     { tab: 'Operaciones', screens: ['ClientList', 'ClientForm'], dashboardCards: [], quickLinks: [] },
  investments:   { tab: 'Operaciones', screens: ['InvestmentList', 'InvestmentForm'], dashboardCards: ['Invertido'], quickLinks: [] },
  reports:       { tab: 'Reportes',    screens: ['ReportsHome'], dashboardCards: [], quickLinks: ['Reportes'] },
  tailoring:     { tab: null,          screens: [], dashboardCards: [], quickLinks: [] },
  agriculture:   { tab: null,          screens: [], dashboardCards: [], quickLinks: [] },
  automotive_parts: { tab: null,       screens: [], dashboardCards: [], quickLinks: [] },
  breeding:      { tab: null,          screens: [], dashboardCards: [], quickLinks: [] },
};

/** Retorna los tabs que deben mostrarse dado un set de módulos habilitados. */
export function visibleTabs(enabledCodes: Set<ModuleCode>): string[] {
  const tabs = new Set<string>();
  tabs.add('Inicio'); // siempre visible
  for (const code of enabledCodes) {
    const binding = MODULE_UI[code];
    if (binding?.tab) tabs.add(binding.tab);
  }
  return Array.from(tabs);
}

/** Retorna las quick links del dashboard filtradas por módulos habilitados. */
export function visibleQuickLinks(enabledCodes: Set<ModuleCode>): { icon: string; label: string }[] {
  const seen = new Set<string>();
  const result: { icon: string; label: string }[] = [];
  const ICON_MAP: Record<string, string> = {
    'Nueva venta': '➕',
    'Productos': '📦',
    'Nuevo gasto': '💸',
    'Reportes': '📊',
  };
  for (const code of enabledCodes) {
    for (const label of MODULE_UI[code].quickLinks) {
      if (!seen.has(label)) {
        seen.add(label);
        result.push({ icon: ICON_MAP[label] ?? '•', label });
      }
    }
  }
  return result;
}

/** Retorna los dashboard cards habilitadas. */
export function visibleDashboardCards(enabledCodes: Set<ModuleCode>): string[] {
  const seen = new Set<string>();
  for (const code of enabledCodes) {
    for (const card of MODULE_UI[code].dashboardCards) {
      seen.add(card);
    }
  }
  return Array.from(seen);
}
