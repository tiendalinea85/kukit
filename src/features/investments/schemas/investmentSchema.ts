import { z } from "zod";
import { INVESTMENT_STATUSES } from "../domain/investmentRules.ts";
import { PAYMENT_METHODS } from "../../expenses/domain/expenseRules.ts";

export const investmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(200, "El nombre es demasiado largo"),
  value: z.coerce
    .number({ invalid_type_error: "El valor es obligatorio" })
    .positive("El valor debe ser mayor a 0"),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  supplier: z.string().trim().max(200, "El proveedor es demasiado largo").optional(),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: "Selecciona un método de pago" }),
  status: z.enum(INVESTMENT_STATUSES, { message: "Selecciona un estado" }).default("pagado"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha"),
  notes: z.string().max(500, "Las observaciones son demasiado largas").optional(),
});

export type InvestmentFormData = z.infer<typeof investmentSchema>;
