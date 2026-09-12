import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../../../lib/db.ts";
import {
  createInvestment,
  updateInvestment,
  voidInvestment,
  deleteInvestment,
} from "./investmentService.ts";

const validData = {
  name: "Computador Dell",
  value: 3500,
  categoryId: "cat-computacion",
  supplier: "Distribuidora Tech SAC",
  paymentMethod: "transferencia" as const,
  status: "pagado" as const,
  date: "2026-08-15",
  notes: "Para diseño gráfico",
};

beforeEach(async () => {
  await db.investments.clear();
});

describe("createInvestment", () => {
  it("crea una inversión con syncStatus pending y deleted false", async () => {
    const investment = await createInvestment(validData);
    assert.ok(investment.id);
    assert.match(investment.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(investment.name, "Computador Dell");
    assert.equal(investment.value, 3500);
    assert.equal(investment.syncStatus, "pending");
    assert.equal(investment.deleted, false);
    assert.equal(investment.voidedAt, null);
  });

  it("lanza error cuando el nombre está vacío", async () => {
    await assert.rejects(
      createInvestment({ ...validData, name: "" }),
      /nombre/i,
    );
  });

  it("lanza error cuando el valor es cero", async () => {
    await assert.rejects(
      createInvestment({ ...validData, value: 0 }),
      /valor/i,
    );
  });

  it("lanza error cuando la categoría está vacía", async () => {
    await assert.rejects(
      createInvestment({ ...validData, categoryId: "" }),
      /categoría/i,
    );
  });
});

describe("updateInvestment", () => {
  it("actualiza campos y establece syncStatus pending", async () => {
    const investment = await createInvestment(validData);
    await updateInvestment(investment.id, {
      ...validData,
      name: "Impresora HP",
      value: 1200,
    });
    const updated = await db.investments.get(investment.id);
    assert.equal(updated!.name, "Impresora HP");
    assert.equal(updated!.value, 1200);
    assert.equal(updated!.syncStatus, "pending");
  });

  it("lanza error cuando la inversión no existe", async () => {
    await assert.rejects(
      updateInvestment("id-falso", validData),
      /no encontrada/i,
    );
  });

  it("lanza error cuando la inversión está anulada", async () => {
    const investment = await createInvestment(validData);
    await voidInvestment(investment.id);
    await assert.rejects(
      updateInvestment(investment.id, validData),
      /anulada/i,
    );
  });
});

describe("voidInvestment", () => {
  it("establece status anulado y voidedAt", async () => {
    const investment = await createInvestment(validData);
    await voidInvestment(investment.id);
    const voided = await db.investments.get(investment.id);
    assert.equal(voided!.status, "anulado");
    assert.ok(voided!.voidedAt);
    assert.equal(voided!.syncStatus, "pending");
  });

  it("lanza error cuando la inversión no existe", async () => {
    await assert.rejects(
      voidInvestment("id-falso"),
      /no encontrada/i,
    );
  });

  it("lanza error cuando la inversión ya está anulada", async () => {
    const investment = await createInvestment(validData);
    await voidInvestment(investment.id);
    await assert.rejects(
      voidInvestment(investment.id),
      /ya está anulada/i,
    );
  });
});

describe("deleteInvestment", () => {
  it("marca deleted en true (soft delete)", async () => {
    const investment = await createInvestment(validData);
    await deleteInvestment(investment.id);
    const deleted = await db.investments.get(investment.id);
    assert.equal(deleted!.deleted, true);
    assert.equal(deleted!.syncStatus, "pending");
  });
});

describe("ciclo completo de vida de la inversión", () => {
  it("crear → actualizar → anular → eliminar", async () => {
    const investment = await createInvestment(validData);
    assert.equal(investment.status, "pagado");

    await updateInvestment(investment.id, { ...validData, name: "Monitor LG", value: 800 });
    const afterUpdate = await db.investments.get(investment.id);
    assert.equal(afterUpdate!.name, "Monitor LG");
    assert.equal(afterUpdate!.value, 800);

    await voidInvestment(investment.id);
    const afterVoid = await db.investments.get(investment.id);
    assert.equal(afterVoid!.status, "anulado");
    assert.ok(afterVoid!.voidedAt);

    await deleteInvestment(investment.id);
    const afterDelete = await db.investments.get(investment.id);
    assert.equal(afterDelete!.deleted, true);
  });
});
