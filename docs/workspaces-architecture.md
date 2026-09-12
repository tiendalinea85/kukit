# CatoLedger — Arquitectura de Workspaces, Modelos de Negocio y Módulos

> **Estado:** DEFINIDO (etapa de diseño). Este documento es la fuente de verdad de la
> arquitectura multi-workspace. Ningún módulo específico se implementa en esta etapa;
> la implementación se ejecutará por fases según el plan de migración (sección 12).

Fecha de definición: 2026-08.

---

## 1. Propósito

CatoLedger es una plataforma *offline-first* instalable (Android primero) donde cada
usuario organiza su información en **espacios de trabajo (workspaces)** completamente
aislados. Cada workspace habilita únicamente los **módulos** que le corresponden.

Esta arquitectura cubre todas las capas: UI, estado global, SQLite, Sync Engine,
FastAPI, PostgreSQL y Row Level Security.

Reglas no negociables:

- Toda fila de negocio lleva `workspace_id` (local y remoto).
- El backend valida membresía y rol del usuario sobre el workspace; nunca confía en
  filtros del cliente.
- Un cambio creado en un workspace nunca se sincroniza ni aparece en otro.
- Los reportes y el dashboard operan exclusivamente sobre el workspace activo.
- La UI solo muestra los módulos habilitados del workspace activo.
- No se borran datos existentes y no se rompen funcionalidades actuales.

---

## 2. Modelo conceptual

### 2.1 Espacios principales

Al iniciar sesión el usuario elige un espacio principal:

| Espacio | Tipo | Comportamiento |
|---|---|---|
| **Personal** | `PERSONAL` | Workspace directo. Solo gastos + reportes. |
| **Trabajo** | `TRABAJO` | Workspace directo. Solo gastos + reportes. Aislado de Personal. |
| **Estudio** | `ESTUDIO` | Workspace directo. Solo gastos + reportes. Aislado. |
| **Negocio** | `NEGOCIO` | **Contenedor**. No tiene datos propios; agrupa los workspaces de negocio del usuario. |

`PERSONAL`, `TRABAJO` y `ESTUDIO` son **workspaces operativos** de primer nivel
(`parent_id IS NULL`). `NEGOCIO` es un **workspace contenedor** de primer nivel que
aloja a los workspaces de negocio.

### 2.2 Workspace

Unidad de aislamiento de datos. Campos:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | Generado en el dispositivo. |
| `parent_id` | UUID \| null | Solo los workspaces `BUSINESS` apuntan al contenedor `NEGOCIO`. |
| `name` | text | "Taller Mary", "Finca San José", "Personal". |
| `type` | enum | `PERSONAL \| TRABAJO \| ESTUDIO \| NEGOCIO \| BUSINESS`. |
| `model_key` | text \| null | Plantilla usada al crearlo (solo `BUSINESS`). |
| `description` | text | Opcional. |
| `status` | enum | `active \| archived`. |
| `created_at` / `updated_at` | timestamp | UTC. |
| `role` | enum | Rol del usuario en este workspace (local). Se deriva de `workspace_members` en el servidor. |

### 2.3 Modelo de negocio (plantilla)

> Un modelo **NO es un workspace**. Es una plantilla/configuración que determina qué
> módulos estarán disponibles. El workspace es la instancia creada por el usuario.

Catálogo inicial (extensible sin tocar el núcleo):

| key | Nombre | Módulos por defecto |
|---|---|---|
| `tailoring` | Taller de confección | expenses, products, inventory, purchases, suppliers, sales, customers, investments, reports |
| `agriculture` | Agricultura | expenses, purchases, inventory, suppliers, reports |
| `automotive_parts` | Repuestos automotrices | expenses, products, inventory, purchases, sales, customers, suppliers, reports |
| `breeding` | Crianza | expenses, purchases, inventory, suppliers, reports |
| `commerce` | Comercio | expenses, products, inventory, purchases, sales, customers, suppliers, reports |
| `services` | Servicios | expenses, customers, sales, reports |
| `custom` | Modelo personalizado | Selección manual del usuario |

Los módulos especializados futuros de cada modelo (`tailoring`, `agriculture`,
`automotive_parts`, `breeding`) se declaran en el catálogo pero **no se implementan**
en esta etapa.

