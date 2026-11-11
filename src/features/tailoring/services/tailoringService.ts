import { db } from "@/lib/db";
import {
  generateGarmentCode,
  generateMaterialCode,
  generateProductionCode,
} from "@/utils/code";
import {
  buildGarment,
  buildSize,
  buildColor,
  buildMaterial,
  buildProductionOrder,
  buildProductionMaterial,
  canEditGarment,
  canVoidProduction,
  canStartProduction,
  canCompleteProduction,
  computeProductionTotal,
  computeMaterialTotal,
  type ProductionMaterialInput,
} from "../domain/tailoringRules";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { Garment, Size, Color, Material, ProductionOrder, ProductionMaterial } from "@/types/modules";
import type { GarmentFormData, SizeFormData, ColorFormData, MaterialFormData, ProductionOrderFormData } from "../schemas/tailoringSchema";

function getWorkspaceId(): string {
  const id = useWorkspaceStore.getState().activeWorkspaceId;
  if (!id) throw new Error("No hay workspace activo");
  return id;
}

// Validación de pertenencia al workspace activo para evitar acceso entre espacios.

async function getActiveGarment(id: string): Promise<Garment> {
  const row = await db.garments.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Prenda no encontrada");
  }
  return row;
}

async function getActiveSize(id: string): Promise<Size> {
  const row = await db.sizes.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Talla no encontrada");
  }
  return row;
}

async function getActiveColor(id: string): Promise<Color> {
  const row = await db.garmentColors.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Color no encontrado");
  }
  return row;
}

async function getActiveMaterial(id: string): Promise<Material> {
  const row = await db.materials.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Material no encontrado");
  }
  return row;
}

async function getActiveProductionOrder(id: string): Promise<ProductionOrder> {
  const row = await db.productionOrders.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Orden de producción no encontrada");
  }
  return row;
}

async function getActiveProductionMaterial(id: string): Promise<ProductionMaterial> {
  const row = await db.productionMaterials.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Material de orden no encontrado");
  }
  return row;
}

export async function createGarment(data: GarmentFormData, code?: string): Promise<Garment> {
  const finalCode = code || (await generateGarmentCode());
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  const garment = buildGarment({ data, code: finalCode, now });
  garment.workspaceId = workspaceId;
  await db.garments.add(garment);
  return garment;
}

