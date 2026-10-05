import { z } from "zod";
import { isTextIcon } from "../domain/customIconRules";

export const categorySchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  color: z.string().min(1, "Selecciona un color"),
  // Un icono válido es un emoji corto o una imagen propia en data URL.
  icon: z
    .string()
    .min(1, "Selecciona un icono")
    .refine((icon) => isTextIcon(icon) || icon.startsWith("data:image/"), {
      message: "El icono no es válido",
    }),
});

export type CategoryFormData = z.infer<typeof categorySchema>;