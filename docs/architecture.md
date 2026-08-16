# CatoLedger — Arquitectura Técnica y Funcional

Arquitectura *Offline First* para aplicación móvil Android (React Native + Expo), con backend FastAPI + PostgreSQL + Supabase Auth, y SQLite como fuente de verdad local.

---

## 1. Arquitectura General

**Estilo: Clean Architecture + Feature-Based Modules.** 4 capas estrictas con dependencias dirigidas hacia adentro:

```
┌─────────────────────────────────────────────────────────┐
│  PRESENTACIÓN (Expo / React Native)                     │
│  Pantallas · Formularios · Estado de UI · Navegación    │
├─────────────────────────────────────────────────────────┤
│  APLICACIÓN (Casos de uso / orquestación)               │
│  Transacciones de dominio · Reglas · Puertos            │
├─────────────────────────────────────────────────────────┤
│  DOMINIO (Entidades · Value Objects · Invariantes)      │
│  Cero dependencias externas — lógica de negocio pura    │
├─────────────────────────────────────────────────────────┤
│  INFRAESTRUCTURA (Adaptadores)                          │
│  SQLite · Outbox/Sync · FastAPI client · Auth           │
└─────────────────────────────────────────────────────────┘
          ▲ sincronización (RPC)                  ▲
┌─────────────────────────────────────────────────────────┐
│  BACKEND FastAPI (único punto de entrada de dominio)    │
│  PostgreSQL · Supabase Auth · Storage                   │
└─────────────────────────────────────────────────────────┘
```

**Estructura del monorepo:**

```
cato-ledger/
├─ apps/
│  ├─ mobile/        # Expo + React Native + TypeScript
│  └─ api/           # FastAPI + Python
├─ packages/
│  └─ contracts/     # Schemas OpenAPI compartidos (generados desde FastAPI)
├─ infra/            # Migraciones SQL, RLS, docker-compose, CI/CD
└─ docs/             # ADRs, arquitectura, roadmap
```

- **Contratos compartidos**: el API de FastAPI genera el esquema OpenAPI; el móvil genera clientes y tipos TypeScript a partir de él. Un solo origen de verdad para payloads de sync.
- **Backend como Gateway de Dominio**: el cliente NO usa el REST de Supabase para lógica de negocio; solo `Auth` y `Storage`. Todo el dominio vive en FastAPI → un solo lugar con las reglas.

---

## 2. Módulos

Cada módulo es autocontenido (UI + casos de uso + dominio + repositorio):

| Módulo | Responsabilidad |
|---|---|
| `auth` | Sesión, login/logout, refresh, onboarding del negocio |
| `catalog` | Productos + Categorías (CRUD, estado activo/inactivo) |
| `purchases` | Compras a proveedores (documento, items, entrada a inventario) |
| `expenses` | Gastos operativos (tipo, método de pago, categoría) |
| `investments` | Inversiones (activo, monto, fecha, valoración) |
| `inventory` | Movimientos de stock (entrada, salida, ajuste, transferencia) |
| `customers` | Clientes (datos, historial de operaciones) |
| `sales` | Registro interno de operaciones (items, descuentos, impuestos) |
| `reports` | Agregaciones y consultas (local y servidor) |
| `sync` | Outbox, pull incremental, conflictos, cola, estado de conexión |
| `audit` | Registro inmutable de acciones |
| `settings` | Preferencias, backup/restore, perfil del negocio |

Los módulos `sync` y `audit` son transversales (capa de infraestructura compartida).

---

## 3. Dominio

**Entidades raíz y relaciones funcionales:**

```
Business ──< User
   └──< Category ──< Product ──< SaleItem
   └──< Product ──< PurchaseItem
   └──< Purchase ──< StockMovement (entrada)
   └──< Sale ──< StockMovement (salida)
   └──< Expense           (independiente — nunca toca stock)
   └──< Investment        (independiente — nunca toca stock)
   └──< Client ──< Sale (referencia de operación)
   └──< StockMovement (ajustes/transferencias)
```

**Value Objects:** `Money` (integer cents), `Quantity`, `TaxRate`, `DateRange`, `SKU`, `Phone`, `EntityId` (UUID), `ServerTimestamp`.

**Invariantes clave del dominio:**
- Compras, gastos e inversiones son **agregados separados e intransferibles** entre sí. La compra alimenta inventario; el gasto y la inversión no.
- La venta es **solo registro interno** (no e-commerce): no hay carrito, checkout ni catálogo público. La venta decrementa stock solo al pasar a estado `completada`.
- La compra incrementa stock solo al pasar a `recibida`.
- Inventario se modela como **secuencia de movimientos** (append-only), nunca como saldo mutado directamente → permite reconstruir y auditar.
- `Money` siempre en enteros (centavos) para evitar errores de punto flotante.

---

## 4. Flujo de Datos

**Lectura** (siempre local): UI → caso de uso → repositorio → **SQLite** (fuente de verdad del dispositivo). Nada de red para renderizar.

**Escritura offline:** UI → caso de uso → repositorio escribe en SQLite + inserta evento en **Outbox** (estado `pendiente`). UI optimista (confirmación inmediata).

