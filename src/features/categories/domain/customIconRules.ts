import { newId } from "@/utils/id";
import type { CustomIcon } from "@/types";

// Reglas puras de los iconos propios (sin React ni Dexie).
//
// Un icono de categoría es un emoji corto ("🧵") o, si el usuario sube una
// imagen o importa un set, un data URL PNG ("data:image/png;base64,..."). Se
// guarda DENTRO de `categories.icon` y no como referencia a otra tabla porque
// los sitios que pintan el icono son <select> y spans de texto, donde una
// referencia obligaría a resolver ids en todas las pantallas.
//
// `custom_icons` existe aparte solo para el set reutilizable: el usuario lo
// importa una vez y puede aplicarlo a varias categorías.

export const CUSTOM_ICON_SIZE_PX = 128;
export const CUSTOM_ICON_MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export const CUSTOM_ICON_MAX_DATA_URL_CHARS = 220_000;
export const CUSTOM_ICON_MAX_NAME_LENGTH = 60;
export const MAX_ICONS_PER_IMPORT = 100;
export const CUSTOM_ICON_FALLBACK = "🖼️";
export const CUSTOM_ICON_MIME = "image/png";
export const CUSTOM_ICON_DATA_URL_PREFIX = `data:${CUSTOM_ICON_MIME};base64,`;

export interface CustomIconInput {
  name: string;
  dataUrl: string;
}

export function isDataUrlIcon(icon: string): boolean {
  return icon.startsWith("data:image/");
}

// Un data URL es larguísimo; cualquier otra cosa es un emoji o un símbolo suelto.
const MAX_TEXT_ICON_CHARS = 16;

/** Un icono "de texto" es corto y no es un data URL. */
export function isTextIcon(icon: string): boolean {
  return Boolean(icon) && icon.length <= MAX_TEXT_ICON_CHARS && !isDataUrlIcon(icon);
}

/** Texto a mostrar dentro de <option> y de spans: el emoji o el sustituto. */
export function iconText(icon: string | undefined): string {
  if (!icon) return CUSTOM_ICON_FALLBACK;
  return isTextIcon(icon) ? icon : CUSTOM_ICON_FALLBACK;
}

export function normalizeCustomIconName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, CUSTOM_ICON_MAX_NAME_LENGTH);
}

/** Nombre por defecto a partir del nombre de archivo: "logo mi marca.png" → "logo mi marca". */
export function iconNameFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return normalizeCustomIconName(withoutExtension) || "icono";
}

export function isValidIconDataUrl(dataUrl: string): boolean {
  return (
    isDataUrlIcon(dataUrl) &&
    dataUrl.length <= CUSTOM_ICON_MAX_DATA_URL_CHARS &&
    dataUrl.startsWith(CUSTOM_ICON_DATA_URL_PREFIX)
  );
}

export function buildCustomIcon(input: {
  data: CustomIconInput;
  workspaceId: string;
  now: string;
}): CustomIcon {
  const name = normalizeCustomIconName(input.data.name);
  if (!name) throw new Error("El nombre del icono es obligatorio");
  if (!isValidIconDataUrl(input.data.dataUrl)) {
    throw new Error("El icono debe ser una imagen PNG convertida a data URL");
  }
  return {
    id: newId(),
    workspaceId: input.workspaceId,
    name,
    dataUrl: input.data.dataUrl,
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
  };
}

/**
 * Normaliza un manifiesto JSON de iconos. Acepta tanto el array suelto como el
 * envoltorio `{ "icons": [...] }` que exportan algunos editores, y descarta
 * (en vez de romper) las entradas con data URL inválida: un set de 80 iconos
 * con uno corrupto debe importar los 79 válidos.
 */
export function parseIconSetManifest(raw: string): { icons: CustomIconInput[]; skipped: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("El archivo de iconos no es un JSON válido");
  }

  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { icons?: unknown } | null)?.icons;
  if (!Array.isArray(list)) {
    throw new Error("El archivo debe contener una lista de iconos");
  }

  const icons: CustomIconInput[] = [];
  let skipped = 0;
  for (const entry of list) {
    const dataUrl =
      typeof entry === "string"
        ? entry
        : typeof (entry as CustomIconInput | null)?.dataUrl === "string"
          ? (entry as CustomIconInput).dataUrl
          : "";
    const name =
      typeof (entry as CustomIconInput | null)?.name === "string"
        ? (entry as CustomIconInput).name
        : "";
    if (!isValidIconDataUrl(dataUrl)) {
      skipped += 1;
      continue;
    }
    icons.push({ name: normalizeCustomIconName(name) || "icono", dataUrl });
  }

  return { icons: icons.slice(0, MAX_ICONS_PER_IMPORT), skipped };
}

/** Nombres repetidos dentro del mismo set: el segundo se descarta. */
export function dedupeIconNames(icons: readonly CustomIconInput[]): CustomIconInput[] {
  const seen = new Set<string>();
  const unique: CustomIconInput[] = [];
  for (const icon of icons) {
    const key = icon.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(icon);
  }
  return unique;
}