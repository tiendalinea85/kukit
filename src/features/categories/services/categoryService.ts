import { db } from "@/lib/db";
import { enqueueOperation } from "@/lib/sync/outbox";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import {
  buildCategory,
  buildCategoryChanges,
  findDuplicateCategory,
  listActiveCategories,
  normalizeCategoryName,
  suggestCategoryStyle,
} from "../domain/categoryRules";
import type { CategoryInput } from "../domain/categoryRules";
import type { Category } from "@/types";

// ÚNICA vía de escritura del catálogo de categorías (gastos, productos, prendas
// y la pantalla /categorias). Concentra las reglas que antes vivían en la página:
// workspace activo, nombre único y marca de pendiente para el Sync Engine.

const CATEGORIES_ENTITY = "categories";

function activeWorkspaceId(): string {
  return useWorkspaceStore.getState().activeWorkspaceId ?? "default";
}

function now(): string {
  return new Date().toISOString();
}

export async function listCategories(workspaceId?: string): Promise<Category[]> {
  const rows = await db.categories.toArray();
  return listActiveCategories(rows, workspaceId ?? activeWorkspaceId());
}

export async function getCategoryByName(
  name: string,
  workspaceId?: string,
): Promise<Category | undefined> {
  return findDuplicateCategory(name, await listCategories(workspaceId));
}

export async function createCategory(data: CategoryInput): Promise<Category> {
  const workspaceId = activeWorkspaceId();
  const name = normalizeCategoryName(data.name);
  if (!name) throw new Error("El nombre de la categoría es obligatorio");

  const existing = await listCategories(workspaceId);
  if (findDuplicateCategory(name, existing)) {
    throw new Error("Ya existe una categoría con ese nombre");
  }

  // El alta inline puede llegar sin color ni icono: se propone el primer valor
  // libre de la paleta para que las categorías nuevas no se confundan entre sí.
  const suggested = suggestCategoryStyle(existing);
  const category = buildCategory({
    data: { name, color: data.color || suggested.color, icon: data.icon || suggested.icon },
    workspaceId,
    now: now(),
  });

  await db.categories.add(category);
  return category;
}

export async function updateCategory(id: string, data: CategoryInput): Promise<void> {
  const existing = await db.categories.get(id);
  if (!existing) throw new Error("Categoría no encontrada");
  if (existing.workspaceId !== activeWorkspaceId()) throw new Error("La categoría pertenece a otro workspace");

  const name = normalizeCategoryName(data.name);
  if (!name) throw new Error("El nombre de la categoría es obligatorio");
  if (findDuplicateCategory(name, await listCategories(existing.workspaceId), id)) {
    throw new Error("Ya existe una categoría con ese nombre");
  }

  // `Category` no tiene `updatedAt`: el `updated_at` y el `revision` del
  // servidor los mueve el trigger `bump_revision` al hacer el upsert.
  await db.categories.update(id, buildCategoryChanges({ name, color: data.color, icon: data.icon }));
}

export async function deleteCategory(id: string): Promise<void> {
  const existing = await db.categories.get(id);
  if (!existing) throw new Error("Categoría no encontrada");
  if (existing.workspaceId !== activeWorkspaceId()) throw new Error("La categoría pertenece a otro workspace");

  // La tabla `categories` no tiene columna `deleted` (ni el tipo local), así que
  // el borrado es físico. Se encola la operación para que el servidor borre la
  // fila: sin esto, el siguiente pull la resucitaba porque el DELETE local nunca
  // viaja en el outbox.
  await db.transaction("rw", db.categories, db.syncOutbox, async () => {
    await db.categories.delete(id);
    await enqueueOperation({
      entity: CATEGORIES_ENTITY,
      entityId: id,
      workspaceId: existing.workspaceId,
      op: "delete",
      payload: { id },
      now: now(),
    });
  });
}
