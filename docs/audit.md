# Auditoría final de CatoLedger / Zane

**Fecha:** 2026-08-15
**Rol:** QA Lead + Security Engineer + DevOps Senior
**Alcance:** PWA (Next.js + Dexie/IndexedDB + Supabase), app móvil (Expo SDK 57 + expo-sqlite), API de sync (FastAPI), migraciones Supabase, service worker, sincronización offline-first.
**Método:** 5 agentes de exploración en paralelo (arquitectura, seguridad, sync/datos, móvil, rendimiento/UX) + verificación directa de cada hallazgo crítico con `file:line` + tests.

---

## 1. Resumen ejecutivo

La aplicación es sólida en diseño offline-first (outbox local, engine de sync
con backoff, conflictos LWW, watermarks por entidad) pero **tenía un bug de
gravedad máxima que impedía sincronizar los datos más importantes**, un bug de
seguridad de RLS en la migración inicial, y varios problemas de hardening.

**Estados tras la auditoría:**
- ✅ **1 bug CRÍTICO corregido:** ventas, compras, productos, clientes,
  categorías y tipos se creaban con `syncStatus: "local"` y el único mecanismo
  de encolado (`reconcilePendingEntities`) solo encola `"pending"` → **esos
  datos NUNCA se sincronizaban a la nube**.
- ✅ **Bug CRÍTICO móvil corregido:** `writeTx` escribía los hijos antes que el
  padre → violación de FK que bloqueaba crear ventas/compras/gastos.
- ✅ **Bug de seguridad corregido:** políticas RLS de `00001_init.sql` que
  referenciaban `user_id` antes de crear la columna (migración rota → posible
  exposición de datos con la anon key). Se entrega `00008_rls_hardening.sql`
  autocurable.
- ✅ **Bug de sync corregido:** pull usaba `.gt` en lugar de `.gte` (podía
  saltar filas límite).
- ✅ **Offline corregido:** el service worker **nunca se registraba** (crítico
  para una app offline-first).
- ✅ **Seguridad de la clave Gemini:** una clave REAL estaba hardcodeada en
  `.env.local.example` → removida; hay que revocarla.
- ✅ **CVE:** `next@15.5.20` → `15.5.23`.
- ✅ **Endurecimiento del endpoint `/api/voice/parse`** (auth-if-configured,
  rate limit, límite de tamaño, clave por header, logs truncados).
- ✅ Verificación: **190 tests en verde** (4 nuevos), `tsc` limpio, lint OK,
  `next build` compila, typecheck de la app móvil limpio.

---

## 2. Hallazgos críticos (verificados)

| ID | Severidad | Descripción | Evidencia | Estado |
|----|-----------|-------------|-----------|--------|
| **C1** | CRÍTICA | Registros creados con `syncStatus: "local"` nunca se sincronizan: `reconcilePendingEntities` solo encola `pending` y es el único punto de encolado | `saleRules.ts:60,79`, `purchaseRules.ts:57,76`, `productService.ts:47,64,112`, `customerService.ts:19`, `categories/page.tsx:33`, `types/page.tsx:30` | ✅ Corregido (`"pending"`) + test `reconcile-pending.test.ts` |
| **F4** | CRÍTICA | `00001_init.sql` crea políticas RLS con `user_id` (L51-99) ANTES del `ADD COLUMN user_id` (L102-104). Si se aplicó tal cual, las políticas NO existen y la anon key expone los datos | `supabase/migrations/00001_init.sql` | ✅ Migración `00008` autocurable (requiere aplicarse en el proyecto real) |
| **C2** | ALTA | Push en orden de `updatedAt` puede enviar venta/compra antes que el producto que referencia (FK del servidor) | `outbox.ts:159-162` | ✅ Corregido: `claimNextBatch` ordena por ranking de dependencias + test |
| **C3** | ALTA | Pull incremental con `.gt(updated_at, since)` salta filas cuyo `updated_at` es exactamente el watermark | `sync-supabase.ts:601` | ✅ Corregido (`gte`) |
| **M-SW** | ALTA | El service worker (`public/sw.js`) nunca se registra → sin caché de app shell ni navegación offline | `ClientLayout.tsx` | ✅ Corregido (registro + fallback de navegación) |
| **M-FK** | CRÍTICA | `writeTx` escribe hijos antes que el padre → violación FK al crear venta/compra/gasto; además el pull podía llegar con hijo antes que padre | `apps/mobile/src/core/db/repo.ts:29-33`, `syncManager.ts` | ✅ Corregido (padre primero + pull en 2 fases + guardia anti-sobrescritura) |
| **M-MIG** | ALTA | Migración V2 del móvil no idempotente y sin transacción: un fallo a mitad deja la BD inconsistente | `apps/mobile/src/core/db/database.ts` | ✅ Corregido (transaccional + chequeo de columnas) |

