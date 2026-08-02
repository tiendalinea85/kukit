import { z } from "zod";

export const typeSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
});

export type TypeFormData = z.infer<typeof typeSchema>;
