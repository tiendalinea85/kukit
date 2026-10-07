// Reglas puras del icono de categoría (sin React ni SQLite).
//
// `Category.icon` es un emoji corto ("🧵") o, si el usuario sube una imagen
// desde la PWA, un data URL PNG ("data:image/png;base64,..."). El móvil no
// sube imágenes (esa pantalla es de la PWA), pero SÍ recibe esos data URL por
// sync, así que nunca deben pintarse como texto: un data URL son cientos de KB
// de base64 que reventan la fila y el TextInput del formulario.
//
// El catálogo es copia de src/features/categories/domain/categoryRules.ts. Los
// dos proyectos son paquetes separados con tsconfig propio, no hay forma de
// compartirlo sin montar un paquete común; si se añade un icono en la PWA hay
// que añadirlo también aquí (categoryIcons.test.ts no puede cruzarlos).

export interface CategoryIconGroup {
  label: string;
  /** Términos de búsqueda que no aparecen en `label`. */
  keywords: string;
  icons: readonly string[];
}

export const CATEGORY_ICON_GROUPS: readonly CategoryIconGroup[] = [
  {
    label: 'Generales',
    keywords: 'documento archivo carpeta papel registro',
    icons: ['📁', '📦', '📋', '📄', '🗂️', '🗃️', '📌', '📎', '🏷️', '🔖', '🧾', '🗓️'],
  },
  {
    label: 'Dinero y bancos',
    keywords: 'efectivo billete tarjeta credito banco cajero cambio contabilidad',
    icons: ['💰', '💵', '💳', '🏦', '💱', '🧮', '📊', '📈', '💹', '🪙', '🏧', '💸'],
  },
  {
    label: 'Hogar y servicios',
    keywords: 'casa vivienda alquiler luz agua internet limpieza mantenimiento',
    icons: ['🏠', '🏢', '🏘️', '🛋️', '🛏️', '🚿', '🧺', '💡', '🔌', '🔑', '🧹', '🪑'],
  },
  {
    label: 'Transporte',
    keywords: 'carro moto gasolina vehiculo viaje transporte parqueadero',
    icons: ['🚗', '🚕', '🚌', '🚚', '🛵', '🏍️', '🚲', '🛴', '⛽', '🅿️', '🛞', '🗺️'],
  },
  {
    label: 'Comercio y ventas',
    keywords: 'tienda compra venta cliente proveedor negocio comercio',
    icons: ['🛒', '🛍️', '🏪', '🏬', '💼', '🤝', '📤', '📥', '🪧', '✉️', '🛎️', '💴'],
  },
  {
    label: 'Alimentación',
    keywords: 'comida mercado restaura pan carne fruta verdura cafeteria',
    icons: ['🍎', '🍞', '🥩', '🥦', '🧀', '☕', '🍽️', '🍔', '🧂', '🫙', '🥛', '🍰'],
  },
  {
    label: 'Salud',
    keywords: 'salud medico farmacia hospital dental examen',
    icons: ['🏥', '💊', '🩺', '🦷', '👓', '🧪', '💉', '🩹', '🧴', '🚑', '🛡️', '🧘'],
  },
  {
    label: 'Educación',
    keywords: 'estudio educacion formacion capacitacion cursos libros',
    icons: ['📚', '📖', '✏️', '🎓', '🎨', '🎵', '🔬', '📐', '🗣️', '🧠', '🎲', '🧩'],
  },
  {
    label: 'Taller de confección',
    keywords: 'taller costura ropa prenda tela corte moda bordado',
    icons: ['🧵', '🧶', '🧷', '✂️', '🪡', '👗', '👖', '🧥', '👔', '👢', '🧦', '🧱'],
  },
  {
    label: 'Agricultura',
    keywords: 'agricultura campo cultivo finca cosecha plantacion riego',
    icons: ['🌱', '🌽', '🌿', '🌻', '🌾', '🚜', '🪴', '🌰', '🧑‍🌾', '🏕️', '💧', '☀️'],
  },
  {
    label: 'Repuestos y taller mecánico',
    keywords: 'repuesto autoparts mecanico motor taller herramienta pieza',
    icons: ['🔧', '🔩', '⚙️', '🛠️', '🧰', '🛢️', '🔋', '🧊', '🪛', '🔗', '🧲', '🏎️'],
  },
  {
    label: 'Crianza',
    keywords: 'crianza animal ganado vaca gallina cerdos aves pesca',
    icons: ['🐄', '🐖', '🐑', '🐐', '🐔', '🥚', '🐟', '🐝', '🦜', '🐢', '🪣', '🕊️'],
  },
  {
    label: 'Trabajo y personal',
    keywords: 'personal empleados sueldos nomina capacitacion oficina',
    icons: ['👤', '👥', '🧑‍💼', '⏱️', '📅', '📃', '🗝️', '📨', '🖇️', '🥼', '🧤', '🧑‍🏫'],
  },
  {
    label: 'Tecnología',
    keywords: 'tecnologia software internet computador telefono equipos',
    icons: ['🖥️', '💻', '📱', '⌨️', '🖨️', '🖱️', '💾', '📡', '⚡', '🔭', '🎥', '📷'],
  },
  {
    label: 'Otros',
    keywords: 'otros varios pendiente reservado nuevo eliminado',
    icons: ['⭐', '🏆', '🎁', '🎯', '🔥', '⚠️', '❓', '🗑️', '♻️', '🔄', '🆕', '✅'],
  },
];