---

## 3. Seguridad

| ID | Sev | Hallazgo | Estado |
|----|-----|----------|--------|
| F10 | CRÍTICA | Clave Gemini REAL en `.env.local.example:6` (`AQ.Ab8RN6…13YcFA`) | ✅ Removida. **Acción usuario: revocarla en Google AI Studio.** |
| F5 | ALTA | Políticas UPDATE sin `WITH CHECK`: un usuario podía reasignar `user_id` de sus filas a otro (edición) | ✅ Migración `00008` recrea con `WITH CHECK` |
| F7 | ALTA | `/api/voice/parse` sin auth, sin rate limit, sin límite de tamaño (abuso/costo ilimitado de Gemini) | ✅ Corregido: `isAuthenticatedRequest` (si Supabase configurado), rate limit 10/min/IP, tope 1500 chars |
| F8 | ALTA | `GEMINI_API_KEY` viajaba en query param (`?key=…`) → quedaba en logs/proxies | ✅ Corregido: header `x-goog-api-key` |
| F9 | MEDIA | Se logueaban cuerpos completos de Gemini (pueden contener datos personales) | ✅ Corregido: truncado a 500 chars |
| F1 | MEDIA | Sesión de Supabase en `localStorage` (XSS → robo de sesión). Mejora: HttpOnly cookie con `@supabase/ssr` (ya instalado). | 📋 Pendiente de decisión |
| F6 | MEDIA | No hay verificación de ownership al borrar: la fila se elimina sin marcar; si el remoto se re-crea, el pull la restaura. Comportamiento de doble clic revisado. | 📋 Pendiente de decisión (ver 6.3) |
| F12 | ALTA | `next@15.5.20` con CVE; fix ≥15.5.21 | ✅ Corregido → `15.5.23` |
| F13 | MEDIA | `xlsx@0.18.5` con vulns conocidas (uso: export de reportes). No hay fix compatible sin romper la API. | 📋 Documentado |
| F14 | BAJA | Dev-deps (brace-expansion, js-yaml, nanoid, postcss) con advisories; `postcss` requiere next@16 (breaking) | 📋 Documentado |

---

## 4. Sincronización y datos (PWA)

- **C1** (crítico, corregido). Además del fix en origen, el one-off para
  instalaciones existentes con datos locales viejos está en `docs/ops.md` §5.
- **C2** (corregido): ranking de push = categorías→tipos→investmentCategories→
  clientes→productos→expenses→investments→purchases→sales→
  inventoryMovements→purchaseDetails→saleDetails.
- **C3** (corregido): `gte` en el watermark.
- El engine (backoff exponencial, `recoverStaleOps`, dedupe `[entity+entityId]`,
  conflictos LWW con `resolveConflict`) está bien cubierto por tests: 53 suites.
- `pendingLike` (pull) cubre `pending|syncing|failed|conflict`; el push usa
  lotes de 25 con `completeOperation` idempotente por hash de payload. ✅

---

## 5. App móvil (Expo/SQLite)

