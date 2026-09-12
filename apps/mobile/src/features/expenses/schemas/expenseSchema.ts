import { z } from 'zod';

export const EXPENSE_STATUSES = ['activo', 'pendiente', 'pagado', 'cancelado'] as const;

export const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia', 'otro'] as const;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const expenseSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200, 'El nombre es demasiado largo'),
  description: z.string().trim().max(500, 'La descripción es demasiado larga').optional(),
  amount: z.coerce
    .number({ message: 'El monto es obligatorio' })
    .nonnegative('El monto no puede ser negativo'),
  category_id: z.string().nullable().optional(),
  type_id: z.string().nullable().optional(),
  payment_method: z.enum(PAYMENT_METHODS, { message: 'Selecciona un método de pago' }),
  status: z.enum(EXPENSE_STATUSES, { message: 'Selecciona un estado' }).default('activo'),
  date: z.string().regex(DATE_RE, 'Selecciona una fecha'),
  time: z.string().min(1, 'Selecciona una hora'),
  notes: z.string().max(1000, 'Las observaciones son demasiado largas').optional(),
  details: z
    .array(
      z.object({
        product_name: z.string().trim().min(1, 'El detalle necesita un nombre'),
        quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
        unit_price: z.coerce.number().nonnegative('El precio no puede ser negativo'),
      })
    )
    .optional(),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;

export const expenseDetailSchema = z.object({
  product_name: z.string().trim().min(1, 'El detalle necesita un nombre'),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  unit_price: z.coerce.number().nonnegative('El precio no puede ser negativo'),
});
