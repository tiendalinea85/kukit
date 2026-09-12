import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODULES,
  BUSINESS_MODELS,
  PRINCIPAL_WORKSPACES,
  TRANSVERSAL_MODULES,
  modulesForModel,
  isTransversal,
} from './modules.ts';
import {
  MODULE_UI,
  visibleTabs,
  visibleQuickLinks,
  visibleDashboardCards,
} from './moduleUI.ts';
import type { ModuleCode } from '../domain/types.ts';

describe('catálogo de módulos', () => {
  it('define todos los módulos core como activos', () => {
    for (const code of [
      'expenses',
      'products',
      'inventory',
      'purchases',
      'suppliers',
      'sales',
      'customers',
      'investments',
      'reports',
    ] as const) {
      assert.equal(MODULES[code].status, 'active');
    }
  });

  it('declara los módulos especializados como no implementados', () => {
    for (const code of ['tailoring', 'agriculture', 'automotive_parts', 'breeding'] as const) {
      assert.equal(MODULES[code].status, 'disabled');
    }
  });

  it('todo workspace operativo garantiza expenses y reports', () => {
    for (const code of TRANSVERSAL_MODULES) {
      assert.equal(MODULES[code].status, 'active');
    }
    for (const ws of PRINCIPAL_WORKSPACES) {
      if (ws.type === 'NEGOCIO') continue;
      for (const t of TRANSVERSAL_MODULES) {
        assert.ok(ws.modules.includes(t), `${ws.type} debe incluir ${t}`);
      }
    }
  });

  it('cada modelo de negocio incluye los módulos transversales', () => {
    for (const model of BUSINESS_MODELS) {
      if (model.key === 'custom') continue;
      for (const t of TRANSVERSAL_MODULES) {
        assert.ok(model.modules.includes(t), `${model.key} debe incluir ${t}`);
      }
    }
  });

  it('modulesForModel devuelve la plantilla sugerida', () => {
    assert.deepEqual(modulesForModel('services'), ['expenses', 'customers', 'sales', 'reports']);
    assert.deepEqual(modulesForModel('custom'), []);
    assert.deepEqual(modulesForModel('agriculture'), [
      'expenses',
      'purchases',
      'inventory',
      'suppliers',
      'reports',
    ]);
  });

  it('isTransversal distingue módulos transversales', () => {
    assert.equal(isTransversal('expenses'), true);
    assert.equal(isTransversal('reports'), true);
    assert.equal(isTransversal('sales'), false);
    assert.equal(isTransversal('tailoring'), false);
  });
});

describe('moduleRegistry — MODULE_UI', () => {
  it('every module code has a UI binding', () => {
    const allCodes = Object.keys(MODULES) as ModuleCode[];
    for (const code of allCodes) {
      assert.ok(MODULE_UI[code], `MODULE_UI missing binding for ${code}`);
    }
  });

  it('expenses and reports always map to their tabs', () => {
    assert.equal(MODULE_UI.expenses.tab, 'Operaciones');
    assert.equal(MODULE_UI.reports.tab, 'Reportes');
    assert.equal(MODULE_UI.sales.tab, 'Ventas');
    assert.equal(MODULE_UI.products.tab, 'Catalogo');
  });

  it('specialized modules have no tab (null)', () => {
    assert.equal(MODULE_UI.tailoring.tab, null);
    assert.equal(MODULE_UI.agriculture.tab, null);
    assert.equal(MODULE_UI.automotive_parts.tab, null);
    assert.equal(MODULE_UI.breeding.tab, null);
  });
});

describe('moduleRegistry — visibleTabs', () => {
  it('always includes Inicio', () => {
    const tabs = visibleTabs(new Set());
    assert.ok(tabs.includes('Inicio'), 'Inicio tab must always be visible');
  });

  it('adds Operaciones when expenses is enabled', () => {
    const tabs = visibleTabs(new Set(['expenses']));
    assert.ok(tabs.includes('Operaciones'));
    assert.ok(tabs.includes('Inicio'));
    assert.equal(tabs.length, 2);
  });

  it('adds Ventas when sales is enabled', () => {
    const tabs = visibleTabs(new Set(['sales']));
    assert.ok(tabs.includes('Ventas'));
    assert.ok(tabs.includes('Inicio'));
  });

  it('adds Catalogo when products is enabled', () => {
    const tabs = visibleTabs(new Set(['products']));
    assert.ok(tabs.includes('Catalogo'));
  });

  it('adds Reportes when reports is enabled', () => {
    const tabs = visibleTabs(new Set(['reports']));
    assert.ok(tabs.includes('Reportes'));
  });

  it('deduplicates tabs from multiple modules in same tab', () => {
    const tabs = visibleTabs(new Set(['expenses', 'purchases', 'investments', 'customers', 'inventory']));
    const opsCount = tabs.filter((t) => t === 'Operaciones').length;
    assert.equal(opsCount, 1, 'Operaciones should appear only once');
  });

  it('returns only Inicio when only transversal modules enabled', () => {
    const tabs = visibleTabs(new Set(['expenses', 'reports']));
    assert.deepEqual(tabs.sort(), ['Inicio', 'Operaciones', 'Reportes'].sort());
  });

  it('does not add tabs for specialized modules with no tab binding', () => {
    const tabs = visibleTabs(new Set(['tailoring', 'breeding']));
    assert.deepEqual(tabs, ['Inicio']);
  });
});

describe('moduleRegistry — visibleQuickLinks', () => {
  it('returns empty for no modules', () => {
    const links = visibleQuickLinks(new Set());
    assert.equal(links.length, 0);
  });

  it('includes Nueva venta when sales enabled', () => {
    const links = visibleQuickLinks(new Set(['sales']));
    assert.ok(links.some((l) => l.label === 'Nueva venta'));
  });

  it('includes Productos when products enabled', () => {
    const links = visibleQuickLinks(new Set(['products']));
    assert.ok(links.some((l) => l.label === 'Productos'));
  });

  it('deduplicates quick links', () => {
    const links = visibleQuickLinks(new Set(['sales', 'products', 'expenses', 'reports']));
    const uniqueLabels = new Set(links.map((l) => l.label));
    assert.equal(links.length, uniqueLabels.size, 'no duplicate quick links');
  });
});

describe('moduleRegistry — visibleDashboardCards', () => {
  it('returns empty for no modules', () => {
    const cards = visibleDashboardCards(new Set());
    assert.equal(cards.length, 0);
  });

  it('includes Ventas when sales enabled', () => {
    const cards = visibleDashboardCards(new Set(['sales']));
    assert.ok(cards.includes('Ventas'));
  });

  it('includes Gastos when expenses enabled', () => {
    const cards = visibleDashboardCards(new Set(['expenses']));
    assert.ok(cards.includes('Gastos'));
  });

  it('includes Compras when purchases enabled', () => {
    const cards = visibleDashboardCards(new Set(['purchases']));
    assert.ok(cards.includes('Compras'));
  });

  it('includes Invertido when investments enabled', () => {
    const cards = visibleDashboardCards(new Set(['investments']));
    assert.ok(cards.includes('Invertido'));
  });

  it('does not include cards for disabled modules', () => {
    const cards = visibleDashboardCards(new Set(['expenses']));
    assert.ok(!cards.includes('Ventas'));
    assert.ok(!cards.includes('Compras'));
    assert.ok(!cards.includes('Invertido'));
  });
});