### 2.4 Módulo

Entidad declarativa, extensible:

| Campo | Tipo |
|---|---|
| `id` | UUID |
| `key` | slug único: `expenses`, `inventory`, `purchases`, `sales`, `customers`, `suppliers`, `products`, `investments`, `reports`, `tailoring`, ... |
| `name` | nombre para UI |
| `description` | descripción |
| `category` | agrupación (`finance`, `catalog`, `operations`, `people`, `analytics`, `specialized`) |
| `status` | `active \| disabled` |
| `version` | int (para evolución de módulos) |

Catálogo núcleo (v1):

- `expenses` — Gastos + categorías + detalles + consultas + reportes. **Transversal: todos los workspaces lo tienen.**
- `products` — Productos y categorías de catálogo.
- `inventory` — Inventario y movimientos de stock (append-only).
- `purchases` — Compras.
- `suppliers` — Proveedores.
- `sales` — Ventas (registro interno, no e-commerce).
- `customers` — Clientes.
- `investments` — Inversiones.
- `reports` — Reportes y dashboard. **Transversal.**

Catálogo especializado (declarado, NO implementado):

- `tailoring` — Producción, órdenes, materiales, costos, prendas, tallas, colores.
- `agriculture` — Cultivos, lotes, siembras, aplicaciones, insumos, labores, cosechas.
- `automotive_parts` — Marca, modelo, año, compatibilidad, número de parte.
- `breeding` — Animales, especies, lotes, alimentación, reproducción, nacimientos, mortalidad, producción.

### 2.5 workspace_modules

Relación `workspace ↔ módulo habilitado`.

```
workspace_modules:
  workspace_id  UUID  (FK → workspaces.id)
  module_key    text  (FK → modules.key)
  status        enum  ('active', 'disabled')
  created_at    ts
  PK (workspace_id, module_key)
```

Regla: la UI y la navegación de un workspace se construyen **únicamente** con sus
módulos habilitados. `reports` y `expenses` se garantizan activos en todo workspace
operativo (Personal, Trabajo, Estudio y Business).

### 2.6 Jerarquía final

```
LOGIN
 └── Espacios principales (selector)
      ├── Personal     (workspace, modules: expenses, reports)
      ├── Trabajo      (workspace, modules: expenses, reports)
      ├── Estudio      (workspace, modules: expenses, reports)
      └── Negocio      (contenedor)
           ├── "Taller Mary"    (BUSINESS, model=tailoring,          modules según modelo)
           ├── "Finca San José" (BUSINESS, model=agriculture,        modules según modelo)
           ├── "Repuestos XYZ"  (BUSINESS, model=automotive_parts,   modules según modelo)
           └── ... (uno por cada espacio creado)
```

---

## 3. Aislamiento de datos por capa

| Capa | Mecanismo |
|---|---|
| UI | Solo se muestran módulos habilitados y datos del workspace activo. |
| Estado global | Store con `activeWorkspaceId`; al cambiar se limpian estados temporales y se recargan datos. |
| SQLite | Todas las consultas de dominio filtran `workspace_id = active`. Índices por workspace. |
| Sync Engine | Outbox y cursors particionados por workspace; el payload lleva `workspace_id`. |
| API (FastAPI) | Validación `Authenticated User → Workspace Membership → Role → Operation`; el servidor escribe el `workspace_id` validado, ignorando el del payload. |
| PostgreSQL | Columna `workspace_id` en las 12 tablas de dominio + RLS por membresía. |

### 3.1 Cadena de validación (API)

```
Token JWT (sub = user_id)
      ↓
workspace_id (del request, parseado como UUID)
      ↓
workspace_members(workspace_id, user_id) existe?  → 403 si no
      ↓
role → ¿puede escribir? (OWNER|ADMIN|USER)       → 403 si READ_ONLY en push
      ↓
operación con workspace_id del servidor (nunca del payload)
```

### 3.2 Unicidad de códigos por workspace

- Permitido: `LEG-001` en "Taller Mary" y `LEG-001` en "Repuestos XYZ".
- Prohibido: dos `LEG-001` en el mismo workspace.
- Implementación: índice único `(workspace_id, code)` en las tablas con código
  (`products`, `purchases`, `expenses`, `investments`, `clients`, `sales`).
  En SQLite esto requiere reconstruir las 6 tablas (cambiar `UNIQUE(code)` →
  `UNIQUE(workspace_id, code)`); en PostgreSQL se crea el índice único compuesto.

