# ETAPA 3 — Corrección local → remoto: `expense_details.workspace_id`

## Revisión previa (sin modificar nada)

| Pregunta | Respuesta con evidencia |
|---|---|
| ¿Algún push envía el objeto Dexie crudo? | No. Única vía de push: `buildSupabaseTransport().push` → `pushOp` → `spec.toPayload(op.payload, userId)` (`src/lib/sync-supabase.ts:1212`) → `writeWith`. Las 36 entidades tienen `toPayload` explícito (sin `...row`). |
| `payload: row as unknown as Record<string, unknown>` (`src/lib/sync/outbox.ts:516`) | Es la **entrada** del outbox en `reconcilePendingEntities` (fila local encolada), no un envío: `pushOp` la transforma antes de tocar PostgREST. Ninguna ruta usa ese patrón para PUSH. |
| `products`: `categoryId → category_id` o `→ no enviar` | **No enviar.** OpenAPI remoto: `products = code,color,created_at,deleted,id,name,revision,updated_at,user_id,workspace_id` (sin `category_id`); sondeo `?select=category_id` → error (PGRST204). Ya está en `productToPayload` + `localOnlyFields: ["categoryId"]` + `sync-supabase.test.ts`. **Sin cambios de esquema ni migraciones.** |
| ¿Columnas enviadas que no existen remoto / NOT NULL sin default que no se envían? | 0 y 0 (comparación de las 36 `toPayload` contra el esquema real). El push no falla por esquema. |
| ¿Campos locales que se descartan en el payload? | Solo uno: **`ExpenseDetail.workspaceId`** en `expenseDetailToPayload`. |

Evidencia del descarte: los 3 hijos de gasto remotos tienen `workspace_id = null`
(`expense_details`), mientras `sale_details` y `purchase_details` sí lo envían, y la
columna remota `expense_details.workspace_id` existe (OpenAPI). El modelo local
`ExpenseDetail` sí tiene `workspaceId` (invariante 1 de AGENTS.md).

## Cambio propuesto

- **Archivo:** `src/lib/sync-supabase.ts`
- **Función:** `expenseDetailToPayload`
- **Cambio:** añadir `workspace_id: asStr(row.workspaceId) || null` (tras `user_id`, igual que `saleDetailToPayload` / `purchaseDetailToPayload`).
- **Motivo:** la fila local lleva workspace y el servidor lo almacena; hoy el hijo queda fuera del aislamiento por workspace. El upsert/update posterior (`mode: "guarded"`) rellena los `NULL` existentes.

Fuera de alcance (documentado, etapa posterior): `categories`/`types`/`investment_categories` y los detalles no envían `updated_at`/`revision` porque el modelo local no tiene esos campos; añadirlos exige tocar el dominio.

Se conserva la instrumentación `[SYNC-DIAG]` (temporal, Etapa 1).

## Validación

```bash
npm run lint && npm run typecheck && npm test
```

Baseline actual: lint 0 avisos, typecheck 0 errores, 561 tests OK. Si algo falla →
parar y explicar, sin seguir a otras etapas.

## Entregable

`### CAMBIOS` (archivo/función/cambio/motivo) · `### VALIDACIÓN` · `### PAYLOAD ESPERADO`
(ejemplo del payload de un `expense_detail` con `workspace_id`) · detenerse.
