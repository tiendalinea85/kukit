import { z } from "zod";

export const expenseDetailSchema = z.object({
  id: z.string(),
  productName: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  subtotal: z.number(),
});

export const expenseSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  amount: z.coerce.number().optional(),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  typeId: z.string().min(1, "Selecciona un tipo"),
  paymentMethod: z.string().min(1, "Selecciona un método de pago"),
  status: z.enum(["activo", "pagado", "pendiente", "cancelado"]),
  date: z.string().min(1, "Selecciona una fecha"),
  time: z.string().min(1, "Selecciona una hora"),
  notes: z.string().optional(),
  invoicePhoto: z.string().optional(),
  hasDetails: z.boolean().default(false),
  details: z.array(expenseDetailSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.hasDetails) {
    if (!data.details || data.details.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe agregar al menos un concepto",
        path: ["details"],
      });
    }
    if (data.details?.some((d) => d.quantity < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Las cantidades no pueden ser negativas",
        path: ["details"],
      });
    }
    if (data.details?.some((d) => d.unitPrice < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Los precios no pueden ser negativos",
        path: ["details"],
      });
    }
  } else {
    if (!data.amount || data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El monto debe ser mayor a 0",
        path: ["amount"],
      });
    }
  }
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type ExpenseDetailFormData = z.infer<typeof expenseDetailSchema>;
