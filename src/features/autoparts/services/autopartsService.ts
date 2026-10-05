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

// `id` es clave primaria: sin comprobar el workspace, un id de otro espacio de
// trabajo editaba, anulaba o borraba filas ajenas. Mismo error para no revelar
// su existencia. También valida las FK (marca, modelo) referenciadas al escribir.
async function getActiveVehicleBrand(id: string): Promise<VehicleBrand> {
  const brand = await db.vehicleBrands.get(id);
  if (!brand || brand.workspaceId !== getWorkspaceId()) {
    throw new Error("Marca no encontrada en este espacio de trabajo");
  }
  return brand;
}

async function getActiveVehicleModel(id: string): Promise<VehicleModel> {
  const model = await db.vehicleModels.get(id);
  if (!model || model.workspaceId !== getWorkspaceId()) {
    throw new Error("Modelo no encontrado en este espacio de trabajo");
  }
  return model;
}

async function getActiveAutoPart(id: string): Promise<AutoPart> {
  const part = await db.autoParts.get(id);
  if (!part || part.workspaceId !== getWorkspaceId()) {
    throw new Error("Repuesto no encontrado en este espacio de trabajo");
  }
  return part;
}

async function getActivePartCompatibility(id: string): Promise<PartCompatibility> {
  const compatibility = await db.partCompatibilities.get(id);
  if (!compatibility || compatibility.workspaceId !== getWorkspaceId()) {
    throw new Error("Compatibilidad no encontrada en este espacio de trabajo");
  }
  return compatibility;
}

export async function createVehicleBrand(data: VehicleBrandFormData): Promise<VehicleBrand> {
  const brand = buildVehicleBrand({ data, now: now() });
  brand.workspaceId = getWorkspaceId();
  await db.vehicleBrands.add(brand);
  return brand;
}

export async function updateVehicleBrand(id: string, data: VehicleBrandFormData): Promise<void> {
  await getActiveVehicleBrand(id);

  await db.vehicleBrands.update(id, {
    name: data.name.trim(),
    country: data.country.trim(),
    syncStatus: "pending" as const,
  });
}

export async function deleteVehicleBrand(id: string): Promise<void> {
  await getActiveVehicleBrand(id);
  await db.vehicleBrands.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createVehicleModel(data: VehicleModelFormData): Promise<VehicleModel> {
  const brand = await getActiveVehicleBrand(data.brandId);
  const model = buildVehicleModel({
    data: {
      ...data,
      brandName: brand.name,
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
  await getActiveVehicleModel(id);
  const brand = await getActiveVehicleBrand(data.brandId);

  await db.vehicleModels.update(id, {
    brandId: data.brandId,
    brandName: brand.name,
    name: data.name.trim(),
    startYear: data.startYear,
    endYear: data.endYear ?? null,
    engine: data.engine ?? "",
    notes: data.notes ?? "",
    syncStatus: "pending" as const,
  });
}

export async function deleteVehicleModel(id: string): Promise<void> {
  await getActiveVehicleModel(id);
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
  const existing = await getActiveAutoPart(id);
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
  await getActiveAutoPart(id);
  await db.autoParts.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createPartCompatibility(data: PartCompatibilityFormData): Promise<PartCompatibility> {
  await getActiveAutoPart(data.partId);
  const model = await getActiveVehicleModel(data.modelId);

  const compat = buildPartCompatibility({
    data: {
      partId: data.partId,
      modelId: data.modelId,
      brandName: model.brandName,
      modelName: model.name,
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
  await getActivePartCompatibility(id);
  await getActiveAutoPart(data.partId);
  const model = await getActiveVehicleModel(data.modelId);

  await db.partCompatibilities.update(id, {
    partId: data.partId,
    modelId: data.modelId,
    brandName: model.brandName,
    modelName: model.name,
    yearFrom: data.yearFrom,
    yearTo: data.yearTo ?? null,
    engine: data.engine ?? "",
    notes: data.notes ?? "",
    syncStatus: "pending" as const,
  });
}

export async function deletePartCompatibility(id: string): Promise<void> {
  await getActivePartCompatibility(id);
  await db.partCompatibilities.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}