| ID | Sev | Hallazgo | Estado |
|----|-----|----------|--------|
| M-FK | CRÍTICA | `writeTx` escribía hijos antes que el padre (FK) → bloqueaba crear venta/compra/gasto | ✅ Corregido |
| M-PULL | ALTA | El pull podía aplicar un detalle antes que su cabecera → FK; además `sync_status` se escribía en tablas sin esa columna (`sale_items`, etc.) | ✅ Corregido (2 fases + `SYNC_STATUS_TABLES`) |
| M-CONF | MEDIA | El pull sobrescribía locales pendientes (sin resolución de conflictos como la PWA) | ✅ Mitigado con guardia: si el registro local está `pending`, no se sobreescribe |
| M-MIG | ALTA | Migración V2 no idempotente ni transaccional | ✅ Corregido |
| M-AUTH | BUENA | Sesión en `expo-secure-store` (SecureStore) — correcto | ✅ (mantener) |
| M-AGENTS | — | `apps/mobile/AGENTS.md` exige leer docs Expo v57 antes de escribir código — cumplido (verificado contra docs oficiales) | ✅ |

---

## 6. Acciones que requieren TU decisión (no ejecutadas)

### 6.1 Aplicar `supabase/migrations/00008_rls_hardening.sql`
Migración idempotente que: asegura `user_id`, habilita RLS, recrea políticas
con `WITH CHECK` en UPDATE, agrega índice único `sales(user_id, code)` y
índices de RLS. **Impacto:** si en tu proyecto Supabase real hay filas sin
`user_id`, quedarán invisibles hasta asignarlas (el backfill comentado las
asigna al primer usuario) — decide la política.

### 6.2 Revocar la clave Gemini expuesta
`GEMINI_API_KEY` de `.env.local.example` estuvo en el repo. **Impacto:**
nadie debería haberla usado fuera de tu cuenta; revocarla corta el asistente
de voz hasta reconfigurar con una clave nueva.

### 6.3 Eliminaciones sin soft-delete (F6)
`db.categories.delete(id)` / `db.types.delete(id)` borran en firme; si el
remoto aún tiene la fila, el pull la re-crea. **Decisión:** (a) soft-delete
(consistente con el resto) o (b) dejar borrado físico documentado. No lo
cambié para no alterar UX sin tu OK.

### 6.4 Sesión en cookie HttpOnly (F1)
Migrar auth de `localStorage` a cookie con `@supabase/ssr` (ya instalado).
**Impacto:** rompe el flujo actual de demo (sin Supabase) si no se hace con
cuidor; requiere prueba de regresión en auth. Lo dejo fuera de esta tanda.

### 6.5 `xlsx@0.18.5` (F13)
Sin fix compatible; la alternativa (sheetjs CE/`exceljs`) cambia la API de
export. **Decisión:** aceptar el riesgo documentado o migrar en una tarea
separada.

---

## 7. Correcciones aplicadas en esta auditoría

| Archivo | Cambio |
|---------|--------|
| `src/features/sales/domain/saleRules.ts` | `syncStatus: "local"` → `"pending"` (sale + saleDetail) |
| `src/features/purchases/domain/purchaseRules.ts` | idem (purchase + purchaseDetail) |
| `src/features/sales/services/productService.ts` | idem (product + inventoryMovements) |
| `src/features/sales/services/customerService.ts` | idem (customer) |
| `src/app/categories/page.tsx`, `src/app/types/page.tsx` | idem |
| `src/lib/sync/outbox.ts` | `claimNextBatch` ordena por ranking de dependencias FK |
| `src/lib/sync/sync-supabase.ts` | pull `gt` → `gte` |
| `src/lib/sync/reconcile-pending.test.ts` | **NUEVO**: 4 tests de regresión (C1 y C2) |
| `src/features/purchases/domain/purchaseRules.test.ts` | aserciones `"local"` → `"pending"` |
| `src/app/api/voice/parse/route.ts` | auth-if-configured, rate limit, tamaño máx., header `x-goog-api-key`, logs truncados |
| `src/components/layout/ClientLayout.tsx` | registra `/sw.js` |
| `public/sw.js` | fallback de navegación a `/` (offline) |
| `.env.local.example` | clave real removida |
| `supabase/migrations/00008_rls_hardening.sql` | **NUEVO**: hardening RLS autocurable |
| `apps/mobile/src/core/db/repo.ts` | `writeTx`: padre antes que hijos |
| `apps/mobile/src/core/db/database.ts` | migración transaccional e idempotente |
| `apps/mobile/src/core/sync/syncManager.ts` | pull en 2 fases, guardia local-pendiente, sin `sync_status` en tablas hijas |
| `package.json` | `next` → ^15.5.23 |

