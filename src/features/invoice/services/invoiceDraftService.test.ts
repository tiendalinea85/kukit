import "fake-indexeddb/auto";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createDraft,
  getDraft,
  updateDraftOcr,
  setDraftTarget,
  confirmDraft,
  discardDraft,
  deleteDraft,
  listActiveDrafts,
} from "./invoiceDraftService.ts";
import { db } from "@/lib/db";
import type { OcrResult } from "../schemas/ocrSchema.ts";

const photoBase64 = "data:image/jpeg;base64,/9j/4AAQ";

const sampleOcr: OcrResult = {
  supplier: "Ferretería Central",
  invoiceNumber: "FAC-001",
  date: "2026-08-10",
  items: [
    { description: "Tornillo 1/4", quantity: 10, unitPrice: 0.5 },
    { description: "Clavo 2\"", quantity: 20, unitPrice: 0.3 },
  ],
  total: 11,
  currency: "USD",
  confidence: "high",
};

beforeEach(async () => {
  await db.invoiceDrafts.clear();
});

describe("createDraft", () => {
  it("crea un borrador con status captured y almacena photoBase64", async () => {
    const draft = await createDraft(photoBase64);
    assert.equal(draft.status, "captured");
    assert.equal(draft.photoBase64, photoBase64);
    assert.equal(draft.id.length > 0, true);
  });

  it("establece timestamps createdAt y updatedAt", async () => {
    const draft = await createDraft(photoBase64);
    assert.ok(draft.createdAt);
    assert.ok(draft.updatedAt);
    assert.equal(draft.createdAt, draft.updatedAt);
  });

  it("inicializa ocrResult y extractedAt como null", async () => {
    const draft = await createDraft(photoBase64);
    assert.equal(draft.ocrResult, null);
    assert.equal(draft.extractedAt, null);
    assert.equal(draft.target, null);
  });
});

describe("getDraft", () => {
  it("recupera un borrador por id", async () => {
    const created = await createDraft(photoBase64);
    const fetched = await getDraft(created.id);
    assert.ok(fetched);
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.photoBase64, photoBase64);
  });

  it("retorna undefined para id inexistente", async () => {
    const fetched = await getDraft("non-existent-id");
    assert.equal(fetched, undefined);
  });
});

describe("updateDraftOcr", () => {
  it("establece status extracted y almacena ocrResult", async () => {
    const draft = await createDraft(photoBase64);
    await updateDraftOcr(draft.id, sampleOcr);
    const updated = await getDraft(draft.id);
    assert.ok(updated);
    assert.equal(updated.status, "extracted");
    assert.deepEqual(updated.ocrResult, sampleOcr);
  });

  it("establece extractedAt con timestamp válido", async () => {
    const draft = await createDraft(photoBase64);
    const before = new Date().toISOString();
    await updateDraftOcr(draft.id, sampleOcr);
    const updated = await getDraft(draft.id);
    assert.ok(updated);
    assert.ok(updated.extractedAt);
    assert.ok(updated.extractedAt! >= before);
  });
});

describe("setDraftTarget", () => {
  it("establece target a purchase", async () => {
    const draft = await createDraft(photoBase64);
    await setDraftTarget(draft.id, "purchase");
    const updated = await getDraft(draft.id);
    assert.ok(updated);
    assert.equal(updated.target, "purchase");
  });

  it("establece target a expense", async () => {
    const draft = await createDraft(photoBase64);
    await setDraftTarget(draft.id, "expense");
    const updated = await getDraft(draft.id);
    assert.ok(updated);
    assert.equal(updated.target, "expense");
  });
});

describe("confirmDraft", () => {
  it("establece status a confirmed", async () => {
    const draft = await createDraft(photoBase64);
    await confirmDraft(draft.id);
    const updated = await getDraft(draft.id);
    assert.ok(updated);
    assert.equal(updated.status, "confirmed");
  });
});

describe("discardDraft", () => {
  it("establece status a discarded", async () => {
    const draft = await createDraft(photoBase64);
    await discardDraft(draft.id);
    const updated = await getDraft(draft.id);
    assert.ok(updated);
    assert.equal(updated.status, "discarded");
  });
});

describe("deleteDraft", () => {
  it("elimina el borrador de la base de datos", async () => {
    const draft = await createDraft(photoBase64);
    await deleteDraft(draft.id);
    const fetched = await getDraft(draft.id);
    assert.equal(fetched, undefined);
  });
});

describe("listActiveDrafts", () => {
  it("retorna solo borradores captured y extracted ordenados por createdAt descendente", async () => {
    const d1 = await createDraft("photo1");
    const d2 = await createDraft("photo2");
    const d3 = await createDraft("photo3");

    await updateDraftOcr(d3.id, sampleOcr);

    const active = await listActiveDrafts();
    assert.equal(active.length, 3);
    assert.equal(active[0].id, d3.id);
    assert.equal(active[1].id, d2.id);
    assert.equal(active[2].id, d1.id);
  });

  it("excluye borradores confirmados", async () => {
    await createDraft("photo1");
    const d2 = await createDraft("photo2");
    await confirmDraft(d2.id);

    const active = await listActiveDrafts();
    assert.equal(active.length, 1);
  });

  it("excluye borradores descartados", async () => {
    await createDraft("photo1");
    const d2 = await createDraft("photo2");
    await discardDraft(d2.id);

    const active = await listActiveDrafts();
    assert.equal(active.length, 1);
  });
});

describe("ciclo de vida completo", () => {
  it("create → extract → confirm", async () => {
    const draft = await createDraft(photoBase64);
    assert.equal(draft.status, "captured");

    await updateDraftOcr(draft.id, sampleOcr);
    let updated = await getDraft(draft.id);
    assert.equal(updated!.status, "extracted");
    assert.deepEqual(updated!.ocrResult, sampleOcr);

    await setDraftTarget(draft.id, "purchase");
    await confirmDraft(draft.id);
    updated = await getDraft(draft.id);
    assert.equal(updated!.status, "confirmed");
    assert.equal(updated!.target, "purchase");
  });

  it("create → extract → discard", async () => {
    const draft = await createDraft(photoBase64);
    assert.equal(draft.status, "captured");

    await updateDraftOcr(draft.id, sampleOcr);
    let updated = await getDraft(draft.id);
    assert.equal(updated!.status, "extracted");

    await discardDraft(draft.id);
    updated = await getDraft(draft.id);
    assert.equal(updated!.status, "discarded");

    const active = await listActiveDrafts();
    assert.equal(active.length, 0);
  });
});
