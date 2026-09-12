import type {
  Species,
  Animal,
  BreedingLot,
  Feeding,
  Reproduction,
  LivestockProduction,
  AnimalGender,
  FeedType,
  ReproEvent,
  ProductionType,
} from "@/types/modules";

export const SPECIES_CATEGORIES = [
  "aves",
  "mamiferos",
  "peces",
  "reptiles",
  "otro",
] as const;

export const SPECIES_CATEGORY_LABELS: Record<string, string> = {
  aves: "Aves",
  mamiferos: "Mamíferos",
  peces: "Peces",
  reptiles: "Reptiles",
  otro: "Otro",
};

export const FEED_TYPES: readonly FeedType[] = [
  "concentrado",
  "forraje",
  "grano",
  "suplemento",
  "otro",
];

export const FEED_TYPE_LABELS: Record<FeedType, string> = {
  concentrado: "Concentrado",
  forraje: "Forraje",
  grano: "Grano",
  suplemento: "Suplemento",
  otro: "Otro",
};

export const REPRO_EVENTS: readonly ReproEvent[] = [
  "monta",
  "inseminacion",
  "diagnostico",
  "parto",
  "destete",
  "otro",
];

export const REPRO_EVENT_LABELS: Record<ReproEvent, string> = {
  monta: "Monta",
  inseminacion: "Inseminación",
  diagnostico: "Diagnóstico",
  parto: "Parto",
  destete: "Destete",
  otro: "Otro",
};

export const PRODUCTION_TYPES: readonly ProductionType[] = [
  "leche",
  "huevos",
  "carne",
  "lana",
  "otro",
];

export const PRODUCTION_TYPE_LABELS: Record<ProductionType, string> = {
  leche: "Leche",
  huevos: "Huevos",
  carne: "Carne",
  lana: "Lana",
  otro: "Otro",
};

export const ANIMAL_STATUSES = [
  "activo",
  "vendido",
  "sacrificado",
  "muerto",
  "baja",
] as const;

export const ANIMAL_STATUS_LABELS: Record<string, string> = {
  activo: "Activo",
  vendido: "Vendido",
  sacrificado: "Sacrificado",
  muerto: "Muerto",
  baja: "Baja",
};

export const ANIMAL_GENDERS: readonly AnimalGender[] = ["macho", "hembra"];

export const ANIMAL_GENDER_LABELS: Record<AnimalGender, string> = {
  macho: "Macho",
  hembra: "Hembra",
};

export const FEEDING_UNITS = [
  "kg",
  "g",
  "litros",
  "ml",
  "bultos",
  "sacos",
  "otro",
] as const;

export const PRODUCTION_UNITS = [
  "litros",
  "kg",
  "g",
  "docenas",
  "unidades",
  "otro",
] as const;

