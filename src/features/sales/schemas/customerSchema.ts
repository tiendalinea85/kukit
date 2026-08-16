import { z } from "zod";

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre es demasiado largo"),
  phone: z
    .string()
    .trim()
    .max(20, "El teléfono es demasiado largo")
    .optional(),
  address: z
    .string()
    .trim()
    .max(200, "La dirección es demasiado larga")
    .optional(),
  notes: z
    .string()
    .trim()
    .max(500, "Las observaciones son demasiado largas")
    .optional(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
