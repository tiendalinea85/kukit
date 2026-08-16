import { z } from "zod";
import { EXPENSE_STATUSES, PAYMENT_METHODS } from "../domain/expenseRules.ts";

export const expenseSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria")
    .max(500, "La descripción es demasiado larga"),
  amount: z.coerce
    .number({ invalid_type_error: "El monto es obligatorio" })
    .positive("El monto debe ser mayor a 0"),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: "Selecciona un método de pago" }),
  status: z.enum(EXPENSE_STATUSES, { message: "Selecciona un estado" }).default("pagado"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha"),
  time: z.string().min(1, "Selecciona una hora"),
  notes: z.string().optional(),
  receiptPhoto: z.string().optional(),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;
