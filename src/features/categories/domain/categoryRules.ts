import type { Category } from "@/types";
import { normalizeText } from "@/utils/text";

// Reglas puras del catálogo de categorías (sin React ni Dexie).
//
// La categoría es dato maestro compartido por gastos, productos y prendas. El
// `id` lo genera el cliente, así que la clave real de deduplicación es el
// NOMBRE: la comparación ignora mayúsculas, acentos y espacios de sobra para que
// "Alquiler" y "alquiler " no creen dos categorías que el usuario ve iguales.

export const CATEGORY_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#78716c",
  "#a8a29e",
] as const;

export const CATEGORY_ICONS = [
  "🛒",
  "🚗",
  "💡",
  "🏥",
  "📚",
  "🛍️",
  "📊",
  "🎯",
  "👤",
  "📦",
] as const;

export const DEFAULT_CATEGORY_COLOR = "#8b5cf6";
export const DEFAULT_CATEGORY_ICON = "📦";

export interface CategoryInput {
  name: string;
  color: string;
  icon: string;
}

export interface CategoryLike {
  id: string;
  name: string;
  color?: string;
  icon?: string;
}

export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function isSameCategoryName(a: string, b: string): boolean {
  const left = normalizeText(normalizeCategoryName(a));
  const right = normalizeText(normalizeCategoryName(b));
  return left.length > 0 && left === right;
}

export function findDuplicateCategory<T extends CategoryLike>(
  name: string,
  existing: readonly T[],
  ignoreId?: string,
): T | undefined {
  return existing.find((c) => c.id !== ignoreId && isSameCategoryName(c.name, name));
}

/** Primer color e icono libres de la paleta; si ya están todos, cicla. */
export function suggestCategoryStyle(
  existing: readonly { color?: string; icon?: string }[],
): { color: string; icon: string } {
  const usedColors = new Set(existing.map((c) => c.color));
  const usedIcons = new Set(existing.map((c) => c.icon));
  return {
    color:
      CATEGORY_COLORS.find((c) => !usedColors.has(c)) ??
      CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length],
    icon:
      CATEGORY_ICONS.find((i) => !usedIcons.has(i)) ??
      CATEGORY_ICONS[existing.length % CATEGORY_ICONS.length],
  };
}

export function buildCategory(input: {
  data: CategoryInput;
  workspaceId: string;
  now: string;
}): Category {
  const { data, workspaceId, now } = input;
  return {
    id: crypto.randomUUID(),
    workspaceId,
    name: normalizeCategoryName(data.name),
    color: data.color || DEFAULT_CATEGORY_COLOR,
    icon: data.icon || DEFAULT_CATEGORY_ICON,
    createdAt: now,
    syncStatus: "pending",
  };
}

export function buildCategoryChanges(
  data: CategoryInput,
): Pick<Category, "name" | "color" | "icon" | "syncStatus"> {
  return {
    name: normalizeCategoryName(data.name),
    color: data.color || DEFAULT_CATEGORY_COLOR,
    icon: data.icon || DEFAULT_CATEGORY_ICON,
    syncStatus: "pending",
  };
}

/** Listado del workspace activo, ordenado por nombre. */
export function listActiveCategories(
  rows: readonly Category[],
  workspaceId: string,
): Category[] {
  return rows
    .filter((c) => c.workspaceId === workspaceId)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
