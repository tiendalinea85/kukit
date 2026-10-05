import { db } from "@/lib/db";
import {
  generateAnimalCode,
  generateBreedingLotCode,
  generateFeedingCode,
  generateReproductionCode,
  generateLivestockProductionCode,
} from "@/utils/code";
import {
  buildSpecies,
  buildAnimal,
  buildBreedingLot,
  buildFeeding,
  buildReproduction,
  buildLivestockProduction,
  canEditAnimal,
} from "../domain/breedingRules";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type {
  Species,
  Animal,
  BreedingLot,
  Feeding,
  Reproduction,
  LivestockProduction,
} from "@/types/modules";
import type {
  SpeciesFormData,
  AnimalFormData,
  BreedingLotFormData,
  FeedingFormData,
  ReproductionFormData,
  LivestockProductionFormData,
} from "../schemas/breedingSchema";

function getWorkspaceId(): string {
  const id = useWorkspaceStore.getState().activeWorkspaceId;
  if (!id) throw new Error("No hay workspace activo");
  return id;
}

// `id` es clave primaria: sin comprobar el workspace, un id de otro espacio de
// trabajo editaba, anulaba o borraba filas ajenas. Mismo error para no revelar
// su existencia. También valida las FK (especie, lote) referenciadas al escribir.
async function getActiveSpecies(id: string): Promise<Species> {
  const species = await db.species.get(id);
  if (!species || species.workspaceId !== getWorkspaceId()) {
    throw new Error("Especie no encontrada en este espacio de trabajo");
  }
  return species;
}

async function getActiveAnimal(id: string): Promise<Animal> {
  const animal = await db.animals.get(id);
  if (!animal || animal.workspaceId !== getWorkspaceId()) {
    throw new Error("Animal no encontrado en este espacio de trabajo");
  }
  return animal;
}

async function getActiveBreedingLot(id: string): Promise<BreedingLot> {
  const lot = await db.breedingLots.get(id);
  if (!lot || lot.workspaceId !== getWorkspaceId()) {
    throw new Error("Lote no encontrado en este espacio de trabajo");
  }
  return lot;
}

async function getActiveFeeding(id: string): Promise<Feeding> {
  const feeding = await db.feedings.get(id);
  if (!feeding || feeding.workspaceId !== getWorkspaceId()) {
    throw new Error("Alimentación no encontrada en este espacio de trabajo");
  }
  return feeding;
}

async function getActiveReproduction(id: string): Promise<Reproduction> {
  const reproduction = await db.reproductions.get(id);
  if (!reproduction || reproduction.workspaceId !== getWorkspaceId()) {
    throw new Error("Reproducción no encontrada en este espacio de trabajo");
  }
  return reproduction;
}

async function getActiveLivestockProduction(id: string): Promise<LivestockProduction> {
  const production = await db.livestockProductions.get(id);
  if (!production || production.workspaceId !== getWorkspaceId()) {
    throw new Error("Producción ganadera no encontrada en este espacio de trabajo");
  }
  return production;
}

export async function createSpecies(data: SpeciesFormData): Promise<Species> {
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  const species = buildSpecies({ data, now });
  species.workspaceId = workspaceId;
  await db.species.add(species);
  return species;
}

export async function updateSpecies(id: string, data: SpeciesFormData): Promise<void> {
  await getActiveSpecies(id);

  await db.species.update(id, {
    name: data.name.trim(),
    category: data.category as Species["category"],
    unit: data.unit.trim(),
    notes: data.notes || "",
    syncStatus: "pending" as const,
  });
}

