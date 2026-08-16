import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INVESTMENT_STATUSES,
  INVESTMENT_CATEGORY_DEFAULTS,
  buildInvestment,
  canEditInvestment,
  canVoidInvestment,
  isVoided,
  filterInvestments,
} from "./investmentRules.ts";
import type { NewInvestmentInput } from "./investmentRules.ts";

const now = "2026-08-14T10:00:00.000Z";

const baseInput: NewInvestmentInput = {
  name: "  Máquina de coser industrial  ",
  value: 1450,
  categoryId: "cat-maquinaria",
  paymentMethod: "transferencia",
  status: "pagado",
  date: "2026-08-14",
};

describe("buildInvestment", () => {
  it("creates an investment with trimmed name and defaults", () => {
    const inv = buildInvestment({ data: baseInput, now });
    assert.equal(inv.id.length > 0, true);
    assert.equal(inv.name, "Máquina de coser industrial");
    assert.equal(inv.value, 1450);
    assert.equal(inv.categoryId, "cat-maquinaria");
    assert.equal(inv.paymentMethod, "transferencia");
    assert.equal(inv.status, "pagado");
    assert.equal(inv.date, "2026-08-14");
    assert.equal(inv.supplier, "");
    assert.equal(inv.notes, "");
    assert.equal(inv.voidedAt, null);
    assert.equal(inv.deleted, false);
    assert.equal(inv.syncStatus, "pending");
    assert.equal(inv.createdAt, now);
    assert.equal(inv.updatedAt, now);
  });

  it("preserves optional supplier and notes", () => {
    const inv = buildInvestment({
      data: { ...baseInput, supplier: "Importadora Maquipack", notes: "Overlock de 5 hilos" },
      now,
    });
    assert.equal(inv.supplier, "Importadora Maquipack");
    assert.equal(inv.notes, "Overlock de 5 hilos");
  });
});

describe("status lifecycle", () => {
  it("allows editing and voiding non-voided investments", () => {
    for (const status of ["pagado", "pendiente"] as const) {
      assert.equal(canEditInvestment(status), true);
      assert.equal(canVoidInvestment(status), true);
      assert.equal(isVoided({ status }), false);
    }
  });

  it("forbids editing and voiding an anulado investment", () => {
    assert.equal(canEditInvestment("anulado"), false);
    assert.equal(canVoidInvestment("anulado"), false);
    assert.equal(isVoided({ status: "anulado" }), true);
  });

  it("exposes the canonical status list", () => {
    assert.deepEqual([...INVESTMENT_STATUSES], ["pagado", "pendiente", "anulado"]);
  });

  it("exposes the default investment category taxonomy", () => {
    const names = INVESTMENT_CATEGORY_DEFAULTS.map((c) => c.name);
    assert.deepEqual(names, ["Maquinaria", "Equipamiento", "Herramientas", "Computación", "Muebles", "Inmuebles", "Otros"]);
  });
});

describe("filterInvestments", () => {
  const investments = [
    { id: "1", name: "Máquina de coser", categoryId: "maquinaria", supplier: "Maquipack", paymentMethod: "transferencia", value: 1450, date: "2026-08-10", status: "pagado" },
    { id: "2", name: "Computadora", categoryId: "computacion", supplier: "TechStore", paymentMethod: "tarjeta_credito", value: 980, date: "2026-08-11", status: "pagado" },
    { id: "3", name: "Mesa de corte", categoryId: "muebles", supplier: "", paymentMethod: "efectivo", value: 320, date: "2026-08-12", status: "pendiente" },
    { id: "4", name: "Inversión borrada", categoryId: "otros", supplier: "", paymentMethod: "efectivo", value: 10, date: "2026-08-13", status: "pagado", deleted: true },
  ];
  const names: Record<string, string> = {
    maquinaria: "Maquinaria",
    computacion: "Computación",
    muebles: "Muebles",
    otros: "Otros",
  };

  it("returns all non-deleted investments with no filters", () => {
    assert.equal(filterInvestments(investments).length, 3);
  });

  it("filters by category", () => {
    const result = filterInvestments(investments, { categoryId: "computacion" });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Computadora");
  });

  it("filters by date range (inclusive)", () => {
    const result = filterInvestments(investments, { dateFrom: "2026-08-11", dateTo: "2026-08-12" });
    assert.deepEqual(result.map((e) => e.name), ["Computadora", "Mesa de corte"]);
  });

  it("searches by name", () => {
    const result = filterInvestments(investments, { search: "coser" });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Máquina de coser");
  });

  it("searches by supplier", () => {
    const result = filterInvestments(investments, { search: "techstore" });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Computadora");
  });

  it("searches by category name", () => {
    const result = filterInvestments(investments, { search: "muebles" }, names);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Mesa de corte");
  });

  it("searches by payment method", () => {
    const result = filterInvestments(investments, { search: "efectivo" });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Mesa de corte");
  });

  it("searches by value", () => {
    const result = filterInvestments(investments, { search: "1450" });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Máquina de coser");
  });

  it("combines search and category filters", () => {
    const result = filterInvestments(investments, { search: "computadora", categoryId: "computacion" });
    assert.equal(result.length, 1);
  });

  it("excludes deleted investments even when matching search", () => {
    assert.equal(filterInvestments(investments, { search: "borrada" }).length, 0);
  });
});
