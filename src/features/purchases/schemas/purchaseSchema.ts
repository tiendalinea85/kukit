import { z } from "zod";
import { PURCHASE_STATUSES } from "../domain/purchaseRules.ts";
import { PAYMENT_METHODS } from "../../expenses/domain/expenseRules.ts";

export const purchaseSchema = z.object({
  supplier: z
    .string()
    .trim()
    .min(1, "El proveedor es obligatorio")
    .max(200, "El proveedor es demasiado largo"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha"),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: "Selecciona un método de pago" }),
  notes: z.string().max(500, "Las observaciones son demasiado largas").optional(),
  status: z.enum(PURCHASE_STATUSES, { message: "Selecciona un estado" }).default("pendiente"),
});

export type PurchaseFormData = z.infer<typeof purchaseSchema>;

export const purchaseDetailSchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  quantity: z.coerce
    .number({ invalid_type_error: "Cantidad inválida" })
    .positive("La cantidad debe ser mayor a 0"),
  unitPrice: z.coerce
    .number({ invalid_type_error: "Precio inválido" })
    .min(0, "El precio no puede ser negativo"),
});

export type PurchaseDetailFormData = z.infer<typeof purchaseDetailSchema>;
