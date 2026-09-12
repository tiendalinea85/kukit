import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import {
  generateCropCode,
  generateLotCode,
  generateAgroInputCode,
  generateApplicationCode,
  generateLaborCode,
  generateHarvestCode,
} from "@/utils/code";
import {
  buildCrop,
  buildFarmLot,
  buildAgroInput,
  buildApplication,
  buildLabor,
  buildHarvest,
  canEditCrop,
} from "../domain/agricultureRules";
import type { CropFormData } from "../schemas/agricultureSchema";
import type { FarmLotFormData } from "../schemas/agricultureSchema";
import type { AgroInputFormData } from "../schemas/agricultureSchema";
import type { ApplicationFormData } from "../schemas/agricultureSchema";
import type { LaborFormData } from "../schemas/agricultureSchema";
import type { HarvestFormData } from "../schemas/agricultureSchema";
import type { LaborType, Crop, FarmLot, AgroInput } from "@/types/modules";

function getWorkspaceId(): string {
  const id = useWorkspaceStore.getState().activeWorkspaceId;
  if (!id) throw new Error("No hay workspace activo");
  return id;
}

export async function createCrop(data: CropFormData, code?: string): Promise<void> {
  const workspaceId = getWorkspaceId();
  const finalCode = code || (await generateCropCode());
  const now = new Date().toISOString();
  const crop = buildCrop({
    data: {
      name: data.name,
      description: data.description || "",
      season: data.season,
      status: data.status,
      startDate: data.startDate,
      endDate: data.endDate || "",
      notes: data.notes || "",
    },
    code: finalCode,
    now,
    workspaceId,
  });
  await db.crops.add(crop);
}

export async function updateCrop(id: string, data: CropFormData): Promise<void> {
  const existing = await db.crops.get(id);
  if (!existing) throw new Error("Cultivo no encontrado");
  if (!canEditCrop(existing)) throw new Error("Solo se pueden editar cultivos activos");

  await db.crops.update(id, {
    name: data.name.trim(),
    description: (data.description || "").trim(),
    season: data.season.trim(),
    status: data.status,
    startDate: data.startDate,
    endDate: data.endDate || null,
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteCrop(id: string): Promise<void> {
  await db.crops.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createFarmLot(data: FarmLotFormData, code?: string): Promise<void> {
  const workspaceId = getWorkspaceId();
  const finalCode = code || (await generateLotCode());
  const now = new Date().toISOString();
  const lot = buildFarmLot({
    data: {
      name: data.name,
      area: data.area,
      areaUnit: data.areaUnit,
      location: data.location || "",
      soilType: data.soilType || "",
      notes: data.notes || "",
    },
    code: finalCode,
    now,
    workspaceId,
  });
  await db.farmLots.add(lot);
}

export async function updateFarmLot(id: string, data: FarmLotFormData): Promise<void> {
  await db.farmLots.update(id, {
    name: data.name.trim(),
    area: data.area,
    areaUnit: data.areaUnit,
    location: (data.location || "").trim(),
    soilType: (data.soilType || "").trim(),
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteFarmLot(id: string): Promise<void> {
  await db.farmLots.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createAgroInput(data: AgroInputFormData, code?: string): Promise<void> {
  const workspaceId = getWorkspaceId();
  const finalCode = code || (await generateAgroInputCode());
  const now = new Date().toISOString();
  const input = buildAgroInput({
    data: {
      name: data.name,
      type: data.type,
      unit: data.unit,
      costPerUnit: data.costPerUnit,
      stock: data.stock,
      supplier: data.supplier || "",
      notes: data.notes || "",
    },
    code: finalCode,
    now,
    workspaceId,
  });
  await db.agroInputs.add(input);
}

export async function updateAgroInput(id: string, data: AgroInputFormData): Promise<void> {
  await db.agroInputs.update(id, {
    name: data.name.trim(),
    type: data.type,
    unit: data.unit,
    costPerUnit: data.costPerUnit,
    stock: data.stock,
    supplier: (data.supplier || "").trim(),
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteAgroInput(id: string): Promise<void> {
  await db.agroInputs.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createApplication(data: ApplicationFormData, crops: Crop[], farmLots: FarmLot[], agroInputs: AgroInput[], code?: string): Promise<void> {
  const workspaceId = getWorkspaceId();
  const finalCode = code || (await generateApplicationCode());
  const now = new Date().toISOString();

  const crop = crops.find((c) => c.id === data.cropId);
  const lot = farmLots.find((l) => l.id === data.lotId);
  const input = agroInputs.find((i) => i.id === data.inputId);

  const app = buildApplication({
    data: {
      cropId: data.cropId,
      cropName: crop?.name || "",
      lotId: data.lotId,
      lotName: lot?.name || "",
      inputId: data.inputId,
      inputName: input?.name || "",
      quantity: data.quantity,
      unit: input?.unit || "",
      applicationDate: data.applicationDate,
      notes: data.notes || "",
    },
    code: finalCode,
    now,
    workspaceId,
  });
  await db.applications.add(app);
}

export async function deleteApplication(id: string): Promise<void> {
  await db.applications.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createLabor(data: LaborFormData, crops: Crop[], farmLots: FarmLot[], code?: string): Promise<void> {
  const workspaceId = getWorkspaceId();
  const finalCode = code || (await generateLaborCode());
  const now = new Date().toISOString();

  const crop = crops.find((c) => c.id === data.cropId);
  const lot = farmLots.find((l) => l.id === data.lotId);

  const labor = buildLabor({
    data: {
      cropId: data.cropId,
      cropName: crop?.name || "",
      lotId: data.lotId,
      lotName: lot?.name || "",
      type: data.type as LaborType,
      description: data.description,
      laborDate: data.laborDate,
      laborCost: data.laborCost,
      workerCount: data.workerCount,
      notes: data.notes || "",
    },
    code: finalCode,
    now,
    workspaceId,
  });
  await db.labors.add(labor);
}

export async function deleteLabor(id: string): Promise<void> {
  await db.labors.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createHarvest(data: HarvestFormData, crops: Crop[], farmLots: FarmLot[], code?: string): Promise<void> {
  const workspaceId = getWorkspaceId();
  const finalCode = code || (await generateHarvestCode());
  const now = new Date().toISOString();

  const crop = crops.find((c) => c.id === data.cropId);
  const lot = farmLots.find((l) => l.id === data.lotId);

  const harvest = buildHarvest({
    data: {
      cropId: data.cropId,
      cropName: crop?.name || "",
      lotId: data.lotId,
      lotName: lot?.name || "",
      product: data.product,
      quantity: data.quantity,
      unit: data.unit,
      unitPrice: data.unitPrice,
      harvestDate: data.harvestDate,
      quality: data.quality,
      notes: data.notes || "",
    },
    code: finalCode,
    now,
    workspaceId,
  });
  await db.harvests.add(harvest);
}

export async function updateHarvest(id: string, data: HarvestFormData, crops: Crop[], farmLots: FarmLot[]): Promise<void> {
  const crop = crops.find((c) => c.id === data.cropId);
  const lot = farmLots.find((l) => l.id === data.lotId);
  const totalValue = data.quantity * data.unitPrice;

  await db.harvests.update(id, {
    cropId: data.cropId,
    cropName: crop?.name || "",
    lotId: data.lotId,
    lotName: lot?.name || "",
    product: data.product.trim(),
    quantity: data.quantity,
    unit: data.unit,
    unitPrice: data.unitPrice,
    totalValue,
    harvestDate: data.harvestDate,
    quality: data.quality,
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteHarvest(id: string): Promise<void> {
  await db.harvests.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}