export async function deleteSpecies(id: string): Promise<void> {
  await getActiveSpecies(id);
  await db.species.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createAnimal(
  data: AnimalFormData,
  speciesName: string,
  lotName: string,
  code?: string
): Promise<Animal> {
  const finalCode = code || (await generateAnimalCode());
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  // Antes de crear: un lote o una especie ajenos contaminarían el workspace activo.
  await getActiveSpecies(data.speciesId);
  const lot = await getActiveBreedingLot(data.lotId);
  const animal = buildAnimal({ data: { ...data, speciesName, lotName }, code: finalCode, now });
  animal.workspaceId = workspaceId;
  await db.animals.add(animal);

  await db.breedingLots.update(data.lotId, {
    currentCount: (lot.currentCount ?? 0) + 1,
    updatedAt: now,
    syncStatus: "pending" as const,
  });

  return animal;
}

export async function updateAnimal(
  id: string,
  data: AnimalFormData,
  speciesName: string,
  lotName: string
): Promise<void> {
  const existing = await getActiveAnimal(id);
  if (!canEditAnimal(existing)) throw new Error("No se puede editar este animal");

  await getActiveSpecies(data.speciesId);

  if (existing.lotId !== data.lotId) {
    const oldLot = await getActiveBreedingLot(existing.lotId);
    if (oldLot.currentCount > 0) {
      await db.breedingLots.update(existing.lotId, {
        currentCount: oldLot.currentCount - 1,
        updatedAt: new Date().toISOString(),
        syncStatus: "pending" as const,
      });
    }

    const newLot = await getActiveBreedingLot(data.lotId);
    await db.breedingLots.update(data.lotId, {
      currentCount: (newLot.currentCount ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      syncStatus: "pending" as const,
    });
  }

  await db.animals.update(id, {
    name: data.name.trim(),
    speciesId: data.speciesId,
    speciesName,
    gender: data.gender as Animal["gender"],
    birthDate: data.birthDate,
    lotId: data.lotId,
    lotName,
    status: data.status as Animal["status"],
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteAnimal(id: string): Promise<void> {
  const existing = await getActiveAnimal(id);
  const lot = await getActiveBreedingLot(existing.lotId);
  if (lot.currentCount > 0) {
    await db.breedingLots.update(existing.lotId, {
      currentCount: lot.currentCount - 1,
      updatedAt: new Date().toISOString(),
      syncStatus: "pending" as const,
    });
  }

  await db.animals.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createBreedingLot(data: BreedingLotFormData, code?: string): Promise<BreedingLot> {
  const finalCode = code || (await generateBreedingLotCode());
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  const species = await getActiveSpecies(data.speciesId);
  const lot = buildBreedingLot({ data: { ...data, speciesName: species.name }, code: finalCode, now });
  lot.workspaceId = workspaceId;
  await db.breedingLots.add(lot);
  return lot;
}

export async function updateBreedingLot(id: string, data: BreedingLotFormData): Promise<void> {
  await getActiveBreedingLot(id);
  await getActiveSpecies(data.speciesId);

  await db.breedingLots.update(id, {
    name: data.name.trim(),
    speciesId: data.speciesId,
    location: data.location.trim(),
    capacity: data.capacity,
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteBreedingLot(id: string): Promise<void> {
  await getActiveBreedingLot(id);
  await db.breedingLots.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createFeeding(
  data: FeedingFormData,
  lotName: string,
  code?: string
): Promise<Feeding> {
  const finalCode = code || (await generateFeedingCode());
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  await getActiveBreedingLot(data.lotId);
  const feeding = buildFeeding({ data: { ...data, lotName }, code: finalCode, now });
  feeding.workspaceId = workspaceId;
  await db.feedings.add(feeding);
  return feeding;
}

export async function updateFeeding(id: string, data: FeedingFormData, lotName: string): Promise<void> {
  await getActiveFeeding(id);
  await getActiveBreedingLot(data.lotId);

  await db.feedings.update(id, {
    lotId: data.lotId,
    lotName,
    feedType: data.feedType as Feeding["feedType"],
    feedName: data.feedName.trim(),
    quantity: data.quantity,
    unit: data.unit,
    cost: data.cost,
    feedingDate: data.feedingDate,
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteFeeding(id: string): Promise<void> {
  await getActiveFeeding(id);
  await db.feedings.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createReproduction(
  data: ReproductionFormData,
  animalName: string,
  code?: string
): Promise<Reproduction> {
  const finalCode = code || (await generateReproductionCode());
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  await getActiveAnimal(data.animalId);
  const repro = buildReproduction({ data: { ...data, animalName, targetAnimal: data.targetAnimal || "", result: data.result || "" }, code: finalCode, now });
  repro.workspaceId = workspaceId;
  await db.reproductions.add(repro);
  return repro;
}

export async function updateReproduction(id: string, data: ReproductionFormData, animalName: string): Promise<void> {
  await getActiveReproduction(id);
  await getActiveAnimal(data.animalId);

  await db.reproductions.update(id, {
    animalId: data.animalId,
    animalName,
    event: data.event as Reproduction["event"],
    eventDate: data.eventDate,
    targetAnimal: data.targetAnimal?.trim() || "",
    result: data.result?.trim() || "",
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteReproduction(id: string): Promise<void> {
  await getActiveReproduction(id);
  await db.reproductions.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}

export async function createLivestockProduction(
  data: LivestockProductionFormData,
  lotName: string,
  code?: string
): Promise<LivestockProduction> {
  const finalCode = code || (await generateLivestockProductionCode());
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  await getActiveBreedingLot(data.lotId);
  const prod = buildLivestockProduction({ data: { ...data, lotName }, code: finalCode, now });
  prod.workspaceId = workspaceId;
  await db.livestockProductions.add(prod);
  return prod;
}

export async function updateLivestockProduction(id: string, data: LivestockProductionFormData, lotName: string): Promise<void> {
  await getActiveLivestockProduction(id);
  await getActiveBreedingLot(data.lotId);

  const totalValue = Math.round(data.quantity * data.unitPrice * 100) / 100;

  await db.livestockProductions.update(id, {
    lotId: data.lotId,
    lotName,
    type: data.type as LivestockProduction["type"],
    quantity: data.quantity,
    unit: data.unit,
    unitPrice: data.unitPrice,
    totalValue,
    productionDate: data.productionDate,
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteLivestockProduction(id: string): Promise<void> {
  await getActiveLivestockProduction(id);
  await db.livestockProductions.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}
