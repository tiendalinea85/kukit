# CatoLedger — Arquitectura Oficial

> Documento canónico de arquitectura. Detalle operativo de workspaces, modelos de
> negocio y módulos en [`docs/workspaces-architecture.md`](workspaces-architecture.md).
> Informe de seguridad/QA/DevOps en `docs/audit.md`; operaciones en `docs/ops.md`.

**Producto:** aplicación móvil instalable (Android primero), *offline-first*,
multi-workspace, modular y extensible para plataforma empresarial.

---

## 1. Visión y principios

CatoLedger es una plataforma donde cada usuario organiza su información en
**workspaces aislados** y trabaja con **módulos habilitados por workspace**.

Principios no negociables:

1. **Offline-first** — SQLite es la fuente de verdad del dispositivo; la red es una
   mejora, no un requisito.
2. **Multi-workspace** — toda fila de negocio lleva `workspace_id` en todas las capas
   (UI, estado, SQLite, API, PostgreSQL, RLS, sync, reportes).
3. **Aislamiento real** — el backend valida membresía y rol; nunca confía en filtros
   del cliente.
4. **Modularidad** — cada módulo es autocontenido y se habilita por workspace.
5. **Extensible** — añadir un modelo de negocio o módulo nuevo no requiere reescribir
   el núcleo.
6. **No destructivo** — las migraciones preservan los datos existentes y no rompen
   funcionalidades actuales.

---

## 2. Arquitectura propuesta

**Clean Architecture + Feature-Based Modules** con 4 capas estrictas y dependencias
hacia adentro:

```
┌──────────────────────────────────────────────────────────┐
│  PRESENTACIÓN (Expo / React Native)                       │
│  Pantallas · Formularios · Estado de UI · Navegación      │
├──────────────────────────────────────────────────────────┤
│  APLICACIÓN (Casos de uso / orquestación)                 │
│  Transacciones de dominio · Reglas · Puertos              │
├──────────────────────────────────────────────────────────┤
│  DOMINIO (Entidades · Value Objects · Invariantes)        │
│  Cero dependencias externas                               │
├──────────────────────────────────────────────────────────┤
│  INFRAESTRUCTURA (Adaptadores)                            │
│  SQLite · Outbox/Sync · FastAPI client · Auth             │
└──────────────────────────────────────────────────────────┘
          ▲ sincronización por workspace              ▲
┌──────────────────────────────────────────────────────────┐
│  BACKEND FastAPI (única puerta de dominio y sync)        │
│  PostgreSQL · Supabase Auth · RLS · Auditoría            │
└──────────────────────────────────────────────────────────┘
```

**Piezas del monorepo:**

| Pieza | Tecnología | Rol |
|---|---|---|
| `apps/mobile` | Expo RN + expo-sqlite + zustand + @supabase/supabase-js | **Producto oficial** (Android). Offline-first, fuente de verdad SQLite. |
| `apps/api` | FastAPI + asyncpg + PyJWT | Backend de sync y dominio. Valida JWT de Supabase Auth y membresía de workspace. |
| PostgreSQL/Supabase | Supabase Auth + Postgres + RLS | Autenticación, registro central, aislamiento por RLS (defensa en profundidad). |
| PWA (raíz) | Next.js + Dexie + Supabase | Frontend web existente; se mantiene operativo y convergerá a este modelo en fases posteriores. |

**Stack (oficial, móvil + API):**

- Móvil: React Native 0.86, Expo SDK 57, expo-sqlite, zustand, zod, @react-navigation,
  @supabase/supabase-js, expo-secure-store, expo-crypto.
- API: FastAPI, asyncpg, pydantic, pydantic-settings, PyJWT, uvicorn.
- DB: PostgreSQL (Supabase). Auth: Supabase Auth (email/password + OTP). JWT HS256 con
  `audience="authenticated"`.

---

## 3. Estructura de carpetas

**Móvil (`apps/mobile/src/`) — feature-based con núcleo compartido:**