**Verificación:** `npm test` 190/190 ✅ · `npx tsc --noEmit` ✅ · `next lint` ✅
(2 warnings preexistentes) · `next build` ✅ · `apps/mobile` typecheck ✅

---

## 8. Ops

- `docs/ops.md`: despliegue PWA/móvil, backups, logging, monitorización,
  checklist de rollout.
- `scripts/backup-supabase.ps1`: backup diario + rotación.
- `apps/mobile/eas.json`: perfiles development/preview/production (Android).
- `.env.production.example`, `apps/mobile/.env.example`.
- Health checks API existentes: `GET /health`, `GET /health/ready`.

---

## 9. Pendiente del roadmap (fuera de esta auditoría)

Integración de IA/OCR (8 features) ya acordada en decisiones previas
(Gemini único, OCR híbrido, F1 = Núcleo + OCR): capas `src/lib/ai/…`, contrato
de confirmación, endpoint `/ai` endurecido con el mismo patrón de
`/api/voice/parse`. No se implementó porque la auditoría tiene prioridad.

---

## 10. Puesta en producción (aplicado)

Endurecimiento adicional entregado tras esta auditoría:

- **API — inyección SQL por nombres de columna:** `apps/api/app/sync_service.py`
  ahora tiene `COLUMNS` (lista blanca por tabla). Las claves del `payload` del
  cliente se filtran antes de interpolarse en SQL; claves desconocidas se
  descartan. Los nombres de tabla siguen saliendo del mapa constante `TABLES`.
- **API — bug de cursor:** `pull_changes` usa `updated_at >= $2` (antes `>`),
  mismo criterio que la PWA (`gte`).
- **API — config segura por defecto:** `cors_origins=[]` (la app móvil nativa
  no necesita CORS; ya no hay wildcard con `allow_credentials=True`),
  `requirements.txt` pineado a versiones instaladas, `Dockerfile`
  (uvicorn + proxy-headers), `.dockerignore`.
- **PWA — headers de seguridad** en `next.config.ts`: CSP (default-src 'self',
  connect-src incluye Supabase), `nosniff`, `Referrer-Policy no-referrer`,
  `X-Frame-Options DENY`, HSTS, `Permissions-Policy`, `poweredByHeader:false`,
  `output:"standalone"`.
- **PWA — Dockerfile** multi-stage (node 24, standalone) + `.dockerignore`.
- **PWA — límites de error:** `src/app/error.tsx` y `src/app/not-found.tsx`.
- **CI:** `.github/workflows/ci.yml` — job PWA (npm ci, lint, typecheck,
  test:ci, build) y job API (pip install, compileall, import check).
- **package.json:** scripts `typecheck`, `test:ci`, `clean`.
- **README.md:** reescrito (monorepo, migraciones 00001–00008, despliegue).

**Verificación:** `npm test` 190/190 ✅ · `npx tsc --noEmit` ✅ · `next build`
(standalone) ✅ · API `compileall` + import ✅.

## 11. Hallazgo estructural (decisión requerida)

La PWA sincroniza contra el esquema de `supabase/migrations/` (RLS por
`user_id`, revisiones LWW, campos `color`/`icon`) mientras que la app móvil
sincroniza contra el esquema de `apps/api/migrations/` (FastAPI, precios en
`*_cents`, sin RLS por usuario salvo `user_id` por fila). Son **dos esquemas
divergentes del mismo dominio** que en un futuro podrían pisarse si un mismo
usuario usa ambos clientes.

Recomendación a corto plazo: mantenerlos aislados y no mezclar clientes para
el mismo negocio. A mediano plazo, converger a un único backend (Supabase +
RLS para ambos) o documentar la partición por negocio. No se modificó código
porque implica migración de datos y cambios de esquema (fuera del alcance de
esta auditoría).
