# Plan: Agregar Detalles de Gasto (Líneas de Producto)

## Contexto

El formulario de gastos actualmente solo registra un monto total plano por gasto. El usuario necesita:
1. **Precio unitario, cantidad y monto total** por línea de producto
2. **Detalles por producto** dentro de un gasto (ej: "1 rollo de tela, precio 120, cantidad 4")
3. **Múltiples productos** en un solo gasto (ej: factura con cierres, hilos, cintas elásticas, cintas brillante)
4. **Crear productos nuevos** directamente desde el formulario si no existen

El patrón exacto ya existe en Ventas (`SaleForm` + `SaleDetail`) y Compras (`PurchaseForm` + `PurchaseDetail`). La app móvil y la API ya soportan `expense_details` — solo falta re-introducirlo en el web app.

## Cambios

### 1. Tipos — `src/types/index.ts`
- Agregar interfaz `ExpenseDetail` (igual que `SaleDetail`/`PurchaseDetail`: id, workspaceId, expenseId, productId, code, name, color, quantity, unitPrice, subtotal, createdAt, syncStatus, revision)
- Agregar interfaz `ExpenseDetailInput` (input DTO sin id/timestamps)
- No modificar `Expense` — el total se mantiene calculado desde details

### 2. Dexie Schema — `src/lib/db.ts`
- Nueva versión 13 con tabla `expenseDetails: "id, workspaceId, expenseId, productId, createdAt, syncStatus"`
- Declarar `expenseDetails!: Table<ExpenseDetail, string>` en la clase ZaneDB
- Agregar `db.expenseDetails.clear()` a `clearLocalData()`

### 3. Schema Zod — `src/features/expenses/schemas/expenseSchema.ts`
- Crear `expenseDetailSchema` con productId, quantity (positive), unitPrice (>= 0)
- El `expenseSchema` existente se mantiene (description, categoryId, paymentMethod, status, date, time, notes, receiptPhoto)
- El campo `amount` se calcula automáticamente como suma de subtotales

### 4. Domain Rules — `src/features/expenses/domain/expenseRules.ts`
- Agregar `ExpenseDetailInput` interface
- Agregar `computeSubtotal(quantity, unitPrice)` — redondeo 2 decimales
- Agregar `computeExpenseTotal(details)` — suma de subtotales
- Agregar `buildExpenseDetail(input, expenseId, now, workspaceId)` — construye entidad completa

### 5. Service — `src/features/expenses/services/expenseService.ts`
- Modificar `createExpense`: recibir `details: ExpenseDetailInput[]`, calcular total desde details si existen, guardar parent + details en transacción Dexie
- Modificar `updateExpense`: reemplazar details (delete all + re-insert, patrón de ventas)
- Modificar `deleteExpense`: eliminar details relacionados antes del soft delete

### 6. Nuevo: Product Service — `src/features/expenses/services/productService.ts`
- Re-exportar desde `src/features/sales/services/productService.ts` (ya existe `createProduct`, `listProductsWithStock`)
- Opcionalmente, crear una función `quickCreateProduct(data)` que solo pida code + name (sin initialStock)

### 7. ExpenseForm — `src/features/expenses/components/ExpenseForm.tsx`
- Recibir prop `products: ProductWithStock[]` para el selector de productos
- Agregar sección "Detalle del gasto" (mismo patrón que SaleForm):
  - Selector de producto (dropdown)
  - Campo cantidad, campo precio unitario
  - Botón "Agregar línea"
  - Lista de líneas agregadas con subtotal y botón eliminar
  - Total calculado en tiempo real
- Si no hay detalles, el campo `amount` manual se mantiene editable (gastos simples)
- Si hay detalles, `amount` se calcula automáticamente como suma de subtotales (readonly)
- Botón "+" al lado del dropdown de productos para abrir modal de creación rápida de producto
- Modal inline con solo: código + nombre (campos mínimos)

