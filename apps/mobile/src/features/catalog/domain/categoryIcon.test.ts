import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_ICON_GROUPS,
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  categoryIconText,
  filterCategoryIconGroups,
  isDataUrlIcon,
  isTextIcon,
  normalizeCategoryIcon,
  selectedIconOrFallback,
} from './categoryIcon.ts';

const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

describe('catálogo de iconos', () => {
  it('expone al menos 15 grupos con 12 iconos cada uno', () => {
    assert.ok(CATEGORY_ICON_GROUPS.length >= 15);
    for (const group of CATEGORY_ICON_GROUPS) {
      assert.equal(group.icons.length, 12, `grupo ${group.label}`);
      assert.ok(group.label.length > 0);
    }
  });

  it('no repite iconos entre grupos', () => {
    const flat = CATEGORY_ICON_GROUPS.flatMap((g) => [...g.icons]);
    assert.equal(new Set(flat).size, flat.length);
    assert.equal(CATEGORY_ICONS.length, flat.length);
  });

  it('ofrece al menos 150 iconos', () => {
    assert.ok(CATEGORY_ICONS.length >= 150, `solo ${CATEGORY_ICONS.length}`);
  });

  it('busca por etiqueta ignorando acentos y mayúsculas', () => {
    const res = filterCategoryIconGroups('Confeccion');
    assert.equal(res.length, 1);
    assert.equal(res[0]?.label, 'Taller de confección');
  });

  it('busca por palabra clave que no está en la etiqueta', () => {
    assert.ok(filterCategoryIconGroups('gasolina').length >= 1);
    assert.ok(filterCategoryIconGroups('mecanico').length >= 1);
  });

  it('devuelve todos los grupos con la consulta vacía', () => {
    assert.equal(filterCategoryIconGroups('').length, CATEGORY_ICON_GROUPS.length);
    assert.equal(filterCategoryIconGroups('  ').length, CATEGORY_ICON_GROUPS.length);
  });

  it('devuelve cero grupos si nada coincide', () => {
    assert.equal(filterCategoryIconGroups('zzzqqq').length, 0);
  });
});

describe('detección de iconos', () => {
  it('reconoce un emoji como icono de texto', () => {
    assert.equal(isTextIcon('🧵'), true);
    assert.equal(isDataUrlIcon('🧵'), false);
  });

  it('reconoce un data URL como imagen', () => {
    assert.equal(isDataUrlIcon(DATA_URL), true);
    assert.equal(isTextIcon(DATA_URL), false);
  });

  it('trata vacío y undefined como no icono', () => {
    assert.equal(isTextIcon(''), false);
    assert.equal(isTextIcon(undefined), false);
    assert.equal(isDataUrlIcon(undefined), false);
  });

  it('no confunde una cadena larga con un emoji', () => {
    assert.equal(isTextIcon('a'.repeat(64)), false);
  });
});

describe('texto a mostrar', () => {
  it('devuelve el emoji tal cual', () => {
    assert.equal(categoryIconText('🧵'), '🧵');
    assert.equal(categoryIconText('📦'), '📦');
  });

  it('nunca devuelve un data URL (evita el bloque de base64 en pantalla)', () => {
    assert.equal(categoryIconText(DATA_URL), '🏷️');
    assert.ok(!categoryIconText(DATA_URL).startsWith('data:'));
  });

  it('usa el marcador cuando no hay icono', () => {
    assert.equal(categoryIconText(undefined), '🏷️');
    assert.equal(categoryIconText(''), '🏷️');
  });

  it('el icono seleccionado cae al predeterminado si es imagen', () => {
    assert.equal(selectedIconOrFallback('🧵'), '🧵');
    assert.equal(selectedIconOrFallback(DATA_URL), DEFAULT_CATEGORY_ICON);
    assert.equal(selectedIconOrFallback(undefined), DEFAULT_CATEGORY_ICON);
  });
});

describe('normalización al guardar', () => {
  it('conserva un data URL sin tocarlo', () => {
    assert.equal(normalizeCategoryIcon(DATA_URL), DATA_URL);
  });

  it('recorta espacios del emoji', () => {
    assert.equal(normalizeCategoryIcon('  🧵  '), '🧵');
  });

  it('usa el predeterminado si viene vacío', () => {
    assert.equal(normalizeCategoryIcon(''), DEFAULT_CATEGORY_ICON);
    assert.equal(normalizeCategoryIcon('   '), DEFAULT_CATEGORY_ICON);
    assert.equal(normalizeCategoryIcon(undefined), DEFAULT_CATEGORY_ICON);
  });

  it('acorta un texto abusivo para no guardarlo enorme', () => {
    assert.equal(normalizeCategoryIcon('x'.repeat(500)).length, 16);
  });
});