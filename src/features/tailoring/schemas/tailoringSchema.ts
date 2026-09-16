import { z } from "zod";
import { MATERIAL_UNITS } from "../domain/tailoringRules";

export const garmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(200, "El nombre es demasiado largo"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  salePrice: z.coerce
    .number({ invalid_type_error: "El precio es obligatorio" })
    .min(0, "El precio no puede ser negativo"),
  notes: z.string().optional(),
});

export type GarmentFormData = z.infer<typeof garmentSchema>;

export const sizeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(50, "El nombre es demasiado largo"),
  sortOrder: z.coerce.number().int().min(0),
});

export type SizeFormData = z.infer<typeof sizeSchema>;

export const colorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre es demasiado largo"),
  hex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color hexadecimal inválido"),
});

export type ColorFormData = z.infer<typeof colorSchema>;

export const materialSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(200, "El nombre es demasiado largo"),
  unit: z.enum(MATERIAL_UNITS, { message: "Selecciona una unidad" }),
  costPerUnit: z.coerce
    .number({ invalid_type_error: "El costo es obligatorio" })
    .min(0, "El costo no puede ser negativo"),
  stock: z.coerce
    .number({ invalid_type_error: "El stock es obligatorio" })
    .min(0, "El stock no puede ser negativo"),
  notes: z.string().optional(),
});

export type MaterialFormData = z.infer<typeof materialSchema>;

export const productionMaterialSchema = z.object({
  materialId: z.string().min(1, "Selecciona un material"),
  quantity: z.coerce
    .number({ invalid_type_error: "La cantidad es obligatoria" })
    .positive("La cantidad debe ser mayor a 0"),
  unitCost: z.coerce
    .number({ invalid_type_error: "El costo es obligatorio" })
    .min(0, "El costo no puede ser negativo"),
});

export type ProductionMaterialFormData = z.infer<typeof productionMaterialSchema>;

export const productionOrderSchema = z.object({
  garmentId: z.string().min(1, "Selecciona una prenda"),
  sizeId: z.string().min(1, "Selecciona una talla"),
  colorId: z.string().min(1, "Selecciona un color"),
  quantity: z.coerce
    .number({ invalid_type_error: "La cantidad es obligatoria" })
    .positive("La cantidad debe ser mayor a 0"),
  unitCost: z.coerce
    .number({ invalid_type_error: "El costo unitario es obligatorio" })
    .min(0, "El costo no puede ser negativo"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha de inicio"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha de vencimiento"),
  notes: z.string().optional(),
});

export type ProductionOrderFormData = z.infer<typeof productionOrderSchema>;
