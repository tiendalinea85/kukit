import { db } from "@/lib/db";
import type { InvoiceDraft, InvoiceDraftStatus, InvoiceDraftTarget } from "../domain/types";
import type { OcrResult } from "../schemas/ocrSchema";

function now(): string {
  return new Date().toISOString();
}

export async function createDraft(photoBase64: string): Promise<InvoiceDraft> {
  const t = now();
  const draft: InvoiceDraft = {
    id: crypto.randomUUID(),
    photoBase64,
    status: "captured",
    target: null,
    ocrResult: null,
    extractedAt: null,
    createdAt: t,
    updatedAt: t,
  };
  await db.invoiceDrafts.add(draft);
  return draft;
}

export async function getDraft(id: string): Promise<InvoiceDraft | undefined> {
  return db.invoiceDrafts.get(id);
}

export async function updateDraftOcr(
  id: string,
  ocrResult: OcrResult,
): Promise<void> {
  await db.invoiceDrafts.update(id, {
    ocrResult,
    status: "extracted",
    extractedAt: now(),
    updatedAt: now(),
  });
}

export async function setDraftTarget(
  id: string,
  target: InvoiceDraftTarget,
): Promise<void> {
  await db.invoiceDrafts.update(id, {
    target,
    updatedAt: now(),
  });
}

export async function confirmDraft(id: string): Promise<void> {
  await db.invoiceDrafts.update(id, {
    status: "confirmed",
    updatedAt: now(),
  });
}

export async function discardDraft(id: string): Promise<void> {
  await db.invoiceDrafts.update(id, {
    status: "discarded",
    updatedAt: now(),
  });
}

export async function deleteDraft(id: string): Promise<void> {
  await db.invoiceDrafts.delete(id);
}

export async function listActiveDrafts(): Promise<InvoiceDraft[]> {
  const all = await db.invoiceDrafts.orderBy("createdAt").reverse().toArray();
  return all.filter((d) => d.status !== "discarded" && d.status !== "confirmed");
}
