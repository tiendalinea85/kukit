import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canExtractFromImage,
  canConfirmDraft,
  ocrResultToPurchaseHeader,
  ocrResultToPurchaseDetails,
  ocrResultToExpenseData,
  ocrTotalComputed,
  matchOcrItemsToProducts,
} from "./invoiceRules.ts";
import type { InvoiceDraft } from "./types.ts";
import type { OcrResult } from "../schemas/ocrSchema.ts";

const now = "2026-08-14T10:00:00.000Z";

function makeDraft(overrides: Partial<InvoiceDraft> = {}): InvoiceDraft {
  return {
    id: "draft-1",
    photoBase64: "data:image/jpeg;base64,abc",
    status: "captured",
    target: null,
    ocrResult: null,
    extractedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

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

describe("canExtractFromImage", () => {
  it("retorna true cuando status es captured", () => {
    const draft = makeDraft({ status: "captured" });
    assert.equal(canExtractFromImage(draft), true);
  });

  it("retorna false cuando status es extracted", () => {
    const draft = makeDraft({ status: "extracted" });
    assert.equal(canExtractFromImage(draft), false);
  });

  it("retorna false cuando status es confirmed", () => {
    const draft = makeDraft({ status: "confirmed" });
    assert.equal(canExtractFromImage(draft), false);
  });
});

describe("canConfirmDraft", () => {
  it("retorna true cuando status es extracted y ocrResult está presente", () => {
    const draft = makeDraft({ status: "extracted", ocrResult: sampleOcr });
    assert.equal(canConfirmDraft(draft), true);
  });

  it("retorna false cuando status es captured", () => {
    const draft = makeDraft({ status: "captured" });
    assert.equal(canConfirmDraft(draft), false);
  });

  it("retorna false cuando status es extracted pero ocrResult es null", () => {
    const draft = makeDraft({ status: "extracted", ocrResult: null });
    assert.equal(canConfirmDraft(draft), false);
  });
});

describe("ocrResultToPurchaseHeader", () => {
  it("mapea supplier, date, invoiceNumber a notes", () => {
    const header = ocrResultToPurchaseHeader(sampleOcr);
    assert.equal(header.supplier, "Ferretería Central");
    assert.equal(header.date, "2026-08-10");
    assert.equal(header.notes, "Factura N° FAC-001");
  });

  it("usa la fecha de hoy cuando date está ausente", () => {
    const ocrNoDate = { ...sampleOcr, date: undefined };
    const header = ocrResultToPurchaseHeader(ocrNoDate);
    const today = new Date().toISOString().split("T")[0];
    assert.equal(header.date, today);
  });

  it("retorna notes vacío cuando invoiceNumber está ausente", () => {
    const ocrNoInvoice = { ...sampleOcr, invoiceNumber: undefined };
    const header = ocrResultToPurchaseHeader(ocrNoInvoice);
    assert.equal(header.notes, "");
  });
});

describe("ocrResultToPurchaseDetails", () => {
  it("mapea items correctamente", () => {
    const details = ocrResultToPurchaseDetails(sampleOcr);
    assert.equal(details.length, 2);
    assert.equal(details[0].name, "Tornillo 1/4");
    assert.equal(details[0].quantity, 10);
    assert.equal(details[0].unitPrice, 0.5);
    assert.equal(details[1].name, "Clavo 2\"");
    assert.equal(details[1].quantity, 20);
    assert.equal(details[1].unitPrice, 0.3);
  });
});

describe("ocrResultToExpenseData", () => {
  it("calcula total desde items cuando ocr.total falta", () => {
    const ocrNoTotal = { ...sampleOcr, total: undefined };
    const expense = ocrResultToExpenseData(ocrNoTotal);
    assert.equal(expense.amount, 10 * 0.5 + 20 * 0.3);
  });

  it("genera description desde supplier + invoiceNumber", () => {
    const expense = ocrResultToExpenseData(sampleOcr);
    assert.equal(expense.description, "Factura Ferretería Central N° FAC-001");
  });

  it("genera description solo con invoiceNumber cuando supplier falta", () => {
    const ocrNoSupplier = { ...sampleOcr, supplier: undefined };
    const expense = ocrResultToExpenseData(ocrNoSupplier);
    assert.ok(expense.description!.includes("FAC-001"));
  });

  it("usa la fecha de hoy cuando date está ausente", () => {
    const ocrNoDate = { ...sampleOcr, date: undefined };
    const expense = ocrResultToExpenseData(ocrNoDate);
    const today = new Date().toISOString().split("T")[0];
    assert.equal(expense.date, today);
  });
});

describe("matchOcrItemsToProducts", () => {
  const products = [
    { id: "p1", code: "TOR-001", name: "Tornillo 1/4", color: "plata" },
    { id: "p2", code: "CLA-002", name: "Clavo 2\"", color: "acero" },
  ];

  it("empareja por nombre y usa el precio del OCR", () => {
    const { details, unmatched } = matchOcrItemsToProducts(sampleOcr.items, products);
    assert.equal(unmatched.length, 0);
    assert.equal(details.length, 2);
    assert.deepEqual(details[0], {
      productId: "p1",
      code: "TOR-001",
      name: "Tornillo 1/4",
      color: "plata",
      quantity: 10,
      unitPrice: 0.5,
    });
  });

  it("empareja por código aunque la descripción no coincida", () => {
    const items = [{ description: "tor-001", quantity: 3, unitPrice: 1 }];
    const { details } = matchOcrItemsToProducts(items, products);
    assert.equal(details[0]?.productId, "p1");
    assert.equal(details[0]?.quantity, 3);
  });

  it("agrupa ítems repetidos del mismo producto sumando cantidades", () => {
    const items = [
      { description: "Tornillo 1/4", quantity: 2, unitPrice: 0.5 },
      { description: "TORNILLO 1/4", quantity: 4, unitPrice: 0.6 },
    ];
    const { details } = matchOcrItemsToProducts(items, products);
    assert.equal(details.length, 1);
    assert.equal(details[0].quantity, 6);
  });

  it("devuelve como unmatched las descripciones sin producto", () => {
    const items = [
      { description: "Tornillo 1/4", quantity: 2, unitPrice: 0.5 },
      { description: "Cemento gris", quantity: 1, unitPrice: 9 },
    ];
    const { details, unmatched } = matchOcrItemsToProducts(items, products);
    assert.equal(details.length, 1);
    assert.deepEqual(unmatched, ["Cemento gris"]);
  });

  it("ignora descripciones vacías", () => {
    const items = [{ description: "   ", quantity: 1, unitPrice: 1 }];
    const { details, unmatched } = matchOcrItemsToProducts(items, products);
    assert.equal(details.length, 0);
    assert.equal(unmatched.length, 0);
  });
});

describe("ocrTotalComputed", () => {
  it("retorna ocr.total cuando es mayor a 0", () => {
    assert.equal(ocrTotalComputed(sampleOcr), 11);
  });

  it("calcula desde items cuando total es null", () => {
    const ocrNoTotal = { ...sampleOcr, total: undefined };
    assert.equal(ocrTotalComputed(ocrNoTotal), 10 * 0.5 + 20 * 0.3);
  });

  it("calcula desde items cuando total es 0", () => {
    const ocrZeroTotal = { ...sampleOcr, total: 0 };
    assert.equal(ocrTotalComputed(ocrZeroTotal), 10 * 0.5 + 20 * 0.3);
  });
});