---

## 4. Permisos y roles

Roles iniciales (ordenados de mayor a menor):

| Rol | Puede leer | Puede escribir | Crear/editar workspace |
|---|---|---|---|
| `OWNER` | sí | sí | sí |
| `ADMIN` | sí | sí | sí |
| `USER` | sí | sí | no |
| `READ_ONLY` | sí | no | no |

- El creador de un workspace recibe `OWNER`.
- `workspace_members(workspace_id, user_id, role)` es la fuente de verdad en el
  servidor. El dispositivo guarda `role` localmente para funcionar offline.
- Preparado para permisos granulares futuros: una función
  `has_permission(workspace_id, user_id, action)` consultará membresía + rol y podrá
  extenderse con una tabla de permisos por módulo sin cambiar la API pública.

---

## 5. Auditoría

Tabla local `audit_log` (extendida en SQLite v3):

```
audit_log:
  id           int PK
  workspace_id text NOT NULL
  user_id      text NULL      -- usuario autenticado del dispositivo
  device_id    text NULL
  action       text           -- create | update | delete | stock:<tipo>
  entity_type  text
  entity_id    text
  before       json | null
  after        json | null
  origin       text           -- 'ONLINE' | 'OFFLINE'
  created_at   ts
```

Servidor (fase de sincronización): tabla `audit_log` append-only con
`workspace_id, user_id, action, entity_type, entity_id, before, after, server_ts,
device_id`, RLS que deniega UPDATE/DELETE. Documentado aquí; se implementa junto con
el engine de sync (no en esta etapa de definición).

---

## 6. SQLite — esquema v3 (local, offline-first)

Cambios no destructivos sobre el esquema actual (`apps/mobile/src/core/db/database.ts`,
`SCHEMA_VERSION` 2 → 3):

### 6.1 Tablas nuevas

```sql
CREATE TABLE workspaces (
  id          TEXT PRIMARY KEY NOT NULL,
  parent_id   TEXT,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('PERSONAL','TRABAJO','ESTUDIO','NEGOCIO','BUSINESS')),
  model_key   TEXT,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  role        TEXT NOT NULL DEFAULT 'OWNER',
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE workspace_modules (
  workspace_id TEXT NOT NULL,
  module_key   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at   TEXT NOT NULL,
  PRIMARY KEY (workspace_id, module_key)
);

CREATE TABLE suppliers (
  id           TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL DEFAULT '',
  address      TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  sync_status  TEXT NOT NULL DEFAULT 'pending',
  UNIQUE (workspace_id, code)
);
```

> `suppliers` se crea como entidad preparada (módulo `suppliers` declarado) aunque su
> UI no se implementa en esta etapa.

### 6.2 Cambios en tablas de dominio

- `ADD COLUMN workspace_id TEXT` en las 12 tablas de dominio
  (`categories, products, purchases, purchase_items, expense_types, expenses,
  expense_details, investments, stock_movements, clients, sales, sale_items`)
  + `outbox` + `audit_log`.
- **Backfill no destructivo:** las filas existentes se asignan al workspace
  `PERSONAL` del usuario (se crea automáticamente si no existe). Nada se borra.
- **Reconstrucción de tablas con código** (`products, purchases, expenses,
  investments, clients, sales`) para cambiar `UNIQUE(code)` →
  `UNIQUE(workspace_id, code)` (patrón de 12 pasos de SQLite: crear tabla nueva,
  copiar, drop, rename).
- Índices: `idx_<tabla>_workspace ON <tabla>(workspace_id)` en las 12 tablas.

### 6.3 Settings / estado

```sql
-- tabla settings (ya existe)
active_workspace_id   TEXT    -- workspace activo persistido (funciona offline)
device_id             TEXT    -- UUID del dispositivo (auditoría)
user_id               TEXT    -- usuario autenticado (auditoría)
last_sync_at          TEXT
```

### 6.4 Provisioning local