export async function updateGarment(id: string, data: GarmentFormData): Promise<void> {
  const existing = await getActiveGarment(id);
  if (!canEditGarment(existing)) throw new Error("No se puede editar esta prenda");

  await db.garments.update(id, {
    name: data.name.trim(),
    description: (data.description || "").trim(),
    categoryId: data.categoryId,
    salePrice: data.salePrice,
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteGarment(id: string): Promise<void> {
  await getActiveGarment(id);
  await db.garments.update(id, {
    deleted: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function voidGarment(id: string): Promise<void> {
  await getActiveGarment(id);
  await db.garments.update(id, {
    deleted: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function createSize(data: SizeFormData): Promise<Size> {
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  const size = buildSize({ data, now });
  size.workspaceId = workspaceId;
  await db.sizes.add(size);
  return size;
}

export async function updateSize(id: string, data: SizeFormData): Promise<void> {
  await getActiveSize(id);

  await db.sizes.update(id, {
    name: data.name.trim(),
    sortOrder: data.sortOrder,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteSize(id: string): Promise<void> {
  await getActiveSize(id);
  await db.sizes.update(id, {
    deleted: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function createColor(data: ColorFormData): Promise<Color> {
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  const color = buildColor({ data, now });
  color.workspaceId = workspaceId;
  await db.garmentColors.add(color);
  return color;
}

export async function updateColor(id: string, data: ColorFormData): Promise<void> {
  await getActiveColor(id);

  await db.garmentColors.update(id, {
    name: data.name.trim(),
    hex: data.hex,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteColor(id: string): Promise<void> {
  await getActiveColor(id);
  await db.garmentColors.update(id, {
    deleted: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function createMaterial(data: MaterialFormData, code?: string): Promise<Material> {
  const finalCode = code || (await generateMaterialCode());
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  const material = buildMaterial({ data, code: finalCode, now });
  material.workspaceId = workspaceId;
  await db.materials.add(material);
  return material;
}

export async function updateMaterial(id: string, data: MaterialFormData): Promise<void> {
  await getActiveMaterial(id);

  await db.materials.update(id, {
    name: data.name.trim(),
    unit: data.unit,
    costPerUnit: data.costPerUnit,
    stock: data.stock,
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteMaterial(id: string): Promise<void> {
  await getActiveMaterial(id);
  await db.materials.update(id, {
    deleted: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function createProductionOrder(
  data: ProductionOrderFormData,
  garmentName: string,
  sizeName: string,
  colorName: string,
  code?: string
): Promise<ProductionOrder> {
  const finalCode = code || (await generateProductionCode());
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  const totalCost = Math.round(data.quantity * data.unitCost * 100) / 100;
  const orderData = {
    ...data,
    garmentName,
    sizeName,
    colorName,
    totalCost,
  };
  const order = buildProductionOrder({ data: orderData, code: finalCode, now });
  order.workspaceId = workspaceId;
  await db.productionOrders.add(order);
  return order;
}

export async function updateProductionOrder(
  id: string,
  data: ProductionOrderFormData,
  materials: ProductionMaterialInput[] = []
): Promise<void> {
  const existing = await getActiveProductionOrder(id);
  if (!canVoidProduction(existing)) throw new Error("No se puede editar esta orden");

  const workspaceId = getWorkspaceId();
  const totalCost = computeProductionTotal(data.quantity, data.unitCost);
  const now = new Date().toISOString();

  // El snapshot de nombres se recalcula desde los ids: antes se editaba la
  // orden pero la tarjeta seguía mostrando la prenda/talla/color antiguos.
  const [garment, size, color] = await Promise.all([
    db.garments.get(data.garmentId),
    db.sizes.get(data.sizeId),
    db.garmentColors.get(data.colorId),
  ]);
  const garmentName = garment?.workspaceId === workspaceId ? garment.name : existing.garmentName;
  const sizeName = size?.workspaceId === workspaceId ? size.name : existing.sizeName;
  const colorName = color?.workspaceId === workspaceId ? color.name : existing.colorName;

  await db.transaction("rw", db.productionOrders, db.productionMaterials, async () => {
    await db.productionOrders.update(id, {
      garmentId: data.garmentId,
      garmentName,
      sizeId: data.sizeId,
      sizeName,
      colorId: data.colorId,
      colorName,
      quantity: data.quantity,
      unitCost: data.unitCost,
      totalCost,
      startDate: data.startDate,
      dueDate: data.dueDate,
      notes: data.notes || "",
      updatedAt: now,
      syncStatus: "pending" as const,
    });

    // Reemplazo de líneas por diff: las que ya existían se actualizan, las
    // nuevas se insertan con el id generado por el formulario y las quitadas se
    // marcan `deleted` (soft delete) en vez de borrarse físicamente.
    const existingMaterials = await db.productionMaterials
      .where("productionOrderId")
      .equals(id)
      .toArray();
    const existingById = new Map(existingMaterials.map((m) => [m.id, m]));
    const keptIds = new Set<string>();

    for (const row of materials) {
      if (!row.materialId) continue;
      const prev = existingById.get(row.id);
      if (prev) {
        keptIds.add(row.id);
        await db.productionMaterials.update(row.id, {
          materialId: row.materialId,
          materialName: row.materialName,
          quantity: row.quantity,
          unitCost: row.unitCost,
          totalCost: row.totalCost,
          deleted: false,
          updatedAt: now,
          syncStatus: "pending" as const,
        });
      } else {
        const pm = buildProductionMaterial({
          id: row.id,
          data: {
            productionOrderId: id,
            materialId: row.materialId,
            materialName: row.materialName,
            quantity: row.quantity,
            unitCost: row.unitCost,
            totalCost: row.totalCost,
          },
          now,
        });
        pm.workspaceId = workspaceId;
        await db.productionMaterials.add(pm);
      }
    }

    for (const mat of existingMaterials) {
      if (!keptIds.has(mat.id) && !mat.deleted) {
        await db.productionMaterials.update(mat.id, {
          deleted: true,
          updatedAt: now,
          syncStatus: "pending" as const,
        });
      }
    }
  });
}

export async function deleteProductionOrder(id: string): Promise<void> {
  await getActiveProductionOrder(id);
  const now = new Date().toISOString();

  // Soft delete en cascada: la orden y sus materiales se marcan `deleted` para
  // que el tombstone viaje al servidor. El borrado físico local haría resucitar
  // las líneas en otros dispositivos (invariante 2).
  await db.transaction("rw", db.productionOrders, db.productionMaterials, async () => {
    const materials = await db.productionMaterials
      .where("productionOrderId")
      .equals(id)
      .toArray();
    for (const mat of materials) {
      if (mat.deleted) continue;
      await db.productionMaterials.update(mat.id, {
        deleted: true,
        updatedAt: now,
        syncStatus: "pending" as const,
      });
    }

    await db.productionOrders.update(id, {
      deleted: true,
      updatedAt: now,
      syncStatus: "pending" as const,
    });
  });
}

export async function voidProductionOrder(id: string): Promise<void> {
  const existing = await getActiveProductionOrder(id);
  if (existing.status === "anulada") throw new Error("La orden ya está anulada");

  await db.productionOrders.update(id, {
    status: "anulada" as const,
    voidedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

/** pendiente → en_proceso. */
export async function startProductionOrder(id: string): Promise<void> {
  const existing = await getActiveProductionOrder(id);
  if (!canStartProduction(existing)) throw new Error("La orden no se puede iniciar");

  await db.productionOrders.update(id, {
    status: "en_proceso" as const,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

/** en_proceso → completada (fija completedAt). */
export async function completeProductionOrder(id: string): Promise<void> {
  const existing = await getActiveProductionOrder(id);
  if (!canCompleteProduction(existing)) throw new Error("La orden no se puede completar");

  const now = new Date().toISOString();
  await db.productionOrders.update(id, {
    status: "completada" as const,
    completedAt: now,
    updatedAt: now,
    syncStatus: "pending" as const,
  });
}

export async function addProductionMaterial(data: {
  productionOrderId: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unitCost: number;
}): Promise<ProductionMaterial> {
  // Validar que la orden de producción pertenece al workspace activo.
  await getActiveProductionOrder(data.productionOrderId);
  // Validar que el material pertenece al workspace activo.
  await getActiveMaterial(data.materialId);

  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  const totalCost = computeMaterialTotal(data.quantity, data.unitCost);
  const pm = buildProductionMaterial({
    data: { ...data, totalCost },
    now,
  });
  pm.workspaceId = workspaceId;
  await db.productionMaterials.add(pm);
  return pm;
}

export async function removeProductionMaterial(id: string): Promise<void> {
  await getActiveProductionMaterial(id);
  await db.productionMaterials.update(id, {
    deleted: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}
