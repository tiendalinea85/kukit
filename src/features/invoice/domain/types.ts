import type { OcrResult } from "../schemas/ocrSchema";

export type InvoiceDraftStatus = "captured" | "extracted" | "confirmed" | "discarded";
export type InvoiceDraftTarget = "purchase" | "expense";

export interface InvoiceDraft {
  id: string;
  photoBase64: string;
  status: InvoiceDraftStatus;
  target: InvoiceDraftTarget | null;
  ocrResult: OcrResult | null;
  extractedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
