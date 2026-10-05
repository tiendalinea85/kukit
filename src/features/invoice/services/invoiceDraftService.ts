import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { InvoiceDraft, InvoiceDraftTarget } from "../domain/types";
import type { OcrResult } from "../schemas/ocrSchema";

function now(): string {
  return new Date().toISOString();
}

function getWorkspaceId(): string {
  return useWorkspaceStore.getState().activeWorkspaceId ?? "default";
}

// Los borradores son de solo lectura local, así que los que no tienen workspace
// (creados antes de la migración) se consideran del espacio actual y no se
// pierden: aplica el mismo criterio que `withWorkspace` en el pull del sync.
function belongsToActiveWorkspace(draft: InvoiceDraft): boolean {
  return !draft.workspaceId || draft.workspaceId === getWorkspaceId();
}

async function getActiveDraft(id: string): Promise<InvoiceDraft> {
  const draft = await db.invoiceDrafts.get(id);
  if (!draft || !belongsToActiveWorkspace(draft)) throw new Error("Borrador no encontrado");
  return draft;
}

export async function createDraft(photoBase64: string): Promise<InvoiceDraft> {
  const t = now();
  const draft: InvoiceDraft = {
    id: crypto.randomUUID(),
    workspaceId: getWorkspaceId(),
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
  const draft = await db.invoiceDrafts.get(id);
  return draft && belongsToActiveWorkspace(draft) ? draft : undefined;
}

export async function updateDraftOcr(
  id: string,
  ocrResult: OcrResult,
): Promise<void> {
  await getActiveDraft(id);
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
  await getActiveDraft(id);
  await db.invoiceDrafts.update(id, {
    target,
    updatedAt: now(),
  });
}

export async function confirmDraft(id: string): Promise<void> {
  await getActiveDraft(id);
  await db.invoiceDrafts.update(id, {
    status: "confirmed",
    updatedAt: now(),
  });
}

export async function discardDraft(id: string): Promise<void> {
  await getActiveDraft(id);
  await db.invoiceDrafts.update(id, {
    status: "discarded",
    updatedAt: now(),
  });
}

export async function deleteDraft(id: string): Promise<void> {
  await getActiveDraft(id);
  await db.invoiceDrafts.delete(id);
}

export async function listActiveDrafts(): Promise<InvoiceDraft[]> {
  const all = await db.invoiceDrafts.orderBy("createdAt").reverse().toArray();
  return all.filter(
    (d) =>
      belongsToActiveWorkspace(d) && d.status !== "discarded" && d.status !== "confirmed",
  );
}
