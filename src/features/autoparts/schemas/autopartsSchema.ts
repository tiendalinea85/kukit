import { z } from "zod";

export const vehicleBrandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre de la marca es obligatorio")
    .max(100, "El nombre es demasiado largo"),
  country: z
    .string()
    .trim()
    .min(1, "El país es obligatorio")
    .max(100, "El país es demasiado largo"),
});

export type VehicleBrandFormData = z.infer<typeof vehicleBrandSchema>;

export const vehicleModelSchema = z.object({
  brandId: z.string().min(1, "Selecciona una marca"),
  name: z
    .string()
    .trim()
    .min(1, "El nombre del modelo es obligatorio")
    .max(100, "El nombre es demasiado largo"),
  startYear: z.coerce
    .number({ invalid_type_error: "El año de inicio es obligatorio" })
    .int("Debe ser un año válido")
    .min(1900, "Año no válido")
    .max(2100, "Año no válido"),
  endYear: z.coerce
    .number({ invalid_type_error: "Ingresa un año válido" })
    .int("Debe ser un año válido")
    .min(1900, "Año no válido")
    .max(2100, "Año no válido")
    .nullable()
    .optional(),
  engine: z.string().trim().max(100, "El motor es demasiado largo").optional().default(""),
  notes: z.string().optional(),
});

export type VehicleModelFormData = z.infer<typeof vehicleModelSchema>;

export const autoPartSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del repuesto es obligatorio")
    .max(200, "El nombre es demasiado largo"),
  partNumber: z
    .string()
    .trim()
    .min(1, "El número de parte es obligatorio")
    .max(100, "El número de parte es demasiado largo"),
  brand: z.string().trim().max(100, "La marca es demasiado larga").optional().default(""),
  category: z.string().min(1, "Selecciona una categoría"),
  unitPrice: z.coerce
    .number({ invalid_type_error: "El precio de venta es obligatorio" })
    .min(0, "El precio no puede ser negativo"),
  costPrice: z.coerce
    .number({ invalid_type_error: "El precio de costo es obligatorio" })
    .min(0, "El precio no puede ser negativo"),
  stock: z.coerce
    .number({ invalid_type_error: "El stock es obligatorio" })
    .int("Debe ser un número entero")
    .min(0, "El stock no puede ser negativo"),
  minStock: z.coerce
    .number({ invalid_type_error: "El stock mínimo es obligatorio" })
    .int("Debe ser un número entero")
    .min(0, "El stock mínimo no puede ser negativo"),
  notes: z.string().optional(),
});

export type AutoPartFormData = z.infer<typeof autoPartSchema>;

export const partCompatibilitySchema = z.object({
  partId: z.string().min(1, "Selecciona un repuesto"),
  modelId: z.string().min(1, "Selecciona un modelo"),
  yearFrom: z.coerce
    .number({ invalid_type_error: "El año desde es obligatorio" })
    .int("Debe ser un año válido")
    .min(1900, "Año no válido")
    .max(2100, "Año no válido"),
  yearTo: z.coerce
    .number({ invalid_type_error: "Ingresa un año válido" })
    .int("Debe ser un año válido")
    .min(1900, "Año no válido")
    .max(2100, "Año no válido")
    .nullable()
    .optional(),
  engine: z.string().trim().max(100, "El motor es demasiado largo").optional().default(""),
  notes: z.string().optional(),
});

export type PartCompatibilityFormData = z.infer<typeof partCompatibilitySchema>;