export function buildSpecies(input: {
  data: { name: string; category: string; unit: string; notes?: string };
  now: string;
}): Species {
  return {
    id: crypto.randomUUID(),
    name: input.data.name.trim(),
    category: input.data.category as Species["category"],
    unit: input.data.unit.trim(),
    notes: input.data.notes || "",
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildAnimal(input: {
  data: {
    name: string;
    speciesId: string;
    speciesName: string;
    gender: string;
    birthDate: string;
    lotId: string;
    lotName: string;
    status: string;
    notes?: string;
  };
  code: string;
  now: string;
}): Animal {
  return {
    id: crypto.randomUUID(),
    code: input.code,
    name: input.data.name.trim(),
    speciesId: input.data.speciesId,
    speciesName: input.data.speciesName,
    gender: input.data.gender as AnimalGender,
    birthDate: input.data.birthDate,
    lotId: input.data.lotId,
    lotName: input.data.lotName,
    status: input.data.status as Animal["status"],
    notes: input.data.notes || "",
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildBreedingLot(input: {
  data: {
    name: string;
    speciesId: string;
    speciesName: string;
    location: string;
    capacity: number;
    notes?: string;
  };
  code: string;
  now: string;
}): BreedingLot {
  return {
    id: crypto.randomUUID(),
    code: input.code,
    name: input.data.name.trim(),
    speciesId: input.data.speciesId,
    speciesName: input.data.speciesName,
    location: input.data.location.trim(),
    capacity: input.data.capacity,
    currentCount: 0,
    notes: input.data.notes || "",
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildFeeding(input: {
  data: {
    lotId: string;
    lotName: string;
    feedType: string;
    feedName: string;
    quantity: number;
    unit: string;
    cost: number;
    feedingDate: string;
    notes?: string;
  };
  code: string;
  now: string;
}): Feeding {
  return {
    id: crypto.randomUUID(),
    code: input.code,
    lotId: input.data.lotId,
    lotName: input.data.lotName,
    feedType: input.data.feedType as FeedType,
    feedName: input.data.feedName.trim(),
    quantity: input.data.quantity,
    unit: input.data.unit,
    cost: input.data.cost,
    feedingDate: input.data.feedingDate,
    notes: input.data.notes || "",
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildReproduction(input: {
  data: {
    animalId: string;
    animalName: string;
    event: string;
    eventDate: string;
    targetAnimal: string;
    result: string;
    notes?: string;
  };
  code: string;
  now: string;
}): Reproduction {
  return {
    id: crypto.randomUUID(),
    code: input.code,
    animalId: input.data.animalId,
    animalName: input.data.animalName,
    event: input.data.event as ReproEvent,
    eventDate: input.data.eventDate,
    targetAnimal: input.data.targetAnimal.trim(),
    result: input.data.result.trim(),
    notes: input.data.notes || "",
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildLivestockProduction(input: {
  data: {
    lotId: string;
    lotName: string;
    type: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    productionDate: string;
    notes?: string;
  };
  code: string;
  now: string;
}): LivestockProduction {
  const totalValue = Math.round(input.data.quantity * input.data.unitPrice * 100) / 100;
  return {
    id: crypto.randomUUID(),
    code: input.code,
    lotId: input.data.lotId,
    lotName: input.data.lotName,
    type: input.data.type as ProductionType,
    quantity: input.data.quantity,
    unit: input.data.unit,
    unitPrice: input.data.unitPrice,
    totalValue,
    productionDate: input.data.productionDate,
    notes: input.data.notes || "",
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function canEditAnimal(animal: Pick<Animal, "status" | "deleted">): boolean {
  return !animal.deleted;
}

export function computeFeedingCost(quantity: number, costPerUnit: number): number {
  return Math.round(quantity * costPerUnit * 100) / 100;
}

export function computeProductionValue(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export interface FilterableAnimal {
  id: string;
  code: string;
  name: string;
  speciesId: string;
  lotId: string;
  gender: string;
  status: string;
  deleted?: boolean;
}

export interface AnimalFilters {
  search?: string;
  speciesId?: string;
  lotId?: string;
  gender?: string;
  status?: string;
}

export function filterAnimals<T extends FilterableAnimal>(
  animals: T[],
  filters: AnimalFilters = {}
): T[] {
  const search = (filters.search || "").trim().toLowerCase();

  return animals.filter((animal) => {
    if (animal.deleted === true) return false;
    if (filters.speciesId && animal.speciesId !== filters.speciesId) return false;
    if (filters.lotId && animal.lotId !== filters.lotId) return false;
    if (filters.gender && animal.gender !== filters.gender) return false;
    if (filters.status && animal.status !== filters.status) return false;

    if (search) {
      const haystack = [animal.code, animal.name, animal.gender, animal.status]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

export interface FilterableFeeding {
  id: string;
  code: string;
  lotId: string;
  feedType: string;
  feedName: string;
  deleted?: boolean;
}

export interface FeedingFilters {
  search?: string;
  lotId?: string;
  feedType?: string;
}

export function filterFeedings<T extends FilterableFeeding>(
  feedings: T[],
  filters: FeedingFilters = {}
): T[] {
  const search = (filters.search || "").trim().toLowerCase();

  return feedings.filter((feeding) => {
    if (feeding.deleted === true) return false;
    if (filters.lotId && feeding.lotId !== filters.lotId) return false;
    if (filters.feedType && feeding.feedType !== filters.feedType) return false;

    if (search) {
      const haystack = [feeding.code, feeding.feedName, feeding.feedType]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}
