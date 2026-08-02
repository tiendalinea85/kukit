import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  color: z.string().min(1, "Selecciona un color"),
  icon: z.string().min(1, "Selecciona un icono"),
});

export type CategoryFormData = z.infer<typeof categorySchema>;
