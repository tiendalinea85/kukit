import type { SyncStatus } from "./sync.ts";

// ─── TALLER DE CONFECCIÓN ────────────────────────────────────────────────────

export interface Garment {
  id: string;
  code: string;
  name: string;
  description: string;
  categoryId: string;
  salePrice: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export interface Size {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
}

export interface Color {
  id: string;
  name: string;
  hex: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
}

export interface Material {
  id: string;
  code: string;
  name: string;
  unit: string;
  costPerUnit: number;
  stock: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export type ProductionStatus = "pendiente" | "en_proceso" | "completada" | "anulada";

export interface ProductionOrder {
  id: string;
  code: string;
  garmentId: string;
  garmentName: string;
  sizeId: string;
  sizeName: string;
  colorId: string;
  colorName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  status: ProductionStatus;
  startDate: string;
  dueDate: string;
  completedAt: string | null;
  notes: string;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export interface ProductionMaterial {
  id: string;
  productionOrderId: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: string;
  syncStatus: SyncStatus;
  workspaceId: string;
}

// ─── AGRICULTURA ─────────────────────────────────────────────────────────────

export interface Crop {
  id: string;
  code: string;
  name: string;
  description: string;
  season: string;
  status: "activa" | "completada" | "cancelada";
  startDate: string;
  endDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export interface FarmLot {
  id: string;
  code: string;
  name: string;
  area: number;
  areaUnit: string;
  location: string;
  soilType: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export interface AgroInput {
  id: string;
  code: string;
  name: string;
  type: "fertilizante" | "pesticida" | "herbicida" | "semilla" | "otro";
  unit: string;
  costPerUnit: number;
  stock: number;
  supplier: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export interface Application {
  id: string;
  code: string;
  cropId: string;
  cropName: string;
  lotId: string;
  lotName: string;
  inputId: string;
  inputName: string;
  quantity: number;
  unit: string;
  applicationDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export type LaborType =
  | "siembra"
  | "fumigacion"
  | "fertilizacion"
  | "control_de_plagas"
  | "cosecha"
  | "riego"
  | "podar"
  | "otro";

export interface Labor {
  id: string;
  code: string;
  cropId: string;
  cropName: string;
  lotId: string;
  lotName: string;
  type: LaborType;
  description: string;
  laborDate: string;
  laborCost: number;
  workerCount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export interface Harvest {
  id: string;
  code: string;
  cropId: string;
  cropName: string;
  lotId: string;
  lotName: string;
  product: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  harvestDate: string;
  quality: "premium" | "estandar" | "baja";
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

// ─── REPUESTOS AUTOMOTRICES ──────────────────────────────────────────────────

export interface VehicleBrand {
  id: string;
  name: string;
  country: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
}

export interface VehicleModel {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  startYear: number;
  endYear: number | null;
  engine: string;
  notes: string;
  createdAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
}

export type PartCategory =
  | "motor"
  | "frenos"
  | "suspension"
  | "electrico"
  | "transmision"
  | "carroceria"
  | "filtro"
  | "aceite"
  | "otro";

export interface AutoPart {
  id: string;
  code: string;
  name: string;
  partNumber: string;
  brand: string;
  category: PartCategory;
  unitPrice: number;
  costPrice: number;
  stock: number;
  minStock: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export interface PartCompatibility {
  id: string;
  partId: string;
  modelId: string;
  brandName: string;
  modelName: string;
  yearFrom: number;
  yearTo: number | null;
  engine: string;
  notes: string;
  createdAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
}

// ─── CRIANZA ─────────────────────────────────────────────────────────────────

export interface Species {
  id: string;
  name: string;
  category: "aves" | "mamiferos" | "peces" | "reptiles" | "otro";
  unit: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
}

export type AnimalGender = "macho" | "hembra";

export interface Animal {
  id: string;
  code: string;
  name: string;
  speciesId: string;
  speciesName: string;
  gender: AnimalGender;
  birthDate: string;
  lotId: string;
  lotName: string;
  status: "activo" | "vendido" | "sacrificado" | "muerto" | "baja";
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export interface BreedingLot {
  id: string;
  code: string;
  name: string;
  speciesId: string;
  speciesName: string;
  location: string;
  capacity: number;
  currentCount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export type FeedType = "concentrado" | "forraje" | "grano" | "suplemento" | "otro";

export interface Feeding {
  id: string;
  code: string;
  lotId: string;
  lotName: string;
  feedType: FeedType;
  feedName: string;
  quantity: number;
  unit: string;
  cost: number;
  feedingDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export type ReproEvent =
  | "monta"
  | "inseminacion"
  | "diagnostico"
  | "parto"
  | "destete"
  | "otro";

export interface Reproduction {
  id: string;
  code: string;
  animalId: string;
  animalName: string;
  event: ReproEvent;
  eventDate: string;
  targetAnimal: string;
  result: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}

export type ProductionType =
  | "leche"
  | "huevos"
  | "carne"
  | "lana"
  | "otro";

export interface LivestockProduction {
  id: string;
  code: string;
  lotId: string;
  lotName: string;
  type: ProductionType;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  productionDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  workspaceId: string;
  revision?: number;
}