Al primer inicio (o tras login sin workspaces) se crean los 4 espacios principales:
`PERSONAL`, `TRABAJO`, `ESTUDIO` y el contenedor `NEGOCIO`, con sus
`workspace_modules` por defecto (`expenses`+`reports`). El seed de categorías y tipos
de gasto pasa a ejecutarse **por workspace** (solo en el workspace activo).

---

## 7. PostgreSQL — migración `00002_workspaces`

### 7.1 Tablas nuevas (server)

```sql
CREATE TABLE workspaces (
  id          UUID PRIMARY KEY,
  parent_id   UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('PERSONAL','TRABAJO','ESTUDIO','NEGOCIO','BUSINESS')),
  model_key   TEXT,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN','USER','READ_ONLY')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE business_models (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  is_custom   BOOLEAN NOT NULL DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'active',
  version     INT  NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE modules (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  version     INT  NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE business_model_modules (
  model_key  TEXT NOT NULL REFERENCES business_models(key) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(key) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (model_key, module_key)
);

CREATE TABLE workspace_modules (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module_key   TEXT NOT NULL REFERENCES modules(key),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, module_key)
);
```

### 7.2 Cambios en tablas de dominio

- `ADD COLUMN workspace_id UUID` a las 12 tablas de dominio.
- **Backfill por usuario:** para cada `user_id` con filas se crea (si no existe) su
  workspace `PERSONAL` + membresía `OWNER`, y se reasignan todas sus filas
  (`UPDATE ... SET workspace_id = <personal> WHERE user_id = <u>`) sin borrar nada.
  Los códigos duplicados dentro del mismo workspace se deduplican con sufijo
  (`-D1`, `-D2`, ...) para poder crear el índice único.
- `ALTER COLUMN workspace_id SET NOT NULL`.
- Índices:
  - `idx_<tabla>_workspace (workspace_id)`
  - `idx_<tabla>_workspace_updated (workspace_id, updated_at)` (cursor de pull)
  - `UNIQUE (workspace_id, code)` en `products, purchases, expenses, investments, clients, sales`.
- `user_id` se conserva en las 12 tablas como **origen histórico**, pero el
  aislamiento pasa a `workspace_id`.

### 7.3 RLS

- Tablas de dominio: reemplazar la política `user_id = auth.uid()` por
  `workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())`.
- `workspaces`: visible si el usuario es miembro **o** el workspace es contenedor
  padre de un workspace del que es miembro.
- `workspace_members`: visible para miembros del workspace.
- `workspace_modules`: visible para miembros del workspace.
- `business_models` y `modules`: lectura para cualquier usuario autenticado.

> Nota de seguridad (importante): la API se conecta como rol propietario (`postgres`),
> que omite RLS. El aislamiento operativo real lo garantiza la validación de membresía
> + `workspace_id` inyectado por el servidor en cada SQL. La RLS es defensa en
> profundidad para accesos directos (SQL editor, PostgREST).

---

## 8. Sync Engine (workspace-aware)

### 8.1 Contrato de API

```
POST /sync/push   { workspace_id: UUID, changes: [...] }   → 403 si READ_ONLY / no miembro
POST /sync/pull   { workspace_id: UUID, cursors: {...} }
GET  /workspaces                                  → lista del usuario (con role y módulos)
POST /workspaces  { id, name, type, model_key, description, modules: [...] }
                  → crea workspace + membresía OWNER + workspace_modules (idempotente por id)
```

### 8.2 Reglas

- El servidor **siempre** escribe el `workspace_id` validado; el `workspace_id` del
  payload de cada cambio se descarta (mitigación de spoofing).
- Upsert idempotente por `id` (UUID del dispositivo). El `ON CONFLICT (id) DO UPDATE`
  incluye `WHERE <tabla>.workspace_id = $workspace` para que un cambio de otro
  workspace jamás modifique una fila ajena.
- Cursors por workspace: `last_pull:<workspace_id>:<entity_type>`.
- Outbox por workspace: cada entrada guarda `workspace_id`; el push drena solo el
  outbox del workspace activo.
- La lista de workspaces (y sus módulos/roles) se sincroniza por usuario
  (`GET /workspaces`), no por workspace, ya que el selector necesita conocerlos antes
  de entrar.
- Estados de sync: `pending → syncing → synced | failed | conflict`; reintentos con
  backoff; conflictos resueltos LWW por `updated_at` + `revision`.

