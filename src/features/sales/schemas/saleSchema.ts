import { z } from "zod";
import { PAYMENT_METHODS } from "../../expenses/domain/expenseRules.ts";

export const saleSchema = z.object({
  customerId: z.string().min(1, "Selecciona un cliente"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha"),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: "Selecciona un método de pago" }),
  notes: z.string().optional(),
});

export type SaleFormData = z.infer<typeof saleSchema>;

export const saleDetailSchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  quantity: z.coerce
    .number({ invalid_type_error: "Cantidad inválida" })
    .positive("La cantidad debe ser mayor a 0"),
  unitPrice: z.coerce
    .number({ invalid_type_error: "Precio inválido" })
    .min(0, "El precio no puede ser negativo"),
});

export type SaleDetailFormData = z.infer<typeof saleDetailSchema>;
