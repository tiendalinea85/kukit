import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../lib/db.ts";
import { buildProductAbbreviation, generateProductCode } from "../utils/code.ts";
import type { Product } from "../types/index.ts";

function makeProduct(id: string, code: string): Product {
  return {
    id,
    workspaceId: "default",
    code,
    name: "Producto",
    color: "",
    categoryId: "",
    createdAt: "2026-09-16T10:00:00.000Z",
    updatedAt: "2026-09-16T10:00:00.000Z",
    deleted: false,
    syncStatus: "synced",
  };
}

describe("buildProductAbbreviation", () => {
  it("genera abreviatura de 3 letras para un solo nombre", () => {
    assert.equal(buildProductAbbreviation("Tela"), "TEL");
  });

  it("combina 2 letras del primer nombre + 1 del segundo", () => {
    assert.equal(buildProductAbbreviation("Rollo de tela"), "ROT");
  });

  it("salta palabras de conexión (stop words)", () => {
    assert.equal(buildProductAbbreviation("Galleta para perro"), "GAP");
  });

  it("usa una inicial por palabra cuando hay 3+ palabras", () => {
    assert.equal(buildProductAbbreviation("Tela azul rayada"), "TAR");
  });

  it("quita acentos", () => {
    assert.equal(buildProductAbbreviation("Árbol de mango"), "ARM");
  });

  it("fallback a P cuando no hay palabras", () => {
    assert.equal(buildProductAbbreviation("   "), "P");
  });
});

describe("generateProductCode", () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.syncOutbox.clear();
  });

  it("genera el primer código con sufijo 001", async () => {
    assert.equal(await generateProductCode("Rollo de tela"), "ROT-001");
  });

  it("incrementa el sufijo por abreviatura", async () => {
    await db.products.add(makeProduct("p-1", "ROT-001"));
    assert.equal(await generateProductCode("Rollo de tela"), "ROT-002");
  });

  it("independiza los contadores por abreviatura", async () => {
    await db.products.add(makeProduct("p-1", "ROT-001"));
    assert.equal(await generateProductCode("Goma"), "GOM-001");
  });

  it("sigue la secuencia tras huecos", async () => {
    await db.products.add(makeProduct("p-1", "ROT-001"));
    await db.products.add(makeProduct("p-2", "ROT-003"));
    assert.equal(await generateProductCode("Rollo de tela"), "ROT-004");
  });
});