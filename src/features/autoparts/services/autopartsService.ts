import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { generateAutoPartCode } from "@/utils/code";
import {
  buildVehicleBrand,
  buildVehicleModel,
  buildAutoPart,
  buildPartCompatibility,
  canEditAutoPart,
} from "../domain/autopartsRules";
import type { VehicleBrand, VehicleModel, AutoPart, PartCompatibility } from "@/types/modules";
import type {
  VehicleBrandFormData,
  VehicleModelFormData,
  AutoPartFormData,
  PartCompatibilityFormData,
} from "../schemas/autopartsSchema";

function now(): string {
  return new Date().toISOString();
}

function getWorkspaceId(): string {
  const id = useWorkspaceStore.getState().activeWorkspaceId;
  if (!id) throw new Error("No hay un workspace activo");
  return id;
}

export async function createVehicleBrand(data: VehicleBrandFormData): Promise<VehicleBrand> {
  const brand = buildVehicleBrand({ data, now: now() });
  brand.workspaceId = getWorkspaceId();
  await db.vehicleBrands.add(brand);
  return brand;
}

export async function updateVehicleBrand(id: string, data: VehicleBrandFormData): Promise<void> {
  const existing = await db.vehicleBrands.get(id);
  if (!existing) throw new Error("Marca no encontrada");

  await db.vehicleBrands.update(id, {
    name: data.name.trim(),
    country: data.country.trim(),
    syncStatus: "pending" as const,
  });
}

export async function deleteVehicleBrand(id: string): Promise<void> {
  await db.vehicleBrands.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createVehicleModel(data: VehicleModelFormData): Promise<VehicleModel> {
  const brand = await db.vehicleBrands.get(data.brandId);
  const model = buildVehicleModel({
    data: {
      ...data,
      brandName: brand?.name ?? "",
      endYear: data.endYear ?? null,
      engine: data.engine ?? "",
      notes: data.notes ?? "",
    },
    now: now(),
  });
  model.workspaceId = getWorkspaceId();
  await db.vehicleModels.add(model);
  return model;
}

export async function updateVehicleModel(id: string, data: VehicleModelFormData): Promise<void> {
  const existing = await db.vehicleModels.get(id);
  if (!existing) throw new Error("Modelo no encontrado");
  const brand = await db.vehicleBrands.get(data.brandId);

  await db.vehicleModels.update(id, {
    brandId: data.brandId,
    brandName: brand?.name ?? existing.brandName,
    name: data.name.trim(),
    startYear: data.startYear,
    endYear: data.endYear ?? null,
    engine: data.engine ?? "",
    notes: data.notes ?? "",
    syncStatus: "pending" as const,
  });
}

export async function deleteVehicleModel(id: string): Promise<void> {
  await db.vehicleModels.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createAutoPart(data: AutoPartFormData): Promise<AutoPart> {
  const code = await generateAutoPartCode();
  const part = buildAutoPart({ data: { ...data, category: data.category as AutoPart["category"], notes: data.notes ?? "" }, code, now: now() });
  part.workspaceId = getWorkspaceId();
  await db.autoParts.add(part);
  return part;
}

export async function updateAutoPart(id: string, data: AutoPartFormData): Promise<void> {
  const existing = await db.autoParts.get(id);
  if (!existing) throw new Error("Repuesto no encontrado");
  if (!canEditAutoPart(existing)) throw new Error("No se puede editar este repuesto");

  await db.autoParts.update(id, {
    name: data.name.trim(),
    partNumber: data.partNumber.trim(),
    brand: data.brand ?? "",
    category: data.category as AutoPart["category"],
    unitPrice: data.unitPrice,
    costPrice: data.costPrice,
    stock: data.stock,
    minStock: data.minStock,
    notes: data.notes ?? "",
    updatedAt: now(),
    syncStatus: "pending" as const,
  });
}

export async function deleteAutoPart(id: string): Promise<void> {
  await db.autoParts.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createPartCompatibility(data: PartCompatibilityFormData): Promise<PartCompatibility> {
  const model = await db.vehicleModels.get(data.modelId);

  const compat = buildPartCompatibility({
    data: {
      partId: data.partId,
      modelId: data.modelId,
      brandName: model?.brandName ?? "",
      modelName: model?.name ?? "",
      yearFrom: data.yearFrom,
      yearTo: data.yearTo ?? null,
      engine: data.engine ?? "",
      notes: data.notes ?? "",
    },
    now: now(),
  });
  compat.workspaceId = getWorkspaceId();
  await db.partCompatibilities.add(compat);
  return compat;
}

export async function updatePartCompatibility(id: string, data: PartCompatibilityFormData): Promise<void> {
  const existing = await db.partCompatibilities.get(id);
  if (!existing) throw new Error("Compatibilidad no encontrada");
  const model = await db.vehicleModels.get(data.modelId);

  await db.partCompatibilities.update(id, {
    partId: data.partId,
    modelId: data.modelId,
    brandName: model?.brandName ?? existing.brandName,
    modelName: model?.name ?? existing.modelName,
    yearFrom: data.yearFrom,
    yearTo: data.yearTo ?? null,
    engine: data.engine ?? "",
    notes: data.notes ?? "",
    syncStatus: "pending" as const,
  });
}

export async function deletePartCompatibility(id: string): Promise<void> {
  await db.partCompatibilities.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}