/** Todos los iconos del catálogo, en orden y sin repetidos. */
export const CATEGORY_ICONS: readonly string[] = [
  ...new Set(CATEGORY_ICON_GROUPS.flatMap((g) => g.icons)),
];

export const DEFAULT_CATEGORY_ICON = '📦';

/** Se usa cuando el icono es una imagen: el texto alternativo del <Image>. */
export const CATEGORY_ICON_IMAGE_FALLBACK = '🏷️';

// Más largo que esto y no es un emoji: es un data URL (o basura).
const MAX_TEXT_ICON_CHARS = 16;

export function isDataUrlIcon(icon: string | undefined): boolean {
  return typeof icon === 'string' && icon.startsWith('data:image/');
}

/** ¿El icono es un emoji/símbolo corto que cabe como texto? */
export function isTextIcon(icon: string | undefined): boolean {
  return Boolean(icon) && (icon as string).length <= MAX_TEXT_ICON_CHARS && !isDataUrlIcon(icon);
}

/**
 * Texto a mostrar junto al título. Nunca devuelve el data URL: quien llama
 * decide con `isDataUrlIcon` si pinta <Image> o texto.
 */
export function categoryIconText(icon: string | undefined): string {
  return isTextIcon(icon) ? (icon as string) : CATEGORY_ICON_IMAGE_FALLBACK;
}

/** Icono "actual" del selector: el emoji, o un marcador si es imagen. */
export function selectedIconOrFallback(icon: string | undefined): string {
  return isTextIcon(icon) ? (icon as string) : DEFAULT_CATEGORY_ICON;
}

/**
 * Deja el icono listo para guardar. Un data URL se conserva tal cual (lo puso
 * la PWA); cualquier otra cosa se recorta y, si queda vacío, se usa el
 * predeterminado.
 */
export function normalizeCategoryIcon(icon: string | undefined): string {
  if (isDataUrlIcon(icon)) return icon as string;
  const trimmed = (icon ?? '').trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_TEXT_ICON_CHARS) : DEFAULT_CATEGORY_ICON;
}

/** Busca por etiqueta, palabras clave o por el propio emoji. */
export function filterCategoryIconGroups(query: string): readonly CategoryIconGroup[] {
  const q = normalizeForSearch(query);
  if (!q) return CATEGORY_ICON_GROUPS;
  return CATEGORY_ICON_GROUPS.filter(
    (g) =>
      normalizeForSearch(g.label).includes(q) ||
      g.keywords.includes(q) ||
      g.icons.some((i) => i.includes(query.trim())),
  );
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}