---

## 9. Navegación / UI

```
Login
 └── Selector de espacios principales
      [Personal] [Trabajo] [Estudio] [Negocio]
            │                              │
            ▼                              ▼
      MainTabs                      "Mis espacios de negocio"
      (módulos del workspace)       ├─ [Taller Mary]
      expenses+reports              ├─ [Finca San José]
                                    ├─ [Repuestos XYZ]
                                    └─ [+ Crear espacio de trabajo]
                                             │
                                             ▼
                                   Selector de modelo de negocio
                                   (7 tarjetas: 6 modelos + "Personalizado")
                                             │
                                             ▼
                                   (custom) Selección manual de módulos
                                             │
                                             ▼
                                   Form: nombre + descripción → Crear
                                             │
                                             ▼
                                   MainTabs (solo módulos habilitados)
```

- **Header:** selector `[ 🏪 Taller Mary ▾ ]` siempre visible; al tocar se abre el
  cambiador de workspace (nunca se muestra el anterior mientras carga el nuevo).
- **Tabs dinámicos:** `MainTabs` se construye según `workspace_modules` del activo
  (p. ej. Finca sin ventas no muestra la pestaña Ventas).
- **Permisos:** con rol `READ_ONLY` se ocultan/deshabilitan acciones de creación y
  edición.

---

## 10. Decisiones de arquitectura (ADR resumen)

1. **Un solo workspace por fila, nunca DB separada por negocio** — coste de
   aislamiento por `workspace_id` + RLS, extensible y coherente con el sync actual.
2. **Los modelos son plantillas, no workspaces** — permite agregar modelos futuros
   (panadería, restaurante, transporte, ganadería, piscicultura, carpintería,
   ferretería, producción…) sin tocar el núcleo: se añade una fila en
   `business_models` + `business_model_modules`.
3. **NEGOCIO es un contenedor (workspace con `type=NEGOCIO`)** y los negocios son
   hijos (`parent_id`). El contenedor no tiene datos propios.
4. **`workspace_id` se inyecta en el servidor**, nunca se acepta del payload.
5. **La RLS es defensa en profundidad**, no el mecanismo primario de la API
   (conexión owner); el aislamiento operativo está en el SQL de aplicación.
6. **Los códigos únicos pasan a `(workspace_id, code)`** para permitir el mismo
   código en distintos workspaces.
7. **El backfill es no destructivo**: los datos actuales migran al workspace
   `PERSONAL` del dueño.
8. **PWA (Next.js/Supabase) queda fuera de esta iteración**: usa otro backend y otra
   semántica; se converge en fases posteriores para no romper el producto web.

---

## 11. Impacto en archivos y tablas

### 11.1 Archivos afectados (plan de implementación)

**FastAPI (`apps/api`):**

- `app/schemas.py` — `PushRequest`/`PullRequest` con `workspace_id`; schemas de workspace.
- `app/workspace_service.py` (nuevo) — membresía, roles, CRUD de workspaces/módulos.
- `app/sync_service.py` — scope por workspace (push/pull), guard anti-cruce.
- `app/routers/sync.py` — validación de membresía + rol.
- `app/routers/workspaces.py` (nuevo) — `GET/POST /workspaces`.
- `app/main.py` — montar router de workspaces.
- `migrations/00002_workspaces.sql` (nuevo).
- `tests/` (nuevo) — unit tests con mock de `asyncpg`.

**App móvil (`apps/mobile`):**

- `src/core/db/database.ts` — migración v3 (tablas, columnas, rebuild uniq, backfill).
- `src/core/domain/types.ts` — `Workspace`, `WorkspaceModule`, `BusinessModel`, `Module`,
  `workspace_id` en entidades, `EntityType` + `workspace`.
- `src/core/workspace/workspaceStore.ts` (nuevo) — estado global de workspaces.
- `src/core/workspace/modules.ts` (nuevo) — catálogo de módulos y matriz de modelos.
- `src/core/db/repo.ts`, `outbox.ts` — `workspace_id` en filas/outbox/audit.
- `src/core/sync/apiClient.ts`, `syncManager.ts` — sync por workspace.
- Todos los repos de features — filtro `workspace_id` + códigos por workspace.
- `src/navigation/*` — selector principal, stack de Negocio, tabs dinámicos.
- `src/features/workspaces/` (nuevo) — pantallas de selector/creación.
- `src/features/auth/session.ts` — provisioning de espacios al registrarse.
- `src/core/utils/id.ts` — generación de códigos por workspace.

