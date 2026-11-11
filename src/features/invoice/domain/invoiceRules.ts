import type { InvoiceDraft } from "./types";
import type { OcrItem, OcrResult } from "../schemas/ocrSchema";
import type { PurchaseFormData } from "@/features/purchases/schemas/purchaseSchema";
import type { PurchaseDetailInput } from "@/features/purchases/domain/purchaseRules";
import type { ExpenseFormData } from "@/features/expenses/schemas/expenseSchema";
import type { Product } from "@/types";
import { PAYMENT_METHODS } from "@/features/expenses/domain/expenseRules";
import { normalizeText } from "@/utils/text";

export function canExtractFromImage(draft: InvoiceDraft): boolean {
  return draft.status === "captured";
}

export function canConfirmDraft(draft: InvoiceDraft): boolean {
  return draft.status === "extracted" && draft.ocrResult !== null;
}

export function ocrResultToPurchaseHeader(ocr: OcrResult): PurchaseFormData {
  const today = new Date().toISOString().split("T")[0];
  return {
    supplier: ocr.supplier || "",
    date: ocr.date || today,
    paymentMethod: PAYMENT_METHODS[0],
    notes: ocr.invoiceNumber ? `Factura N° ${ocr.invoiceNumber}` : "",
    status: "pendiente",
  };
}

export function ocrResultToPurchaseDetails(ocr: OcrResult): PurchaseDetailInput[] {
  return ocr.items.map((item) => ({
    productId: "",
    code: "",
    name: item.description,
    color: "",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
}

export function ocrResultToExpenseData(ocr: OcrResult): Partial<ExpenseFormData> {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const total = ocr.total ?? ocr.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const description = ocr.supplier
    ? `Factura ${ocr.supplier}${ocr.invoiceNumber ? ` N° ${ocr.invoiceNumber}` : ""}`
    : `Factura ${ocr.invoiceNumber || today}`;
  return {
    description,
    amount: total,
    categoryId: "",
    paymentMethod: PAYMENT_METHODS[0],
    status: "pagado",
    date: ocr.date || today,
    time,
    notes: "",
  };
}

export function ocrTotalComputed(ocr: OcrResult): number {
  if (ocr.total != null && ocr.total > 0) return ocr.total;
  return ocr.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}

export interface OcrProductMatch {
  details: PurchaseDetailInput[];
  unmatched: string[];
}

type MatchableProduct = Pick<Product, "id" | "code" | "name" | "color">;

// Los ítems del OCR son texto libre: se emparejan por nombre o código y se
// agrupan por producto. Los que no coinciden se devuelven aparte para avisar
// al usuario; nunca se inventan productos.
export function matchOcrItemsToProducts(
  items: OcrItem[],
  products: MatchableProduct[],
): OcrProductMatch {
  const details: PurchaseDetailInput[] = [];
  const unmatched: string[] = [];

  for (const item of items) {
    const needle = normalizeText(item.description);
    if (!needle) continue;

    const product = products.find((candidate) => {
      const name = normalizeText(candidate.name);
      const code = normalizeText(candidate.code);
      return name === needle || code === needle || name.includes(needle) || needle.includes(name);
    });

    if (!product) {
      unmatched.push(item.description);
      continue;
    }

    const existing = details.find((detail) => detail.productId === product.id);
    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    details.push({
      productId: product.id,
      code: product.code,
      name: product.name,
      color: product.color,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    });
  }

  return { details, unmatched };
}