### 8. Páginas de Ruta
- **`src/app/expenses/new/page.tsx`**: cargar productos al mount, pasar a ExpenseForm, ajustar `createExpense` para recibir details
- **`src/app/expenses/edit/[id]/page.tsx`**: cargar expense + sus expenseDetails, pasar como defaultDetails, ajustar `updateExpense` para recibir details
- **`src/app/expenses/[id]/page.tsx`**: mostrar tabla de detalles del gasto si existen (producto, código, cantidad × precio unitario, subtotal) + total. Si no hay detalles, mostrar monto simple como ahora
- **`src/app/expenses/page.tsx`**: SIN CAMBIOS — la lista solo muestra el monto total, sin detalles de producto

### 9. Sync — `src/lib/sync-supabase.ts`
- Agregar función `expenseDetailToPayload` (camelCase → snake_case)
- Agregar función `expenseDetailFromRow` (snake_case → camelCase)
- Agregar `{ name: "expenseDetails", serverTable: "expense_details", order: 6.5, mode: "guarded", orderColumn: "created_at" }` a ENTITY_SPECS
- Nota: La tabla `expense_details` fue dropeada en Supabase (00004). Se necesita nueva migración.

### 10. Supabase Migration — `supabase/migrations/00015_expense_details.sql`
- Recrear tabla `expense_details` con: id, user_id, expense_id, product_id, code, name, color, quantity, unit_price, subtotal, workspace_id, revision, created_at, updated_at
- RLS policies (CRUD por user_id)
- Índices en expense_id, product_id

## Archivos a Modificar
| Archivo | Acción |
|---|---|
| `src/types/index.ts` | Agregar `ExpenseDetail`, `ExpenseDetailInput` |
| `src/lib/db.ts` | Nueva versión 13 + tabla `expenseDetails` |
| `src/features/expenses/schemas/expenseSchema.ts` | Agregar `expenseDetailSchema` |
| `src/features/expenses/domain/expenseRules.ts` | Agregar `computeSubtotal`, `computeExpenseTotal`, `buildExpenseDetail` |
| `src/features/expenses/services/expenseService.ts` | Modificar CRUD para manejar details |
| `src/features/expenses/components/ExpenseForm.tsx` | Agregar UI de líneas + modal creación producto |
| `src/app/expenses/new/page.tsx` | Cargar productos, pasar details |
| `src/app/expenses/edit/[id]/page.tsx` | Cargar details existentes |
| `src/app/expenses/[id]/page.tsx` | Mostrar tabla de detalles |
| `src/lib/sync-supabase.ts` | Agregar expenseDetails push/pull + ENTITY_SPEC |
| `supabase/migrations/00015_expense_details.sql` | Nueva migración |

## Archivos a Crear
| Archivo | Propósito |
|---|---|
| `supabase/migrations/00015_expense_details.sql` | Tabla expense_details + RLS |
| Tests unitarios actualizados | Para las nuevas funciones de domain + service |

## Patrón a Seguir
Copiar el patrón exacto de `SaleDetail`/`PurchaseDetail`:
- Mismos campos snapshot (code, name, color) en vez de solo product_name
- Mismo cálculo de subtotal: `Math.round(quantity * unitPrice * 100) / 100`
- Mismo merge al agregar línea duplicada (incrementar cantidad)
- Misma estrategia de replace en updates (delete all + re-insert)

## Verificación
1. `npm run typecheck` — sin errores de tipo
2. `npm run lint` — sin warnings
3. `npm test` — todos los tests pasan (incluyendo los nuevos)
4. `npm run build` — build exitoso
5. Verificar manualmente:
   - Crear gasto con detalles → se guarda correctamente
   - Editar gasto con detalles → se actualizan las líneas
   - Ver detalle del gasto → muestra tabla de productos
   - Crear producto nuevo desde el modal inline → aparece en el dropdown
   - Gasto sin detalles (monto manual) → funciona como antes