```
src/
  core/                     # Núcleo sin features
    auth/                   # Cliente Supabase, store de sesión, SecureStore
    db/                     # SQLite: migraciones (v3), repos base, outbox, audit
    workspace/              # workspaceStore (zustand) + catálogo módulos/modelos  [NUEVO]
    sync/                   # Sync engine por workspace (apiClient, syncManager)
    domain/                 # Tipos de dominio (Workspace, Module, entidades)
    errors/                 # Errores tipados (Result/Either)
    logging/                # Logger jerárquico
    utils/                  # id (UUID), códigos por workspace, formato
  features/                 # Cada módulo: screens + components + hooks + repository
    workspaces/             # Selector principal, Negocio→modelo→crear            [NUEVO]
    expenses/               # Gastos + categorías + detalles (transversal)
    catalog/                # Productos + categorías de producto
    customers/              # Clientes
    suppliers/              # Proveedores (entidad preparada, UI posterior)       [PREP]
    purchases/              # Compras
    sales/                  # Ventas (registro interno)
    inventory/              # Movimientos de stock (append-only)
    investments/            # Inversiones
    reports/                # Reportes y dashboard (por workspace)
    audit/                  # Auditoría local
    settings/               # Preferencias, sync, perfil
  navigation/               # RootNavigator, MainTabs dinámicos, stacks
  hooks/                    # useLoad, useScopedData (recarga por workspace)
  components/ui/            # Primitivas UI reutilizables
```

**API (`apps/api/app/`):**

```
app/
  main.py                   # FastAPI, lifespan, monta routers
  config.py                 # Settings pydantic (DATABASE_URL, JWT, CORS)
  db.py                     # Pool asyncpg + runner de migraciones
  auth.py                   # Verificación JWT Supabase → AuthUser
  schemas.py                # Schemas pydantic de sync y workspaces
  workspace_service.py      # Membresías, roles, CRUD workspaces/módulos          [NUEVO]
  sync_service.py           # Push/pull por workspace + guard anti-cruce
  routers/
    health.py
    sync.py                 # POST /sync/push, POST /sync/pull (con workspace_id)
    workspaces.py           # GET/POST /workspaces                                [NUEVO]
migrations/
  00001_init.sql            # Esquema actual (12 tablas, user_id, RLS)
  00002_workspaces.sql      # workspaces, models, modules, workspace_modules      [NUEVO]
tests/                      # Unit tests de aislamiento (conn asyncpg mock)      [NUEVO]
```

---

## 4. Modelo de datos conceptual

```
auth.users (Supabase)
    │
    └─< workspace_members (workspace_id, user_id, role)
         OWNER | ADMIN | USER | READ_ONLY
             │
             ├── workspaces (id, parent_id, name, type, model_key, status)
             │     PERSONAL | TRABAJO | ESTUDIO | NEGOCIO | BUSINESS
             │        └── (BUSINESS) ──< parent_id = contenedor NEGOCIO
             │
             ├── workspace_modules (workspace_id, module_key)
             │
             ├── business_models (key, name, is_custom)          ── plantilla
             │      └── business_model_modules (model_key, module_key)
             │
             └── modules (key, name, category, status, version)  ── catálogo

Tablas de dominio (12) + suppliers:  id, workspace_id, ...datos, deleted, sync_status
  products, purchases(+items), expenses(+details), investments,
  stock_movements, clients, sales(+items), categories, expense_types
Colas y metadatos: outbox, audit_log, sync_state, settings
```

Reglas:

- Toda fila de dominio pertenece a un único workspace (`workspace_id NOT NULL`).
- Códigos únicos por workspace: `UNIQUE(workspace_id, code)`.
- `NEGOCIO` es contenedor (sin datos propios); sus hijos son `BUSINESS`.
- El `model_key` liga un workspace `BUSINESS` a su plantilla; los módulos habilitados
  viven en `workspace_modules`.

Detalle de esquemas SQL (SQLite v3 y PostgreSQL `00002`) en
`docs/workspaces-architecture.md` §6 y §7.

---

## 5. Sistema de Workspaces

- Cuatro espacios principales: **Personal**, **Trabajo**, **Estudio**, **Negocio**.
- Personal/Trabajo/Estudio → workspaces directos con módulos `expenses` + `reports`.
- Negocio → contenedor; permite crear **espacios de trabajo empresariales** eligiendo
  un modelo de negocio.
