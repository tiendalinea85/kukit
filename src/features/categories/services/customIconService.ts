import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import {
  CUSTOM_ICON_MAX_SOURCE_BYTES,
  CUSTOM_ICON_SIZE_PX,
  buildCustomIcon,
  dedupeIconNames,
  iconNameFromFileName,
  isValidIconDataUrl,
  MAX_ICONS_PER_IMPORT,
  parseIconSetManifest,
} from "../domain/customIconRules";
import type { CustomIconInput } from "../domain/customIconRules";
import type { CustomIcon } from "@/types";

// Iconos propios del workspace activo. Se redimensionan en el cliente antes de
// tocar la base: un PNG de 128px pesa 3-8 KB en base64, así que la fila es
// ligera y entra de sobra en la columna TEXT de `custom_icons`.
//
// Las escrituras solo marcan `syncStatus: "pending"`; el outbox se encarga
// `reconcilePendingEntities`, igual que en los módulos especializados.

function activeWorkspaceId(): string {
  return useWorkspaceStore.getState().activeWorkspaceId ?? "default";
}

function now(): string {
  return new Date().toISOString();
}

export async function listCustomIcons(workspaceId?: string): Promise<CustomIcon[]> {
  const rows = await db.customIcons.toArray();
  return rows
    .filter((icon) => !icon.deleted && icon.workspaceId === (workspaceId ?? activeWorkspaceId()))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/**
 * Convierte un archivo de imagen en un PNG de `CUSTOM_ICON_SIZE_PX` y lo
 * devuelve como data URL. El canvas recorta a cuadrado centrado para que un
 * logo rectangular no quede estirado.
 */
export async function fileToIconDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} no es una imagen`);
  }
  if (file.size > CUSTOM_ICON_MAX_SOURCE_BYTES) {
    throw new Error(`${file.name} supera los 5 MB`);
  }

  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sourceX = (bitmap.width - side) / 2;
  const sourceY = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = CUSTOM_ICON_SIZE_PX;
  canvas.height = CUSTOM_ICON_SIZE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el icono");
  ctx.drawImage(
    bitmap,
    sourceX, sourceY, side, side,
    0, 0, CUSTOM_ICON_SIZE_PX, CUSTOM_ICON_SIZE_PX,
  );
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/png");
  if (!isValidIconDataUrl(dataUrl)) {
    throw new Error(`${file.name} es demasiado pesado tras convertirlo`);
  }
  return dataUrl;
}

export async function createCustomIcon(input: CustomIconInput): Promise<CustomIcon> {
  const icon = buildCustomIcon({
    data: input,
    workspaceId: activeWorkspaceId(),
    now: now(),
  });
  await db.customIcons.add(icon);
  return icon;
}

/**
 * Importa un set: un manifiesto JSON, o varios archivos de imagen sueltos.
 * Devuelve cuántos entraron y cuántos se Saltaron por inválidos o repetidos,
 * para poder avisar en vez de fallar el import entero.
 */
export async function importCustomIcons(files: readonly File[]): Promise<{
  imported: number;
  skipped: number;
}> {
  if (files.length === 0) return { imported: 0, skipped: 0 };

  const [first] = files;
  const isManifest =
    files.length === 1 && (first.name.endsWith(".json") || first.type === "application/json");

  let candidates: CustomIconInput[] = [];
  let skipped = 0;

  if (isManifest) {
    const parsed = parseIconSetManifest(await first.text());
    candidates = parsed.icons;
    skipped = parsed.skipped;
  } else {
    for (const file of files) {
      try {
        candidates.push({
          name: iconNameFromFileName(file.name),
          dataUrl: await fileToIconDataUrl(file),
        });
      } catch (error) {
        console.warn("Icono omitido:", error);
        skipped += 1;
      }
    }
    if (files.length > MAX_ICONS_PER_IMPORT) {
      skipped += files.length - MAX_ICONS_PER_IMPORT;
    }
  }

  const unique = dedupeIconNames(candidates).slice(0, MAX_ICONS_PER_IMPORT);
  skipped += candidates.length - unique.length;

  const existing = new Set(
    (await listCustomIcons()).map((icon) => icon.name.toLowerCase()),
  );
  const fresh = unique.filter((icon) => !existing.has(icon.name.toLowerCase()));
  skipped += unique.length - fresh.length;

  if (fresh.length === 0) return { imported: 0, skipped };

  const stamp = now();
  const rows = fresh.map((data) =>
    buildCustomIcon({ data, workspaceId: activeWorkspaceId(), now: stamp }),
  );
  // bulkAdd dentro de una transacción: o entra el set entero o no entra nada.
  await db.transaction("rw", db.customIcons, async () => {
    await db.customIcons.bulkAdd(rows);
  });
  return { imported: rows.length, skipped };
}

/** Soft delete: el tombstone tiene que viajar al servidor o el set resucita. */
export async function deleteCustomIcon(id: string): Promise<void> {
  const existing = await db.customIcons.get(id);
  if (!existing) throw new Error("Icono no encontrado");
  if (existing.workspaceId !== activeWorkspaceId()) {
    throw new Error("El icono pertenece a otro workspace");
  }
  await db.customIcons.update(id, {
    deleted: true,
    updatedAt: now(),
    syncStatus: "pending",
  });
}