import { z } from "zod";

export const voiceExpenseDetailSchema = z.object({
  productName: z.string().min(1),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().positive(),
});

export const addExpenseIntentSchema = z.object({
  intent: z.literal("add_expense"),
  amount: z.coerce.number().positive(),
  currency: z.string().default("USD"),
  category: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD")
    .optional(),
  details: z.array(voiceExpenseDetailSchema).optional(),
});

export const queryReportIntentSchema = z.object({
  intent: z.literal("query_report"),
  metric: z.enum(["total", "average", "count", "breakdown"]).default("total"),
  category: z.string().optional(),
  period: z
    .enum(["today", "this_week", "this_month", "this_year", "custom"])
    .default("this_month"),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD")
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD")
    .optional(),
});

export const deleteExpenseIntentSchema = z.object({
  intent: z.literal("delete_expense"),
  reference: z.string().min(1),
});

export const navigateIntentSchema = z.object({
  intent: z.literal("navigate"),
  target: z.string().min(1),
});

export const unclearIntentSchema = z.object({
  intent: z.literal("unclear"),
  reason: z.string().default(""),
});

export const voiceIntentSchema = z.discriminatedUnion("intent", [
  addExpenseIntentSchema,
  queryReportIntentSchema,
  deleteExpenseIntentSchema,
  navigateIntentSchema,
  unclearIntentSchema,
]);

export type VoiceIntent = z.infer<typeof voiceIntentSchema>;
export type AddExpenseIntent = z.infer<typeof addExpenseIntentSchema>;
export type QueryReportIntent = z.infer<typeof queryReportIntentSchema>;
export type DeleteExpenseIntent = z.infer<typeof deleteExpenseIntentSchema>;
export type NavigateIntent = z.infer<typeof navigateIntentSchema>;
export type UnclearIntent = z.infer<typeof unclearIntentSchema>;