- Flujo de creación: `Negocio → "Crear espacio de trabajo" → modelo → (custom: elegir
  módulos) → nombre/descripción → crear`.
- El workspace activo se persiste en `settings.active_workspace_id` y funciona sin red.
- Al cambiar de workspace: se actualiza `activeWorkspaceId`, se limpian estados
  temporales y se recargan datos/dashboard/reportes/filtros sin mostrar datos del
  workspace anterior.

Detalle completo: `docs/workspaces-architecture.md` §2, §6, §9.

---

## 6. Sistema de módulos

- **Módulos core (v1):** `expenses`, `products`, `inventory`, `purchases`,
  `suppliers`, `sales`, `customers`, `investments`, `reports`.
- **Transversales:** `expenses` y `reports` activos en todo workspace operativo.
- **Especializados (declarados, NO implementados):** `tailoring`, `agriculture`,
  `automotive_parts`, `breeding`, y futuros (producción, panadería, restaurante,
  transporte, ganadería, piscicultura, carpintería, ferretería, servicios
  profesionales, etc.).
- Los modelos de negocio definen los módulos **sugeridos** (`business_model_modules`);
  `custom` permite selección manual.
- La UI (pestañas, menús, accesos) se construye solo con los módulos habilitados del
  workspace activo (`workspace_modules`).

Detalle completo: `docs/workspaces-architecture.md` §2.3–2.5 y §9.

---

## 7. Flujo Offline First

```
Lectura (siempre local):
  UI → caso de uso → repositorio → SQLite (filtrado por workspace activo)

Escritura offline:
  UI → caso de uso → repositorio escribe en SQLite (con workspace_id)
                    → outbox (status=pending, workspace_id, payload, UUID)
                    → auditoría local (workspace_id, user_id, device_id, origin)

Reconexión:
  SQLite (outbox) → Sync Engine → API (/sync/push, workspace_id) → PostgreSQL/Supabase
  PostgreSQL → API (/sync/pull, workspace_id) → Sync Engine → SQLite (upsert idempotente)
```

- SQLite es la fuente de verdad del dispositivo; el servidor replica (consistencia
  eventual).
- Arranque 100 % offline: registrar, consultar y generar reportes funcionan sin red.
- El seed de categorías/tipos se ejecuta por workspace activo.
- Cada operación conserva `workspace_id` durante todo su ciclo de vida.

---

## 8. Flujo de sincronización

**Push (cliente → servidor):**

- Outbox ordenado y particionado por `workspace_id` (solo drena el del workspace activo).
- Cada cambio lleva `workspace_id` + `id` UUID (generado en el dispositivo) → idempotencia.
- El servidor valida `Authenticated User → Membership → Role → Operation` y escribe
  SIEMPRE el `workspace_id` validado (ignora el del payload).
- Upsert idempotente: `INSERT ... ON CONFLICT (id) DO UPDATE SET ... WHERE <tabla>.workspace_id = $ws`
  (un cambio de otro workspace jamás modifica fila ajena).
- `READ_ONLY` no puede hacer push (403).

**Pull (servidor → cliente):**

- Incremental con **cursor por workspace y entidad** (`last_pull:<workspace_id>:<entity_type>`),
  filtrado `workspace_id = $ws AND updated_at >= $cursor`, ordenado ASC.
- Aplicación local en transacción: primero cabeceras, luego hijos; no sobreescribe filas
  locales `pending`.
- Los workspaces/módulos/roles se sincronizan por usuario (`GET /workspaces`) para
  alimentar el selector antes de entrar.

**Robustez y conflictos:**

- Reintentos con backoff exponencial + jitter; recuperación de operaciones estancadas.
- Conflictos: **LWW** por `updated_at` (y `revision` en el motor web) → gana el más
  reciente; el local pendiente se conserva.
- Estados: `pending → syncing → synced | failed | conflict`.
- Los datos de Workspace A nunca se envían ni aplican en Workspace B.

---

## 9. Seguridad