### 11.2 Tablas afectadas

| Tabla | SQLite v3 | PostgreSQL 00002 |
|---|---|---|
| workspaces | nueva | nueva |
| workspace_members | — (role en workspaces) | nueva |
| business_models | — (catálogo en código) | nueva |
| modules | — (catálogo en código) | nueva |
| business_model_modules | — | nueva |
| workspace_modules | nueva | nueva |
| suppliers | nueva | nueva |
| 12 tablas de dominio | +workspace_id | +workspace_id |
| outbox / audit_log | +workspace_id | audit_log: prevista |

### 11.3 Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Duplicar códigos al crear índice único `(workspace_id, code)` | Deduplicación con sufijo en el backfill; reconstrucción de tablas en SQLite no destructiva. |
| Cambiar de workspace y ver datos del anterior | `activeWorkspaceId` en store + limpieza de estados temporales + recarga con todos los repos filtrando por workspace activo. |
| Fuga de datos entre workspaces en el server | `workspace_id` siempre del servidor + guard `WHERE workspace_id` en upsert + validación de membresía. |
| Romper el sync actual | Migraciones aditivas; cursors y outbox nuevos por workspace; compatibilidad con datos existentes vía backfill. |
| RLS inefectiva en conexión owner | Aislamiento primario en SQL de aplicación; RLS documentada como defensa. |
| READ_ONLY escribe offline | El rol se persiste localmente y la UI lo respeta; el servidor rechaza push (403) como garantía final. |

---

## 12. Plan de migración (fases de implementación)

> Esta etapa solo define. La implementación se hará en este orden y bajo estas fases.

| Fase | Contenido | Verificación |
|---|---|---|
| **A — Server** | Migración `00002_workspaces.sql` (tablas, backfill, índices, RLS) + `workspace_service.py` + routers `/workspaces` y `/sync` con validación. | `pytest` de aislamiento con conn mock; migración aplicada en DB vacía y con datos legacy. |
| **B — SQLite local** | Migración v3 (tablas nuevas, `workspace_id`, rebuild uniq, backfill, settings). | App arranca con datos previos intactos. |
| **C — Estado y repos** | `workspaceStore`, catálogo de módulos/modelos, filtros en repos y reportes, códigos por workspace. | Aislamiento verificado en todos los repos. |
| **D — Sync** | API client y syncManager por workspace; sync de workspaces/roles. | Push/pull de A no contamina B (unit + manual). |
| **E — UI** | Selector principal, flujo Negocio→modelo→crear, tabs dinámicos, permisos READ_ONLY, audit con workspace. | Navegación por escenarios. |
| **F — Pruebas de aislamiento** | 1) Crear dato en Negocio A. 2) Cambiar a B. 3) No aparece. 4) Crear en B. 5) Volver a A. 6) Confirmar aislamiento. 7) Repetir offline. 8) Sincronizar. 9) Confirmar aislamiento post-sync. | Checklist ejecutado online y offline. |

**Guía de verificación de aislamiento** (se ejecutará en la fase F):

1. En "Taller Mary" crear un producto `LEG-001` y una venta.
2. Cambiar a "Finca San José": el producto y la venta **no** aparecen; el dashboard
   y los reportes muestran solo datos de Finca.
3. En Finca crear un gasto.
4. Volver a "Taller Mary": el gasto de Finca no aparece.
5. Desconectar la red: repetir 1-4 (cambios quedan `pending` con su `workspace_id`).
6. Reconectar y sincronizar: los datos de ambos workspaces siguen aislados en el
   servidor (verificar por SQL `WHERE workspace_id = ...`).

---

## 13. Fuera de alcance (esta etapa)

- Implementación de módulos especializados (tailoring, agriculture, automotive_parts,
  breeding) y de módulos futuros (producción, cultivos, ganadería, etc.).
- Migración/consolidación de la PWA Next.js hacia esta arquitectura.
- E-commerce, tienda online o marketplace.
- Nuevas entidades de negocio (solo se prepara `suppliers` como entidad).
