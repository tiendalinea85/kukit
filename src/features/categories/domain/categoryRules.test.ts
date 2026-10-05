import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_COLORS,
  CATEGORY_ICON_GROUPS,
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  buildCategory,
  buildCategoryChanges,
  filterCategoryIconGroups,
  findCategoryIconGroup,
  findDuplicateCategory,
  isSameCategoryName,
  listActiveCategories,
  normalizeCategoryName,
  suggestCategoryStyle,
} from "./categoryRules.ts";
import type { Category } from "../../../types/index.ts";

const WS = "ws-a";

function makeCategory(id: string, name: string, workspaceId = WS, color = "#000000", icon = "📁"): Category {
  return {
    id,
    workspaceId,
    name,
    color,
    icon,
    createdAt: "2026-08-18T10:00:00.000Z",
    syncStatus: "synced",
  };
}

describe("CATEGORY_ICON_GROUPS", () => {
  it("offers a wide catalogue grouped by domain", () => {
    assert.ok(CATEGORY_ICONS.length >= 100, `solo hay ${CATEGORY_ICONS.length} iconos`);
    assert.ok(CATEGORY_ICON_GROUPS.length >= 10);
    for (const group of CATEGORY_ICON_GROUPS) {
      assert.ok(group.label.trim().length > 0, "grupo sin etiqueta");
      assert.ok(group.keywords.trim().length > 0, `${group.label} sin palabras clave`);
      assert.ok(group.icons.length > 0, `${group.label} sin iconos`);
    }
  });

  it("never repeats an icon across groups", () => {
    const seen = new Set<string>();
    for (const icon of CATEGORY_ICONS) {
      assert.ok(!seen.has(icon), `icono repetido: ${icon}`);
      seen.add(icon);
    }
  });

  it("keeps the flat list in group order", () => {
    const flat = CATEGORY_ICON_GROUPS.flatMap((g) => [...g.icons]);
    assert.deepEqual(CATEGORY_ICONS, flat);
  });

  it("still offers the emoji used as default", () => {
    assert.ok(CATEGORY_ICONS.includes(DEFAULT_CATEGORY_ICON));
  });
});

describe("filterCategoryIconGroups", () => {
  it("returns the whole catalogue for a blank query", () => {
    assert.equal(filterCategoryIconGroups("").length, CATEGORY_ICON_GROUPS.length);
    assert.equal(filterCategoryIconGroups("   ").length, CATEGORY_ICON_GROUPS.length);
  });

  it("matches the group label without accents or case", () => {
    const found = filterCategoryIconGroups("CRIAN");
    assert.deepEqual(found.map((g) => g.label), ["Crianza"]);
  });

  it("matches the keywords that are not in the label", () => {
    assert.deepEqual(filterCategoryIconGroups("gasolina").map((g) => g.label), ["Transporte"]);
    assert.deepEqual(filterCategoryIconGroups("tela").map((g) => g.label), ["Taller de confección"]);
  });

  it("returns nothing when there is no match", () => {
    assert.equal(filterCategoryIconGroups("zzzz").length, 0);
  });
});

describe("findCategoryIconGroup", () => {
  it("locates the section of an icon", () => {
    assert.equal(findCategoryIconGroup("🧵")?.label, "Taller de confección");
    assert.equal(findCategoryIconGroup("no-existe"), undefined);
  });
});

describe("normalizeCategoryName", () => {
  it("trims and collapses inner spaces", () => {
    assert.equal(normalizeCategoryName(" 交通工具  extra "), "交通工具 extra");
  });

  it("returns an empty string for blank input", () => {
    assert.equal(normalizeCategoryName("   "), "");
  });
});

describe("isSameCategoryName", () => {
  it("ignores case and extra spaces", () => {
    assert.equal(isSameCategoryName("Alquiler", "  alquiler "), true);
  });

  it("compares without accents", () => {
    assert.equal(isSameCategoryName("Técnicas", "tecnicas"), true);
  });

  it("distinguishes names that only differ in plural or suffix", () => {
    assert.equal(isSameCategoryName("Mantenimiento", "mantenimientos"), false);
  });

  it("returns false for different names", () => {
    assert.equal(isSameCategoryName("Alquiler", "Servicios"), false);
  });

  it("never treats two blank names as the same", () => {
    assert.equal(isSameCategoryName("", "  "), false);
  });
});

