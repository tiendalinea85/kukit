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

export async function createSpecies(data: SpeciesFormData): Promise<Species> {
  const now = new Date().toISOString();
  const workspaceId = getWorkspaceId();
  const species = buildSpecies({ data, now });
  species.workspaceId = workspaceId;
  await db.species.add(species);
  return species;
}

export async function updateSpecies(id: string, data: SpeciesFormData): Promise<void> {
  const existing = await db.species.get(id);
  if (!existing) throw new Error("Especie no encontrada");

  await db.species.update(id, {
    name: data.name.trim(),
    category: data.category as Species["category"],
    unit: data.unit.trim(),
    notes: data.notes || "",
    syncStatus: "pending" as const,
  });
}

export async function deleteSpecies(id: string): Promise<void> {
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
  const animal = buildAnimal({ data: { ...data, speciesName, lotName }, code: finalCode, now });
  animal.workspaceId = workspaceId;
  await db.animals.add(animal);

  const lot = await db.breedingLots.get(data.lotId);
  if (lot) {
    await db.breedingLots.update(data.lotId, {
      currentCount: (lot.currentCount ?? 0) + 1,
      updatedAt: now,
      syncStatus: "pending" as const,
    });
  }

  return animal;
}

export async function updateAnimal(
  id: string,
  data: AnimalFormData,
  speciesName: string,
  lotName: string
): Promise<void> {
  const existing = await db.animals.get(id);
  if (!existing) throw new Error("Animal no encontrado");
  if (!canEditAnimal(existing)) throw new Error("No se puede editar este animal");

  if (existing.lotId !== data.lotId) {
    const oldLot = await db.breedingLots.get(existing.lotId);
    if (oldLot && oldLot.currentCount > 0) {
      await db.breedingLots.update(existing.lotId, {
        currentCount: oldLot.currentCount - 1,
        updatedAt: new Date().toISOString(),
        syncStatus: "pending" as const,
      });
    }

    const newLot = await db.breedingLots.get(data.lotId);
    if (newLot) {
      await db.breedingLots.update(data.lotId, {
        currentCount: (newLot.currentCount ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        syncStatus: "pending" as const,
      });
    }
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
  const existing = await db.animals.get(id);
  if (existing) {
    const lot = await db.breedingLots.get(existing.lotId);
    if (lot && lot.currentCount > 0) {
      await db.breedingLots.update(existing.lotId, {
        currentCount: lot.currentCount - 1,
        updatedAt: new Date().toISOString(),
        syncStatus: "pending" as const,
      });
    }
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
  const species = await db.species.get(data.speciesId);
  const lot = buildBreedingLot({ data: { ...data, speciesName: species?.name || "" }, code: finalCode, now });
  lot.workspaceId = workspaceId;
  await db.breedingLots.add(lot);
  return lot;
}

export async function updateBreedingLot(id: string, data: BreedingLotFormData): Promise<void> {
  const existing = await db.breedingLots.get(id);
  if (!existing) throw new Error("Lote no encontrado");

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
  const feeding = buildFeeding({ data: { ...data, lotName }, code: finalCode, now });
  feeding.workspaceId = workspaceId;
  await db.feedings.add(feeding);
  return feeding;
}

export async function updateFeeding(id: string, data: FeedingFormData, lotName: string): Promise<void> {
  const existing = await db.feedings.get(id);
  if (!existing) throw new Error("Alimentación no encontrada");

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
  const repro = buildReproduction({ data: { ...data, animalName, targetAnimal: data.targetAnimal || "", result: data.result || "" }, code: finalCode, now });
  repro.workspaceId = workspaceId;
  await db.reproductions.add(repro);
  return repro;
}

export async function updateReproduction(id: string, data: ReproductionFormData, animalName: string): Promise<void> {
  const existing = await db.reproductions.get(id);
  if (!existing) throw new Error("Reproducción no encontrada");

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
  const prod = buildLivestockProduction({ data: { ...data, lotName }, code: finalCode, now });
  prod.workspaceId = workspaceId;
  await db.livestockProductions.add(prod);
  return prod;
}

export async function updateLivestockProduction(id: string, data: LivestockProductionFormData, lotName: string): Promise<void> {
  const existing = await db.livestockProductions.get(id);
  if (!existing) throw new Error("Producción no encontrada");

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
  await db.livestockProductions.update(id, {
    deleted: true,
    syncStatus: "pending" as const,
  });
}
