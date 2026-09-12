import { z } from "zod";
import {
  SPECIES_CATEGORIES,
  FEED_TYPES,
  REPRO_EVENTS,
  PRODUCTION_TYPES,
  ANIMAL_STATUSES,
  ANIMAL_GENDERS,
  FEEDING_UNITS,
  PRODUCTION_UNITS,
} from "../domain/breedingRules";

export const speciesSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre de la especie es obligatorio")
    .max(100, "El nombre es demasiado largo"),
  category: z.enum(SPECIES_CATEGORIES as unknown as [string, ...string[]], {
    message: "Selecciona una categoría",
  }),
  unit: z
    .string()
    .trim()
    .min(1, "La unidad es obligatoria")
    .max(30, "La unidad es demasiado larga"),
  notes: z.string().optional(),
});

export type SpeciesFormData = z.infer<typeof speciesSchema>;

export const animalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del animal es obligatorio")
    .max(200, "El nombre es demasiado largo"),
  speciesId: z.string().min(1, "Selecciona una especie"),
  gender: z.enum(ANIMAL_GENDERS as unknown as [string, ...string[]], {
    message: "Selecciona el género",
  }),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona la fecha de nacimiento"),
  lotId: z.string().min(1, "Selecciona un lote"),
  status: z.enum(ANIMAL_STATUSES as unknown as [string, ...string[]], {
    message: "Selecciona un estado",
  }),
  notes: z.string().optional(),
});

export type AnimalFormData = z.infer<typeof animalSchema>;

export const breedingLotSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del lote es obligatorio")
    .max(200, "El nombre es demasiado largo"),
  speciesId: z.string().min(1, "Selecciona una especie"),
  location: z
    .string()
    .trim()
    .min(1, "La ubicación es obligatoria")
    .max(200, "La ubicación es demasiado larga"),
  capacity: z.coerce
    .number({ invalid_type_error: "La capacidad es obligatoria" })
    .positive("La capacidad debe ser mayor a 0"),
  notes: z.string().optional(),
});

export type BreedingLotFormData = z.infer<typeof breedingLotSchema>;

export const feedingSchema = z.object({
  lotId: z.string().min(1, "Selecciona un lote"),
  feedType: z.enum(FEED_TYPES as unknown as [string, ...string[]], {
    message: "Selecciona el tipo de alimento",
  }),
  feedName: z
    .string()
    .trim()
    .min(1, "El nombre del alimento es obligatorio")
    .max(200, "El nombre es demasiado largo"),
  quantity: z.coerce
    .number({ invalid_type_error: "La cantidad es obligatoria" })
    .positive("La cantidad debe ser mayor a 0"),
  unit: z.enum(FEEDING_UNITS as unknown as [string, ...string[]], {
    message: "Selecciona una unidad",
  }),
  cost: z.coerce
    .number({ invalid_type_error: "El costo es obligatorio" })
    .min(0, "El costo no puede ser negativo"),
  feedingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona la fecha de alimentación"),
  notes: z.string().optional(),
});

export type FeedingFormData = z.infer<typeof feedingSchema>;

export const reproductionSchema = z.object({
  animalId: z.string().min(1, "Selecciona un animal"),
  event: z.enum(REPRO_EVENTS as unknown as [string, ...string[]], {
    message: "Selecciona el evento reproductivo",
  }),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona la fecha del evento"),
  targetAnimal: z.string().optional(),
  result: z.string().optional(),
  notes: z.string().optional(),
});

export type ReproductionFormData = z.infer<typeof reproductionSchema>;

export const livestockProductionSchema = z.object({
  lotId: z.string().min(1, "Selecciona un lote"),
  type: z.enum(PRODUCTION_TYPES as unknown as [string, ...string[]], {
    message: "Selecciona el tipo de producción",
  }),
  quantity: z.coerce
    .number({ invalid_type_error: "La cantidad es obligatoria" })
    .positive("La cantidad debe ser mayor a 0"),
  unit: z.enum(PRODUCTION_UNITS as unknown as [string, ...string[]], {
    message: "Selecciona una unidad",
  }),
  unitPrice: z.coerce
    .number({ invalid_type_error: "El precio unitario es obligatorio" })
    .min(0, "El precio no puede ser negativo"),
  productionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona la fecha de producción"),
  notes: z.string().optional(),
});

export type LivestockProductionFormData = z.infer<typeof livestockProductionSchema>;