describe("findDuplicateCategory", () => {
  it("finds a category with the same name in a different case", () => {
    const existing = [makeCategory("c1", "Alquiler")];
    assert.equal(findDuplicateCategory("alquiler", existing)?.id, "c1");
  });

  it("ignores the category being edited", () => {
    const existing = [makeCategory("c1", "Alquiler")];
    assert.equal(findDuplicateCategory("Alquiler", existing, "c1"), undefined);
  });

  it("returns undefined when the name is free", () => {
    const existing = [makeCategory("c1", "Alquiler")];
    assert.equal(findDuplicateCategory("Servicios", existing), undefined);
  });
});

describe("suggestCategoryStyle", () => {
  it("proposes the first free color and icon", () => {
    const style = suggestCategoryStyle([{ color: CATEGORY_COLORS[0], icon: CATEGORY_ICONS[0] }]);
    assert.equal(style.color, CATEGORY_COLORS[1]);
    assert.equal(style.icon, CATEGORY_ICONS[1]);
  });

  it("cycles through the palette when everything is taken", () => {
    const used = CATEGORY_COLORS.map((color, i) => ({ color, icon: CATEGORY_ICONS[i] }));
    const style = suggestCategoryStyle(used);
    assert.ok(CATEGORY_COLORS.includes(style.color as (typeof CATEGORY_COLORS)[number]));
    assert.ok(CATEGORY_ICONS.includes(style.icon as (typeof CATEGORY_ICONS)[number]));
  });

  it("returns the first free values when there is nothing else to reuse", () => {
    const style = suggestCategoryStyle([{ color: DEFAULT_CATEGORY_COLOR, icon: "🧵" }]);
    assert.equal(style.color, CATEGORY_COLORS[0]);
    assert.equal(style.icon, CATEGORY_ICONS[0]);
  });
});

describe("buildCategory", () => {
  it("generates a uuid, keeps the workspace and marks it pending", () => {
    const category = buildCategory({
      data: { name: "Alquiler", color: "#22c55e", icon: "🏠" },
      workspaceId: WS,
      now: "2026-08-18T10:00:00.000Z",
    });
    assert.match(category.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(category.workspaceId, WS);
    assert.equal(category.name, "Alquiler");
    assert.equal(category.color, "#22c55e");
    assert.equal(category.icon, "🏠");
    assert.equal(category.createdAt, "2026-08-18T10:00:00.000Z");
    assert.equal(category.syncStatus, "pending");
  });

  it("falls back to the default style when color or icon are missing", () => {
    const category = buildCategory({
      data: { name: "Alquiler", color: "", icon: "" },
      workspaceId: WS,
      now: "2026-08-18T10:00:00.000Z",
    });
    assert.equal(category.color, DEFAULT_CATEGORY_COLOR);
    assert.equal(category.icon, DEFAULT_CATEGORY_ICON);
  });

  it("normalizes the name", () => {
    const category = buildCategory({
      data: { name: "  Papelería  亜 ", color: "#000000", icon: "📚" },
      workspaceId: WS,
      now: "2026-08-18T10:00:00.000Z",
    });
    assert.equal(category.name, "Papelería 亜");
  });
});

describe("buildCategoryChanges", () => {
  it("keeps the values and marks the row pending", () => {
    assert.deepEqual(
      buildCategoryChanges({ name: " Alquiler ", color: "#22c55e", icon: "🏠" }),
      { name: "Alquiler", color: "#22c55e", icon: "🏠", syncStatus: "pending" },
    );
  });
});

describe("listActiveCategories", () => {
  it("returns only the categories of the given workspace", () => {
    const rows = [
      makeCategory("c1", "Alquiler", "ws-a"),
      makeCategory("c2", "Servicios", "ws-b"),
    ];
    const list = listActiveCategories(rows, "ws-a");
    assert.equal(list.length, 1);
    assert.equal(list[0].id, "c1");
  });

  it("sorts by name", () => {
    const rows = [makeCategory("c1", "Servicios"), makeCategory("c2", "Alquiler")];
    const list = listActiveCategories(rows, WS);
    assert.deepEqual(list.map((c) => c.name), ["Alquiler", "Servicios"]);
  });
});