**Cuando hay conexión:** `sync` drena la cola → push → ack servidor → marca `enviado`. En paralelo, pull incremental trae cambios del servidor.

**Reportes:** agregaciones locales para rangos pequeños; consultas pesadas se delegan al servidor (materialized views) y se cachean localmente.

---

## 5. Offline First

- SQLite es **la fuente de verdad del dispositivo**; el servidor replica los mismos datos (consistencia eventual).
- **CQRS táctico**: writes van por outbox (comandos), reads van directo a SQLite (queries). Los comandos nunca bloquean la UI.
- Detección de conexión con `NetInfo` + cola de reintentos automática.
- **Arranque offline total**: el 100% de las funciones de registro/consulta funcionan sin red; la sincronización es una mejora, no un requisito.
- Migraciones locales versionadas: el esquema viaja con la app.

---

## 6. Sincronización

**Push (cliente → servidor):**
- Outbox ordenado **topológicamente** (cliente → pedido → venta) para respetar dependencias.
- Cada registro lleva `client_uuid` (UUID v4 generado en el dispositivo) → **idempotencia**: el servidor rechaza duplicados.
- Endpoint RPC `sync.push(batch)` con lotes atómicos por `business_id`.

**Pull (servidor → cliente):**
- Incremental con **cursor/watermark** (`last_synced_at` + clave ordenada), paginado.
- Los borrados se propagan como **tombstones** (para no romper referencias del cliente).
- El cliente aplica los cambios también en orden (movimientos de stock de forma secuencial).

**Conflictos:** modelo **LWW** (Last-Write-Wins) con `updated_at` del servidor como árbitro + `revision` para detectar escrituras perdidas. Inventario se resuelve por diseño: solo se sincronizan movimientos append-only, nunca saldos.

**Robustez:** reintentos con **backoff exponencial + jitter**, *circuit breaker* en el cliente, y verificación de checksum por lote.

---

## 7. Seguridad

- **Auth:** Supabase Auth (email/password + magic link). Sesión con access + refresh token; refresh automático antes de expirar.
- **Almacenamiento de credenciales:** SecureStore / Keychain; nunca en AsyncStorage ni en texto plano.
- **Autorización:** Multi-tenancy desde el día 1 — toda fila lleva `business_id`; **RLS** en Postgres por tenant y rol (propietario / miembro).
- **API:** validación estricta con Pydantic, rate limiting, HTTPS, verificación JWT en cada request, CORS cerrado (aunque es app nativa).
- **En reposo (local):** SQLite encriptado (SQLCipher) con clave derivada en SecureStore. *Fase 5.*
- **Dinero:** enteros; nunca flotantes.
- **Secretos:** solo en variables de entorno, nunca en el repo (`.env.example` versionado).

---

## 8. Persistencia Local

- **`expo-sqlite`** + WAL mode + transacciones.
- **Grupos de tablas:**
  1. **Dominio** — entidades del negocio (productos, compras, ventas, etc.).
  2. **Outbox** — cambios pendientes de push (payload, estado, intentos).
  3. **Sync metadata** — cursors, tombstones, último `updated_at`.
  4. **Auditoría local** — log de acciones del dispositivo (volcado al servidor).
- Migraciones versionadas con número de esquema en el paquete de datos.
- **Backup/Restore** a archivo ZIP encriptado (exportar/importar) para migración de dispositivo.

---

## 9. Persistencia Remota

- **PostgreSQL** (Supabase) como sistema de registro central.
- **FastAPI** como única puerta de dominio y sync; **Supabase** aporta Auth, Postgres y Storage (imágenes de productos/adjuntos de compras).
- Migraciones SQL versionadas bajo `infra/migrations/` con RLS aplicado.
- Particionado futuro por `business_id` para escalar reportes y tablas de alta escritura (auditoría, movimientos).

---

## 10. Auditoría

- **Tabla `audit_log`** append-only: `business_id, user_id, action, entity_type, entity_id, before, after, server_ts, device_id`.
- **Inmutable por diseño**: RLS deniega UPDATE/DELETE + trigger que rechaza modificaciones.
- Doble vía: eventos de negocio (dominio) + logs estructurados JSON en infraestructura (request_id, trace_id).
- Las acciones offline se registran localmente y se entregan junto con el sync para no perder rastro.

---

## 11. Manejo de Errores

- **Errores tipados (Result/Either)** en dominio; nunca excepciones crudas cruzando capas.
- **Clasificación:** validación local · almacenamiento · red/offline · servidor 4xx/5xx · conflicto de sync.
- **Estrategias por tipo:** reintento (red), backoff + circuit breaker (sync), deshacer (colas), mensajes claros por item fallido (UI).
- **Visibilidad:** pantalla de estado de sincronización con la cola, items pendientes y errores individuales; el usuario siempre sabe qué falta enviar.
- **Crash reporting:** Sentry con contexto de sesión.

---

## 12. Escalabilidad

