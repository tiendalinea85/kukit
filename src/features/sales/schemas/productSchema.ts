import { z } from "zod";

export const productSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "El código es obligatorio")
    .max(30, "El código es demasiado largo"),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre es demasiado largo"),
  color: z
    .string()
    .trim()
    .max(50, "El color es demasiado largo")
    .optional(),
  categoryId: z
    .string()
    .max(50, "La categoría es demasiado larga")
    .optional(),
});

// El stock inicial NO se guarda en el producto: genera un movimiento
// de entrada tipo "inventario_inicial".
export const productWithStockSchema = productSchema.extend({
  initialStock: z.coerce
    .number({ invalid_type_error: "Stock inicial inválido" })
    .min(0, "El stock no puede ser negativo")
    .optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;
export type ProductWithStockFormData = z.infer<typeof productWithStockSchema>;
