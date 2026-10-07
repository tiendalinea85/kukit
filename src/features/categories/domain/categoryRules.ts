import { newId } from "@/utils/id";
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

export interface CategoryIconGroup {
  label: string;
  /** Términos de búsqueda que no aparecen en `label` (sin acentos, minúsculas). */
  keywords: string;
  icons: readonly string[];
}

// Catálogo agrupado por dominio: en una lista plana de ~180 iconos no se
// encuentra nada, así que el selector los muestra por secciones con buscador.
export const CATEGORY_ICON_GROUPS: readonly CategoryIconGroup[] = [
  {
    label: "Generales",
    keywords: "documento archivo carpeta papel registro",
    icons: ["📁", "📦", "📋", "📄", "🗂️", "🗃️", "📌", "📎", "🏷️", "🔖", "🧾", "🗓️"],
  },
  {
    label: "Dinero y bancos",
    keywords: "efectivo billete tarjeta credito banco cajero cambio contabilidad",
    icons: ["💰", "💵", "💳", "🏦", "💱", "🧮", "📊", "📈", "💹", "🪙", "🏧", "💸"],
  },
  {
    label: "Hogar y servicios",
    keywords: "casa vivienda alquiler luz agua internet limpieza mantenimiento",
    icons: ["🏠", "🏢", "🏘️", "🛋️", "🛏️", "🚿", "🧺", "💡", "🔌", "🔑", "🧹", "🪑"],
  },
  {
    label: "Transporte",
    keywords: "carro moto gasolina gasolina vehiculo viaje transporte parqueadero",
    icons: ["🚗", "🚕", "🚌", "🚚", "🛵", "🏍️", "🚲", "🛴", "⛽", "🅿️", "🛞", "🗺️"],
  },
  {
    label: "Comercio y ventas",
    keywords: "tienda compra venta cliente proveedor negocio comercio",
    icons: ["🛒", "🛍️", "🏪", "🏬", "💼", "🤝", "📤", "📥", "🪧", "✉️", "🛎️", "💴"],
  },
  {
    label: "Alimentación",
    keywords: "comida comida mercado restaura pan carne fruta verdura cafeteria",
    icons: ["🍎", "🍞", "🥩", "🥦", "🧀", "☕", "🍽️", "🍔", "🧂", "🫙", "🥛", "🍰"],
  },
  {
    label: "Salud",
    keywords: "salud medico farmacia hospital dental examen lenses",
    icons: ["🏥", "💊", "🩺", "🦷", "👓", "🧪", "💉", "🩹", "🧴", "🚑", "🛡️", "🧘"],
  },
  {
    label: "Educación",
    keywords: "estudio educacion formacion capacitacion cursos libros",
    icons: ["📚", "📖", "✏️", "🎓", "🎨", "🎵", "🔬", "📐", "🗣️", "🧠", "🎲", "🧩"],
  },
  {
    label: "Taller de confección",
    keywords: "taller costura ropa prenda tela corte moda bordado",
    icons: ["🧵", "🧶", "🧷", "✂️", "🪡", "👗", "👖", "🧥", "👔", "👢", "🧦", "🧱"],
  },
  {
    label: "Agricultura",
    keywords: "agricultura campo cultivo finca cosecha plantacion riego",
    icons: ["🌱", "🌽", "🌿", "🌻", "🌾", "🚜", "🪴", "🌰", "🧑‍🌾", "🏕️", "💧", "☀️"],
  },
  {
    label: "Repuestos y taller mecánico",
    keywords: "repuesto autoparts mecanico motor taller herramienta pieza",
    icons: ["🔧", "🔩", "⚙️", "🛠️", "🧰", "🛢️", "🔋", "🧊", "🪛", "🔗", "🧲", "🏎️"],
  },
  {
    label: "Crianza",
    keywords: "crianza animal ganado vaca gallina cerdos aves pesca",
    icons: ["🐄", "🐖", "🐑", "🐐", "🐔", "🥚", "🐟", "🐝", "🦜", "🐢", "🪣", "🕊️"],
  },
  {
    label: "Trabajo y personal",
    keywords: "personal empleados sueldos nomina capacitacion oficina",
    icons: ["👤", "👥", "🧑‍💼", "⏱️", "📅", "📃", "🗝️", "📨", "🖇️", "🥼", "🧤", "🧑‍🏫"],
  },
  {
    label: "Tecnología",
    keywords: "tecnologia software internet computador telefono equipos",
    icons: ["🖥️", "💻", "📱", "⌨️", "🖨️", "🖱️", "💾", "📡", "⚡", "🔭", "🎥", "📷"],
  },
  {
    label: "Otros",
    keywords: "otros varios pendiente pendiente reservado nuevo eliminado",
    icons: ["⭐", "🏆", "🎁", "🎯", "🔥", "⚠️", "❓", "🗑️", "♻️", "🔄", "🆕", "✅"],
  },
];

/** Todos los iconos del catálogo, en orden y sin repetidos. */
export const CATEGORY_ICONS: readonly string[] = [
  ...new Set(CATEGORY_ICON_GROUPS.flatMap((g) => g.icons)),
];

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

/**
 * Grupos de iconos que casan con la búsqueda. Un query vacío devuelve el
 * catálogo completo. Solo se busca por el nombre del grupo y sus sinónimos:
 * los emoji no tienen nombre legible y mantener uno por icono sería una tabla
 * inmanejable.
 */
export function filterCategoryIconGroups(query: string): readonly CategoryIconGroup[] {
  const q = normalizeText(query.trim());
  if (!q) return CATEGORY_ICON_GROUPS;
  return CATEGORY_ICON_GROUPS.filter((g) =>
    normalizeText(`${g.label} ${g.keywords}`).includes(q),
  );
}

/** Sección a la que pertenece un icono, para resaltar dónde está. */
export function findCategoryIconGroup(icon: string): CategoryIconGroup | undefined {
  return CATEGORY_ICON_GROUPS.find((g) => g.icons.includes(icon));
}

export function buildCategory(input: {
  data: CategoryInput;
  workspaceId: string;
  now: string;
}): Category {
  const { data, workspaceId, now } = input;
  return {
    id: newId(),
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
