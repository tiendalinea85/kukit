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
import type { LaborType, Crop, FarmLot, AgroInput, Application, Labor, Harvest } from "@/types/modules";

function getWorkspaceId(): string {
  const id = useWorkspaceStore.getState().activeWorkspaceId;
  if (!id) throw new Error("No hay workspace activo");
  return id;
}

// Validación de pertenencia al workspace activo para evitar acceso entre espacios.

async function getActiveCrop(id: string): Promise<Crop> {
  const row = await db.crops.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Cultivo no encontrado");
  }
  return row;
}

async function getActiveFarmLot(id: string): Promise<FarmLot> {
  const row = await db.farmLots.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Lote no encontrado");
  }
  return row;
}

async function getActiveAgroInput(id: string): Promise<AgroInput> {
  const row = await db.agroInputs.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Insumo no encontrado");
  }
  return row;
}

// Validación para entidades hijas de agricultura.
async function getActiveApplication(id: string): Promise<Application> {
  const row = await db.applications.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Aplicación no encontrada");
  }
  return row;
}

async function getActiveLabor(id: string): Promise<Labor> {
  const row = await db.labors.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Labor no encontrada");
  }
  return row;
}

async function getActiveHarvest(id: string): Promise<Harvest> {
  const row = await db.harvests.get(id);
  if (!row || row.workspaceId !== getWorkspaceId()) {
    throw new Error("Cosecha no encontrada");
  }
  return row;
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
  const existing = await getActiveCrop(id);
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
  await getActiveCrop(id);
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
  await getActiveFarmLot(id);
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
  await getActiveFarmLot(id);
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
  await getActiveAgroInput(id);
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
  await getActiveAgroInput(id);
  await db.agroInputs.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createApplication(data: ApplicationFormData, crops: Crop[], farmLots: FarmLot[], agroInputs: AgroInput[], code?: string): Promise<void> {
  const workspaceId = getWorkspaceId();
  // Validar que los elementos referenciados pertenecen al workspace activo.
  const cropRef = crops.find((c) => c.id === data.cropId);
  if (!cropRef || cropRef.workspaceId !== workspaceId) {
    throw new Error("El cultivo no pertenece a este espacio de trabajo");
  }
  const lotRef = farmLots.find((l) => l.id === data.lotId);
  if (!lotRef || lotRef.workspaceId !== workspaceId) {
    throw new Error("El lote no pertenece a este espacio de trabajo");
  }
  const inputRef = agroInputs.find((i) => i.id === data.inputId);
  if (!inputRef || inputRef.workspaceId !== workspaceId) {
    throw new Error("El insumo no pertenece a este espacio de trabajo");
  }

  const finalCode = code || (await generateApplicationCode());
  const now = new Date().toISOString();

  const crop = cropRef;
  const lot = lotRef;
  const input = inputRef;

  const app = buildApplication({
    data: {
      cropId: data.cropId,
      cropName: crop.name,
      lotId: data.lotId,
      lotName: lot.name,
      inputId: data.inputId,
      inputName: input.name,
      quantity: data.quantity,
      unit: input.unit,
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
  await getActiveApplication(id);
  await db.applications.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createLabor(data: LaborFormData, crops: Crop[], farmLots: FarmLot[], code?: string): Promise<void> {
  const workspaceId = getWorkspaceId();
  // Validar que los elementos referenciados pertenecen al workspace activo.
  const cropRef = crops.find((c) => c.id === data.cropId);
  if (!cropRef || cropRef.workspaceId !== workspaceId) {
    throw new Error("El cultivo no pertenece a este espacio de trabajo");
  }
  const lotRef = farmLots.find((l) => l.id === data.lotId);
  if (!lotRef || lotRef.workspaceId !== workspaceId) {
    throw new Error("El lote no pertenece a este espacio de trabajo");
  }

  const finalCode = code || (await generateLaborCode());
  const now = new Date().toISOString();

  const crop = cropRef;
  const lot = lotRef;

  const labor = buildLabor({
    data: {
      cropId: data.cropId,
      cropName: crop.name,
      lotId: data.lotId,
      lotName: lot.name,
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
  await getActiveLabor(id);
  await db.labors.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createHarvest(data: HarvestFormData, crops: Crop[], farmLots: FarmLot[], code?: string): Promise<void> {
  const workspaceId = getWorkspaceId();
  // Validar que los elementos referenciados pertenecen al workspace activo.
  const cropRef = crops.find((c) => c.id === data.cropId);
  if (!cropRef || cropRef.workspaceId !== workspaceId) {
    throw new Error("El cultivo no pertenece a este espacio de trabajo");
  }
  const lotRef = farmLots.find((l) => l.id === data.lotId);
  if (!lotRef || lotRef.workspaceId !== workspaceId) {
    throw new Error("El lote no pertenece a este espacio de trabajo");
  }

  const finalCode = code || (await generateHarvestCode());
  const now = new Date().toISOString();

  const crop = cropRef;
  const lot = lotRef;

  const harvest = buildHarvest({
    data: {
      cropId: data.cropId,
      cropName: crop.name,
      lotId: data.lotId,
      lotName: lot.name,
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
  const workspaceId = getWorkspaceId();
  await getActiveHarvest(id);

  const cropRef = crops.find((c) => c.id === data.cropId);
  if (!cropRef || cropRef.workspaceId !== workspaceId) {
    throw new Error("El cultivo no pertenece a este espacio de trabajo");
  }
  const lotRef = farmLots.find((l) => l.id === data.lotId);
  if (!lotRef || lotRef.workspaceId !== workspaceId) {
    throw new Error("El lote no pertenece a este espacio de trabajo");
  }

  const crop = cropRef;
  const lot = lotRef;
  const totalValue = data.quantity * data.unitPrice;

  await db.harvests.update(id, {
    cropId: data.cropId,
    cropName: crop.name,
    lotId: data.lotId,
    lotName: lot.name,
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
  await getActiveHarvest(id);
  await db.harvests.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}
