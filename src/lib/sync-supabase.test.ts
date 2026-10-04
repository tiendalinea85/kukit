import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { productToPayload, buildSupabaseTransport } from "./sync-supabase.ts";

// `public.products` del Supabase desplegado no tiene columna `category_id`:
// PostgREST rechaza el payload completo (PGRST204) si se incluye. Esta prueba
// fija las columnas que el push de products tiene que enviar.

const ROW = {
  id: "p1",
  code: "P001",
  name: "Camisa",
  color: "rojo",
  categoryId: "cat-1",
  deleted: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  revision: 3,
};

describe("Payload de products hacia Supabase", () => {
  it("no envía category_id (la columna no existe en el servidor)", () => {
    const payload = productToPayload(ROW, "user-1");
    assert.equal("category_id" in payload, false);
  });

  it("envía solo columnas que existen en public.products", () => {
    const payload = productToPayload(ROW, "user-1");
    assert.deepEqual(Object.keys(payload).sort(), [
      "code",
      "color",
      "created_at",
      "deleted",
      "id",
      "name",
      "revision",
      "updated_at",
      "user_id",
    ]);
  });

  it("conserva los valores locales y el user_id del servidor", () => {
    const payload = productToPayload(ROW, "user-1");
    assert.equal(payload.id, "p1");
    assert.equal(payload.user_id, "user-1");
    assert.equal(payload.code, "P001");
    assert.equal(payload.name, "Camisa");
    assert.equal(payload.color, "rojo");
    assert.equal(payload.revision, 3);
    assert.equal(payload.deleted, false);
  });

  it("declara categoryId como campo local en el transporte", () => {
    const products = buildSupabaseTransport().find((e) => e.name === "products");
    assert.deepEqual(products?.localOnlyFields, ["categoryId"]);
    assert.equal(products?.serverTable, "products");
  });
});