| Aspecto | Mecanismo |
|---|---|
| Autenticación | Supabase Auth (email/password + OTP); sesión persistida en SecureStore/Keychain. |
| Autorización API | JWT HS256 (`audience=authenticated`); `sub` = `user_id`; validación de membresía y rol por request. |
| Cadena de validación | `Authenticated User → Workspace Membership → Role → Permission → Operation`. |
| Anti-spoofing | El servidor inyecta `workspace_id` y `user_id`; nunca se confía en los del payload. |
| RLS (PostgreSQL) | Políticas por membresía (`workspace_id IN (SELECT ... FROM workspace_members WHERE user_id = auth.uid())`); defensa en profundidad para accesos directos. |
| Datos en reposo (local) | SecureStore para credenciales; cifrado SQLite (SQLCipher) previsto en fase de endurecimiento. |
| Inyección SQL | Lista blanca de columnas por tabla (FastAPI) + SQL parametrizado. |
| Dinero | Enteros (centavos), nunca flotantes. |
| Secretos | Solo en variables de entorno (`*.env.example` versionado). |

---

## 10. Auditoría

- **Local (offline):** `audit_log` con `workspace_id, user_id, device_id, action,
  entity_type, entity_id, before, after, origin ('ONLINE'|'OFFLINE'), created_at`.
- **Servidor:** tabla `audit_log` append-only (`workspace_id, user_id, action,
  entity_type, entity_id, before, after, server_ts, device_id`) con RLS que deniega
  UPDATE/DELETE; se entrega junto con el sync (fase de sincronización).
- Ejemplo: `Usuario: Erick · Workspace: Negocio 1 · Acción: CREATE · Entidad: SALE ·
  Registro: <uuid> · Fecha: … · Origen: OFFLINE`.

---

## 11. Manejo de errores

- Errores tipados (Result/Either) en dominio; clasificación: validación local,
  almacenamiento, red/offline, servidor 4xx/5xx, conflicto de sync.
- Estrategias por tipo: reintento (red/offline), backoff + circuit breaker (sync),
  mensajes claros por operación fallida (UI), panel de estado de sync con pendientes y
  errores individuales.
- La app nunca pierde una operación pendiente: queda en el outbox con su `workspace_id`.

---

## 12. Roadmap (desarrollo por etapas)

| Etapa | Entregable | Estado |
|---|---|---|
| 0 — Definición | Arquitectura oficial + workspaces/modelos/módulos definidos | ✅ documento |
| A — Server | Migración `00002` (workspaces, members, models, modules, workspace_modules, workspace_id, índices, RLS) + FastAPI (`/workspaces`, sync por workspace, validación de rol) | pendiente |
| B — SQLite v3 | Tablas locales, `workspace_id`, índices únicos `(workspace_id, code)`, backfill no destructivo | pendiente |
| C — Estado y repos | `workspaceStore`, catálogo módulos/modelos, filtros por workspace en repos/reportes/dashboard | pendiente |
| D — Sync | API client y sync manager por workspace; sync de workspaces/roles | pendiente |
| E — UI | Selector de espacios, flujo Negocio→modelo→crear, tabs dinámicos, permisos READ_ONLY | pendiente |
| F — Pruebas | Checklist de aislamiento (online + offline + post-sync) | pendiente |
| G — Endurecimiento | Cifrado local, backups, Sentry, AAB/Play Store, auditoría server-side | futuro |

---

## 13. Estado de implementación actual

- **Móvil (`apps/mobile`):** dominio completo offline-first en SQLite (v2) con outbox y
  pull incremental. Sin concepto de workspace (aislamiento implícito por dispositivo).
  Sync contra `apps/api` autenticado con JWT de Supabase.
- **API (`apps/api`):** 12 tablas con `user_id`, push/pull por `user_id`, RLS por
  usuario, migración `00001`. Sin workspaces.
- **PWA (raíz):** prototipo web con motor de sync propio (Dexie, outbox, LWW,
  watermarks) contra Supabase; sin workspaces.
- **Divergencia documentada:** PWA y API móvil usan esquemas distintos (`docs/audit.md`
  §hallazgo estructural). La arquitectura oficial converge en `workspace_id` y la PWA
  se alineará en fases posteriores.
- **Motor de sync del prototipo web** (detallado en la versión previa de este doc):
  190 tests en verde (`npm test`), outbox con dedup, backoff, conflictos LWW por
  `revision`, watermarks, detector de conexión.
