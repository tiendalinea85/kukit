// TEMPORAL DIAGNÓSTICO — ETAPA 1. Se elimina al cerrar la etapa.
// Demuestra el payload final que viajaría a Supabase para `products` y en qué
// punto desaparece `categoryId` (fila Dexie) frente a `category_id` (remoto).
import "fake-indexeddb/auto";
import { it } from "node:test";
import { productToPayload } from "../sync-supabase.ts";
import { canonicalStringify, hashPayload } from "./outbox.ts";

it("temp: dump products payload boundary (STAGE 1)", () => {
  const row = {
    id: "prod-0001",
    workspaceId: "ws-negocio",
    code: "P-0001",
    name: "Tela drill 12oz",
    color: "azul",
    categoryId: "cat-principal",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deleted: false,
    syncStatus: "pending",
    revision: 1,
  };

  const mapped = productToPayload(row, "user-123");

  console.log("=== PRODUCT_ROW (fila Dexie / op.payload) ===");
  console.log(JSON.stringify(row, null, 2));
  console.log("hashPayload(row)          :", hashPayload(row));
  console.log("canonicalStringify length :", canonicalStringify(row).length);

  console.log("\n=== PAYLOAD_FINAL (body que recibe writeWith) ===");
  console.log(JSON.stringify(mapped, null, 2));
  console.log("hashPayload(mapped)       :", hashPayload(mapped));

  console.log("\n=== categoryId / category_id ===");
  console.log("categoryId en PRODUCT_ROW  :", "categoryId" in row);
  console.log("category_id en PAYLOAD     :", "category_id" in mapped);

  const diff = Object.keys(row).filter((k) => !(k in mapped));
  console.log("\n=== claves de la fila local que NO viajan ===");
  console.log(diff.join(", ") || "(ninguna)");

  const extra = Object.keys(mapped).filter((k) => !(k in row));
  console.log("=== claves del payload remoto que NO están en la fila local ===");
  console.log(extra.join(", ") || "(ninguna)");
});