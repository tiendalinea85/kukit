import type { Crop, FarmLot, AgroInput, Application, Labor, Harvest, LaborType } from "@/types/modules";

export const CROP_STATUSES = ["activa", "completada", "cancelada"] as const;

export const AGRO_INPUT_TYPES = ["fertilizante", "pesticida", "herbicida", "semilla", "otro"] as const;

export const LABOR_TYPES: readonly LaborType[] = [
  "siembra",
  "fumigacion",
  "fertilizacion",
  "control_de_plagas",
  "cosecha",
  "riego",
  "podar",
  "otro",
];

export const HARVEST_QUALITY = ["premium", "estandar", "baja"] as const;

export function buildCrop(input: {
  data: { name: string; description: string; season: string; status: Crop["status"]; startDate: string; endDate: string; notes: string };
  code: string;
  now: string;
  workspaceId: string;
}): Crop {
  const { data, code, now, workspaceId } = input;
  return {
    id: crypto.randomUUID(),
    code,
    name: data.name.trim(),
    description: data.description.trim(),
    season: data.season.trim(),
    status: data.status,
    startDate: data.startDate,
    endDate: data.endDate || null,
    notes: data.notes || "",
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: "pending",
    workspaceId,
  };
}

export function buildFarmLot(input: {
  data: { name: string; area: number; areaUnit: string; location: string; soilType: string; notes: string };
  code: string;
  now: string;
  workspaceId: string;
}): FarmLot {
  const { data, code, now, workspaceId } = input;
  return {
    id: crypto.randomUUID(),
    code,
    name: data.name.trim(),
    area: data.area,
    areaUnit: data.areaUnit,
    location: data.location.trim(),
    soilType: data.soilType.trim(),
    notes: data.notes || "",
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: "pending",
    workspaceId,
  };
}

export function buildAgroInput(input: {
  data: { name: string; type: AgroInput["type"]; unit: string; costPerUnit: number; stock: number; supplier: string; notes: string };
  code: string;
  now: string;
  workspaceId: string;
}): AgroInput {
  const { data, code, now, workspaceId } = input;
  return {
    id: crypto.randomUUID(),
    code,
    name: data.name.trim(),
    type: data.type,
    unit: data.unit,
    costPerUnit: data.costPerUnit,
    stock: data.stock,
    supplier: data.supplier.trim(),
    notes: data.notes || "",
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: "pending",
    workspaceId,
  };
}

export function buildApplication(input: {
  data: { cropId: string; cropName: string; lotId: string; lotName: string; inputId: string; inputName: string; quantity: number; unit: string; applicationDate: string; notes: string };
  code: string;
  now: string;
  workspaceId: string;
}): Application {
  const { data, code, now, workspaceId } = input;
  return {
    id: crypto.randomUUID(),
    code,
    cropId: data.cropId,
    cropName: data.cropName,
    lotId: data.lotId,
    lotName: data.lotName,
    inputId: data.inputId,
    inputName: data.inputName,
    quantity: data.quantity,
    unit: data.unit,
    applicationDate: data.applicationDate,
    notes: data.notes || "",
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: "pending",
    workspaceId,
  };
}

export function buildLabor(input: {
  data: { cropId: string; cropName: string; lotId: string; lotName: string; type: LaborType; description: string; laborDate: string; laborCost: number; workerCount: number; notes: string };
  code: string;
  now: string;
  workspaceId: string;
}): Labor {
  const { data, code, now, workspaceId } = input;
  return {
    id: crypto.randomUUID(),
    code,
    cropId: data.cropId,
    cropName: data.cropName,
    lotId: data.lotId,
    lotName: data.lotName,
    type: data.type,
    description: data.description.trim(),
    laborDate: data.laborDate,
    laborCost: data.laborCost,
    workerCount: data.workerCount,
    notes: data.notes || "",
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: "pending",
    workspaceId,
  };
}

export function buildHarvest(input: {
  data: { cropId: string; cropName: string; lotId: string; lotName: string; product: string; quantity: number; unit: string; unitPrice: number; harvestDate: string; quality: Harvest["quality"]; notes: string };
  code: string;
  now: string;
  workspaceId: string;
}): Harvest {
  const { data, code, now, workspaceId } = input;
  const totalValue = data.quantity * data.unitPrice;
  return {
    id: crypto.randomUUID(),
    code,
    cropId: data.cropId,
    cropName: data.cropName,
    lotId: data.lotId,
    lotName: data.lotName,
    product: data.product.trim(),
    quantity: data.quantity,
    unit: data.unit,
    unitPrice: data.unitPrice,
    totalValue,
    harvestDate: data.harvestDate,
    quality: data.quality,
    notes: data.notes || "",
    createdAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: "pending",
    workspaceId,
  };
}

export interface FilterableCrop {
  id: string;
  code: string;
  name: string;
  season: string;
  status: string;
  deleted?: boolean;
}

export interface CropFilters {
  search?: string;
  status?: string;
}

export function filterCrops<T extends FilterableCrop>(crops: T[], filters: CropFilters = {}): T[] {
  const search = (filters.search || "").trim().toLowerCase();
  return crops.filter((crop) => {
    if (crop.deleted === true) return false;
    if (filters.status && crop.status !== filters.status) return false;
    if (search) {
      const haystack = [crop.code, crop.name, crop.season, crop.status].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export interface FilterableHarvest {
  id: string;
  code: string;
  product: string;
  cropName: string;
  lotName: string;
  quality: string;
  deleted?: boolean;
}

export interface HarvestFilters {
  search?: string;
  quality?: string;
}

export function filterHarvests<T extends FilterableHarvest>(harvests: T[], filters: HarvestFilters = {}): T[] {
  const search = (filters.search || "").trim().toLowerCase();
  return harvests.filter((h) => {
    if (h.deleted === true) return false;
    if (filters.quality && h.quality !== filters.quality) return false;
    if (search) {
      const haystack = [h.code, h.product, h.cropName, h.lotName, h.quality].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export interface FilterableLabor {
  id: string;
  code: string;
  description: string;
  cropName: string;
  lotName: string;
  type: string;
  deleted?: boolean;
}

export interface LaborFilters {
  search?: string;
  type?: string;
}

export function filterLabors<T extends FilterableLabor>(labors: T[], filters: LaborFilters = {}): T[] {
  const search = (filters.search || "").trim().toLowerCase();
  return labors.filter((l) => {
    if (l.deleted === true) return false;
    if (filters.type && l.type !== filters.type) return false;
    if (search) {
      const haystack = [l.code, l.description, l.cropName, l.lotName, l.type].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function canEditCrop(crop: Pick<Crop, "status">): boolean {
  return crop.status === "activa";
}

export function computeHarvestTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}
