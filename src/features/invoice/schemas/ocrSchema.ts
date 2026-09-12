import { z } from "zod";

export const ocrItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().min(0),
});

export const ocrResultSchema = z.object({
  supplier: z.string().optional(),
  invoiceNumber: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD")
    .optional(),
  items: z.array(ocrItemSchema).default([]),
  total: z.coerce.number().min(0).optional(),
  currency: z.string().default("USD"),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export type OcrItem = z.infer<typeof ocrItemSchema>;
export type OcrResult = z.infer<typeof ocrResultSchema>;
