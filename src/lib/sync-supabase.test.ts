import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  productToPayload,
  expenseFromRow,
  buildSupabaseTransport,
  missingSchemaColumn,
  isDuplicateCodeError,
  nextAvailableCode,
} from "./sync-supabase.ts";

// Desde la migración 00020, `public.products` expone `category_id`. Esta prueba
// fija las columnas que el push de products tiene que enviar, incluida la FK.

const ROW = {
  id: "p1",
  code: "P001",
  name: "Camisa",
  color: "rojo",
  categoryId: "cat-1",
  workspaceId: "ws-1",
  deleted: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  revision: 3,
};

describe("Payload de products hacia Supabase", () => {
  it("envía category_id para sincronizar la categoría del producto", () => {
    const payload = productToPayload(ROW, "user-1");
    assert.equal(payload.category_id, "cat-1");
  });

  it("envía null cuando el producto no tiene categoría", () => {
    const payload = productToPayload({ ...ROW, categoryId: "" }, "user-1");
    assert.equal(payload.category_id, null);
  });

  it("envía solo columnas que existen en public.products", () => {
    const payload = productToPayload(ROW, "user-1");
    assert.deepEqual(Object.keys(payload).sort(), [
      "category_id",
      "code",
      "color",
      "created_at",
      "deleted",
      "id",
      "name",
      "revision",
      "updated_at",
      "user_id",
      "workspace_id",
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

  it("ya no declara categoryId como campo local (el servidor es la fuente)", () => {
    const products = buildSupabaseTransport().find((e) => e.name === "products");
    assert.equal(products?.localOnlyFields, undefined);
    assert.equal(products?.serverTable, "products");
  });
});

describe("Payload con workspace_id", () => {
  it("envía el workspace local para que el servidor pueda aislar por workspace", () => {
    const payload = productToPayload(ROW, "user-1");
    assert.equal(payload.workspace_id, "ws-1");
  });

  it("envía null si la fila local no tiene workspace", () => {
    const payload = productToPayload({ ...ROW, workspaceId: "" }, "user-1");
    assert.equal(payload.workspace_id, null);
  });
});

describe("missingSchemaColumn (degradación de columna ausente)", () => {
  it("extracts the column name from a PGRST204 error", () => {
    assert.equal(
      missingSchemaColumn({
        code: "PGRST204",
        message: "Could not find the 'category_id' column of 'products' in the schema cache",
      }),
      "category_id",
    );
  });

  it("extracts workspace_id even without a code", () => {
    assert.equal(
      missingSchemaColumn({
        message: "Could not find the 'workspace_id' column of 'expenses' in the schema cache",
      }),
      "workspace_id",
    );
  });

  it("ignores a missing table (PGRST205), which is not a column problem", () => {
    assert.equal(
      missingSchemaColumn({ code: "PGRST205", message: "Could not find the table 'public.foo'" }),
      null,
    );
  });

  it("returns null when the error does not name a column", () => {
    assert.equal(missingSchemaColumn({ code: "PGRST204", message: "schema cache is stale" }), null);
  });

  it("returns null for unrelated errors", () => {
    assert.equal(missingSchemaColumn({ code: "", message: "duplicate key value violates unique constraint" }), null);
    assert.equal(missingSchemaColumn(null), null);
  });
});

// La auto-reparación del push depende de reconocer el 23505 del código
// correlativo y de calcular un código libre conservando prefijo y ancho.
describe("isDuplicateCodeError", () => {
  it("detecta el 23505 del índice de código", () => {
    assert.equal(
      isDuplicateCodeError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "idx_expenses_user_code"',
      }),
      true,
    );
  });

  it("ignora un 23505 que no sea de la columna code", () => {
    assert.equal(
      isDuplicateCodeError({ code: "23505", message: 'duplicate key value violates unique constraint "products_pkey"' }),
      false,
    );
  });

  it("ignora otros SQLSTATE", () => {
    assert.equal(isDuplicateCodeError({ code: "23503", message: "violates foreign key constraint" }), false);
    assert.equal(isDuplicateCodeError(null), false);
    assert.equal(isDuplicateCodeError(undefined), false);
  });
});

describe("nextAvailableCode", () => {
  it("toma el mayor del servidor más uno conservando el ancho", () => {
    assert.equal(nextAvailableCode("G000007", ["G000001", "G000012", "G000003"]), "G000013");
  });

  it("combina códigos remotos y locales", () => {
    assert.equal(nextAvailableCode("G000001", ["G000002", null, undefined, "G000009"]), "G000010");
  });

  it("ignora códigos con prefijo o formato distintos", () => {
    assert.equal(nextAvailableCode("ROT-003", ["G000100", "ROT-004", "OTRO-999"]), "ROT-005");
  });

  it("arranca en 1 cuando no hay códigos conocidos", () => {
    assert.equal(nextAvailableCode("G000000", []), "G000001");
  });

  it("añade un sufijo cuando el código no termina en dígitos", () => {
    assert.match(nextAvailableCode("SIN-NUMERO", ["SIN-NUMERO"]), /^SIN-NUMERO.+$/);
  });
});

// Los gastos de versiones previas podían persistir con los estados legacy
// "activo"/"cancelado" (Supabase 00001, v8 del móvil). El pull debe
// consolidarlos a los canónicos "pagado"/"anulado" para que los informes,
// validaciones y el dashboard no vean valores huérfanos.
describe("Normalización de estados legacy en el pull de gastos", () => {
  const baseRow = (status: string, extra: Record<string, unknown> = {}) => ({
    id: "e1",
    workspace_id: "ws-1",
    code: "G000001",
    description: "Recibo de luz",
    amount: 98,
    category_id: "cat-1",
    payment_method: "transferencia",
    status,
    date: "2026-08-14",
    time: "12:00",
    notes: "",
    voided_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z",
    deleted: false,
    revision: 1,
    ...extra,
  });

  it("mapea los estados canónicos 1:1", () => {
    assert.equal(expenseFromRow(baseRow("pagado")).status, "pagado");
    assert.equal(expenseFromRow(baseRow("pendiente")).status, "pendiente");
    assert.equal(expenseFromRow(baseRow("anulado")).status, "anulado");
  });

  it("mapea activo a pagado (estado legacy)", () => {
    assert.equal(expenseFromRow(baseRow("activo")).status, "pagado");
  });

  it("mapea cancelado a anulado (estado legacy)", () => {
    assert.equal(expenseFromRow(baseRow("cancelado")).status, "anulado");
  });

  it("usa pagado como fallback ante un estado desconocido", () => {
    assert.equal(expenseFromRow(baseRow("otro")).status, "pagado");
  });
});
