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
} from "../domain/tailoringRules";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { Garment, Size, Color, Material, ProductionOrder, ProductionMaterial } from "@/types/modules";
import type { GarmentFormData, SizeFormData, ColorFormData, MaterialFormData, ProductionOrderFormData } from "../schemas/tailoringSchema";

function getWorkspaceId(): string {
  const id = useWorkspaceStore.getState().activeWorkspaceId;
  if (!id) throw new Error("No hay workspace activo");
  return id;
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
  const existing = await db.garments.get(id);
  if (!existing) throw new Error("Prenda no encontrada");
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
  await db.garments.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function voidGarment(id: string): Promise<void> {
  await db.garments.update(id, {
    deleted: true,
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
  const existing = await db.sizes.get(id);
  if (!existing) throw new Error("Talla no encontrada");

  await db.sizes.update(id, {
    name: data.name.trim(),
    sortOrder: data.sortOrder,
    syncStatus: "pending" as const,
  });
}

export async function deleteSize(id: string): Promise<void> {
  await db.sizes.update(id, {
    deleted: true,
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
  const existing = await db.garmentColors.get(id);
  if (!existing) throw new Error("Color no encontrado");

  await db.garmentColors.update(id, {
    name: data.name.trim(),
    hex: data.hex,
    syncStatus: "pending" as const,
  });
}

export async function deleteColor(id: string): Promise<void> {
  await db.garmentColors.update(id, {
    deleted: true,
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
  const existing = await db.materials.get(id);
  if (!existing) throw new Error("Material no encontrado");

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
  await db.materials.update(id, {
    deleted: true,
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

export async function updateProductionOrder(id: string, data: ProductionOrderFormData): Promise<void> {
  const existing = await db.productionOrders.get(id);
  if (!existing) throw new Error("Orden no encontrada");
  if (!canVoidProduction(existing)) throw new Error("No se puede editar esta orden");

  const totalCost = Math.round(data.quantity * data.unitCost * 100) / 100;

  await db.productionOrders.update(id, {
    garmentId: data.garmentId,
    sizeId: data.sizeId,
    colorId: data.colorId,
    quantity: data.quantity,
    unitCost: data.unitCost,
    totalCost,
    startDate: data.startDate,
    dueDate: data.dueDate,
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteProductionOrder(id: string): Promise<void> {
  const materials = await db.productionMaterials
    .where("productionOrderId")
    .equals(id)
    .toArray();
  for (const mat of materials) {
    await db.productionMaterials.update(mat.id, {
      syncStatus: "pending" as const,
    });
    await db.productionMaterials.delete(mat.id);
  }

  await db.productionOrders.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function voidProductionOrder(id: string): Promise<void> {
  const existing = await db.productionOrders.get(id);
  if (!existing) throw new Error("Orden no encontrada");
  if (existing.status === "anulada") throw new Error("La orden ya está anulada");

  await db.productionOrders.update(id, {
    status: "anulada" as const,
    voidedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  const totalCost = Math.round(data.quantity * data.unitCost * 100) / 100;
  const pm = buildProductionMaterial({
    data: { ...data, totalCost },
    now,
  });
  pm.workspaceId = workspaceId;
  await db.productionMaterials.add(pm);
  return pm;
}

export async function removeProductionMaterial(id: string): Promise<void> {
  await db.productionMaterials.delete(id);
}
