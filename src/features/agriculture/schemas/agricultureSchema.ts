import { z } from "zod";
import { CROP_STATUSES, AGRO_INPUT_TYPES, LABOR_TYPES, HARVEST_QUALITY } from "../domain/agricultureRules";

export const cropSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del cultivo es obligatorio")
    .max(200, "El nombre es demasiado largo"),
  description: z.string().optional(),
  season: z
    .string()
    .trim()
    .min(1, "La temporada es obligatoria")
    .max(100, "La temporada es demasiado larga"),
  status: z.enum(CROP_STATUSES, { message: "Selecciona un estado" }).default("activa"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha de inicio"),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

export type CropFormData = z.infer<typeof cropSchema>;

export const farmLotSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del lote es obligatorio")
    .max(200, "El nombre es demasiado largo"),
  area: z.coerce
    .number({ invalid_type_error: "El área es obligatoria" })
    .positive("El área debe ser mayor a 0"),
  areaUnit: z
    .string()
    .trim()
    .min(1, "La unidad de área es obligatoria"),
  location: z.string().optional(),
  soilType: z.string().optional(),
  notes: z.string().optional(),
});

export type FarmLotFormData = z.infer<typeof farmLotSchema>;

export const agroInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del insumo es obligatorio")
    .max(200, "El nombre es demasiado largo"),
  type: z.enum(AGRO_INPUT_TYPES, { message: "Selecciona un tipo de insumo" }),
  unit: z
    .string()
    .trim()
    .min(1, "La unidad es obligatoria"),
  costPerUnit: z.coerce
    .number({ invalid_type_error: "El costo es obligatorio" })
    .min(0, "El costo no puede ser negativo"),
  stock: z.coerce
    .number({ invalid_type_error: "El stock es obligatorio" })
    .min(0, "El stock no puede ser negativo"),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

export type AgroInputFormData = z.infer<typeof agroInputSchema>;

export const applicationSchema = z.object({
  cropId: z.string().min(1, "Selecciona un cultivo"),
  lotId: z.string().min(1, "Selecciona un lote"),
  inputId: z.string().min(1, "Selecciona un insumo"),
  quantity: z.coerce
    .number({ invalid_type_error: "La cantidad es obligatoria" })
    .positive("La cantidad debe ser mayor a 0"),
  applicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha de aplicación"),
  notes: z.string().optional(),
});

export type ApplicationFormData = z.infer<typeof applicationSchema>;

export const laborSchema = z.object({
  cropId: z.string().min(1, "Selecciona un cultivo"),
  lotId: z.string().min(1, "Selecciona un lote"),
  type: z.enum(LABOR_TYPES as unknown as [string, ...string[]], { message: "Selecciona un tipo de labor" }),
  description: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria")
    .max(500, "La descripción es demasiado larga"),
  laborDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha de labor"),
  laborCost: z.coerce
    .number({ invalid_type_error: "El costo es obligatorio" })
    .min(0, "El costo no puede ser negativo"),
  workerCount: z.coerce
    .number({ invalid_type_error: "El número de trabajadores es obligatorio" })
    .int("Debe ser un número entero")
    .min(1, "Debe haber al menos 1 trabajador"),
  notes: z.string().optional(),
});

export type LaborFormData = z.infer<typeof laborSchema>;

export const harvestSchema = z.object({
  cropId: z.string().min(1, "Selecciona un cultivo"),
  lotId: z.string().min(1, "Selecciona un lote"),
  product: z
    .string()
    .trim()
    .min(1, "El nombre del producto es obligatorio")
    .max(200, "El nombre es demasiado largo"),
  quantity: z.coerce
    .number({ invalid_type_error: "La cantidad es obligatoria" })
    .positive("La cantidad debe ser mayor a 0"),
  unit: z
    .string()
    .trim()
    .min(1, "La unidad es obligatoria"),
  unitPrice: z.coerce
    .number({ invalid_type_error: "El precio unitario es obligatorio" })
    .min(0, "El precio no puede ser negativo"),
  harvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha de cosecha"),
  quality: z.enum(HARVEST_QUALITY, { message: "Selecciona una calidad" }),
  notes: z.string().optional(),
});

export type HarvestFormData = z.infer<typeof harvestSchema>;