- FastAPI **stateless** → escala horizontalmente detrás de load balancer; PostgreSQL con pool y read replicas para reportes.
- Sync por tenant aislado: lotes paginados, sin escaneos completos, con cursor.
- Reportes server-side con materialized views; el cliente solo consume resultados.
- Assets vía CDN/Storage de Supabase.
- Backpressure en el servidor: throttling por `business_id` para evitar picos de push tras reconexiones masivas.
- Multi-tenancy como requisito desde la fase 0 (nunca refactorizar después).

---

## 13. Roadmap

| Fase | Entregable |
|---|---|
| **0 — Fundación** | Monorepo, CI/CD, contrato OpenAPI, autenticación, RLS, esqueleto SQLite |
| **1 — Núcleo offline** | Dominio completo (productos, categorías, compras, gastos, inversiones, inventario, clientes, ventas) 100% offline |
| **2 — Sincronización v1** | Outbox push + pull incremental + idempotencia + LWW |
| **3 — Reportes** | Agregaciones server-side + consultas locales + dashboard |
| **4 — Auditoría completa** | Audit log inmutable + visibilidad en app |
| **5 — Endurecimiento** | SQLite cifrado, backups, Sentry, Play Store (AAB), hardening |
| **6 — Expansión** | iOS, multi-usuario/roles, read replicas, particionado |

---

## Estado de implementación en `zane-app`

El repo actual es un prototipo Next.js (web/PWA) que ya implementa parte del dominio (productos, categorías, compras, gastos, inversiones, ventas, clientes, inventario) con Supabase como backend. La arquitectura objetivo (mobile offline-first) se construirá de forma incremental sobre el mismo dominio, migrando el esquema de datos y el modelo de sincronización hacia el diseño aquí descrito.

### Sincronización Offline First implementada

El prototipo ya cuenta con un motor de sincronización Offline First en `src/lib/sync/`:

**Pila (local → remoto):**
- **Dexie (IndexedDB)** como fuente de verdad local (tablas de dominio + `syncOutbox`, `syncLog`, `syncState`).
- **Outbox** (`syncOutbox`): una operación por `(entity, entityId)` con deduplicación — los reintentos nunca duplican registros. Estados `pending → syncing → synced | failed | conflict`.
- **Idempotencia:** upsert por `id` (master data), `INSERT ... ON CONFLICT DO NOTHING` (movimientos de inventario, append-only) y guardado condicional por `revision` (operaciones registradas: ventas, compras, gastos, inversiones).
- **Reconciliación:** al inicio de cada pasada, los registros marcados `pending` sin operación en el outbox se encolan automáticamente. Todo registro creado por el usuario se marca `pending` al nacer (auditoría 2026-08: se corrigió un bug en el que ventas/compras/productos/clientes/categorías/tipos se creaban con `syncStatus: "local"` y nunca se sincronizaban).
- **Orden de push por dependencias:** `claimNextBatch` ordena por ranking FK (categorías/tipos/clientes/productos → operaciones → cabeceras → detalles) para no violar claves foráneas del servidor.
- **Detector de conexión:** `navigator.onLine` + heartbeat HTTP contra `{SUPABASE_URL}/auth/v1/health`.

**Pull (remoto → local):**
- Incremental por **watermark** por tabla (`updated_at`/`created_at`), paginado (500). El filtro usa `>=` (`gte`) para no saltar filas con `updated_at` idéntico al watermark.
- Merge **LWW + revisión**: si el local está `pending` y el remoto es más nuevo, se conserva el local y se marca `conflict`; nunca se descarta una operación sin enviar.
- Movimientos de inventario: si el id ya existe localmente se considera aplicado (inmutable).

**Robustez:**
- Reintentos con **backoff exponencial + jitter** (`backoff.ts`), reintento programado al `retryAt` más cercano.
- Clasificación de errores (`errors.ts`): `network/timeout/server` retryable; `validation/auth/conflict` permanentes.
- Recuperación de fallos: operaciones estancadas en `syncing` (app cerrada a mitad de sync) vuelven a `pending` al arrancar.
- Motor con guard antirreentrada; deps inyectables (transporte, conexión, timers) → testeable en Node.

**UI:** estado global `useSyncStore` (Zustand) con `online`, `status` (`idle/syncing/synced/error/offline`), conteos pendientes/errores/conflictos, última sincronización. Indicador compacto en la barra superior, badge de estado en el dashboard y panel de sincronización en Ajustes con "Sincronizar ahora" y "Reintentar".

**Servidor:** migración `supabase/migrations/00007_sync_engine.sql` — `revision` + trigger `bump_revision()` en operaciones registradas, tablas de compras, `category_id` en productos, CHECKs de inventario ajustados y `sync_log`.

**Pruebas:** `npm test` — 190 tests (122 existentes + 64 de sincronización + 4 de regresión de la auditoría) con `node --test` y `fake-indexeddb` cubriendo: backoff, clasificación de errores, estrategia de conflictos, outbox (dedup, claim, hash en vuelo, backoff, recuperación de fallos, reconciliación, orden de push por dependencias), detector de conexión y el motor completo (offline, red intermitente, reintentos sin duplicados, conflicto push/pull, cierre de app durante el sync).
