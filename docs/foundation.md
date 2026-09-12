# CatoLedger — Fundación técnica (app móvil)

> Capa base sobre la que se construyen los workspaces, la sincronización por
> `workspace_id` y los módulos de negocio. Implementa los 20 puntos de
> "fundación técnica" del roadmap (Etapa 0), **sin** implementar los módulos
> específicos (Ventas, Compras, Gastos, Inventario, OCR, IA).

## 1. Alcance

| Área | Qué incluye | Estado |
|------|-------------|--------|
| Config de entorno | `src/core/config/env.ts` centraliza `EXPO_PUBLIC_*` con defaults | ✅ |
| Almacenamiento seguro | `src/core/secure/secureStorage.ts` (expo-secure-store) | ✅ |
| Detección de conexión | `src/core/network/connectivity.ts` (expo-network + health check) | ✅ |
| Health check backend | `GET /health/ready` consumido por la app | ✅ |
| Cliente API | `apiClient` con `health()`, timeout y errores clasificados | ✅ |
| Migraciones locales | Registry versionado + SQLite v3 (workspaces) | ✅ |
| Workspaces locales | Tipos, módulos, `workspace_modules`, `active_workspace_id`, `device_id` | ✅ |
| Sync engine | Gate offline, estados ampliados, error global | ✅ |
| Manejo global de errores | `errorBus` + `ErrorBanner` + `AppErrorBoundary` | ✅ |
| Errores tipados | `AppError` (códigos) + `Result<T>` | ✅ (previo) |
| Logging | Logger con niveles, namespaces y transporte | ✅ (previo) |
| UI kit | Button, Card, Input, ListItem, Screen, Select, EmptyState, theme | ✅ (previo) |

## 2. Estructura de `apps/mobile/src`

```
core/
  config/env.ts            # env central (API, Supabase) con defaults
  secure/secureStorage.ts  # SecureStore tipado (sesión de Supabase)
  network/
    connectivityLogic.ts   # lógica pura (testeable): online = red Y servidor
    connectivity.ts        # store zustand + monitoreo (expo-network + health)
  workspace/
    modules.ts             # catálogo de módulos y modelos de negocio
    activeWorkspace.ts     # helpers de settings: active_workspace_id
  errors/errorBus.ts       # bus global de errores no fatales
  db/database.ts           # SQLite v3 (workspaces) + registry de migraciones
  db/repo.ts / outbox.ts   # escrituras con outbox + auditoría
  sync/syncManager.ts      # engine (push/pull) con gate offline
  sync/apiClient.ts        # HTTP: push/pull/health
  auth/supabase.ts         # cliente Supabase (sesión en SecureStore)
```

## 3. Config de entorno

`.env.example` → `src/core/config/env.ts`:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

- `env.apiUrl` por defecto `http://localhost:8000`.
- `isSupabaseConfigured()` indica si auth está activo; sin Supabase la app
  funciona 100 % local (offline-first).

## 4. Conectividad (offline/online)

- **`expo-network`** reporta red del dispositivo (`isConnected` +
  `isInternetReachable`).
- **Health check** de la API (`GET /health/ready`, timeout 4 s) confirma que el
  servidor responde.
- Semántica: `online = red del dispositivo Y servidor alcanzable`
  (`decideOnline` en `connectivityLogic.ts`, función pura testeada).
- `startConnectivityMonitoring` (en `App.tsx`): al volver a estar online
  dispara `runSync()`; al caer marca el estado `offline` del sync engine.

## 5. Cliente API

`apiClient` clasifica errores HTTP en `AppError` con códigos tipados:

| Status | Código |
|--------|--------|
| 401/403 | `AUTH` |
| 409 | `CONFLICT` |
| 422 | `VALIDATION` |
| red/timeout | `NETWORK` |
| resto | `SYNC` |

Método nuevo: `health(): Promise<boolean>` (consume `/health/ready`).

## 6. Migraciones locales (SQLite)

- Registry `MIGRATIONS: Migration[]` aplicado en orden sobre `PRAGMA user_version`.
- **v1** — esquema base. **v2** — `sync_status`. **v3** — workspaces:
  - Tablas `workspaces` (type `PERSONAL|TRABAJO|ESTUDIO|NEGOCIO|BUSINESS`,
    `parent_id`, `model_key`, `role`, `status`) y `workspace_modules`
    (`PK (workspace_id, module_key)`).
  - `workspace_id TEXT NOT NULL DEFAULT ''` en tablas de dominio, `outbox` y
    `audit_log` + índices.
  - **Provisioning:** crea Personal/Trabajo/Estudio (módulos `expenses` +
    `reports`) y Negocio (contenedor, sin módulos); fija `active_workspace_id`
    en Personal y genera `device_id`.
  - **Backfill:** los datos existentes se asignan al workspace Personal.
- `scripts/validate-mobile-migration.cjs` valida la sintaxis SQL y el flujo
  v1→v2→v3 contra SQLite real (`node:sqlite`).

## 7. Catálogo de módulos y modelos

`core/workspace/modules.ts` (consistente con `docs/workspaces-architecture.md`):

- **Core (activos):** `expenses`, `products`, `inventory`, `purchases`,
  `suppliers`, `sales`, `customers`, `investments`, `reports`.
- **Transversales:** `expenses` y `reports` garantizados en todo workspace
  operativo.
- **Especializados (declarados, NO implementados):** `tailoring`,
  `agriculture`, `automotive_parts`, `breeding` (status `disabled`).
- **Modelos de negocio:** `tailoring`, `agriculture`, `automotive_parts`,
  `breeding`, `commerce`, `services`, `custom` (plantillas de módulos).

## 8. Sync engine

- `runSync` no hace push/pull si `online` es falso → `status: 'offline'`.
- Estados del engine: `idle | syncing | synced | offline | error`.
- `SyncStatus` de dominio ampliado: `pending | syncing | synced | failed |
  conflict | error`.
- Errores de sync no fatales → `errorBus` → `ErrorBanner` (tocar para cerrar).

## 9. Manejo global de errores

- `AppErrorBoundary` (render) + `useLoad` (datos) + `errorBus` (no fatales).
- `emitGlobalError(msg, code)` desde `syncManager` en fallos de sincronización.

## 10. Pruebas

```bash
cd apps/mobile
npm run typecheck   # tsc --noEmit (todo src/)
npm test            # node --test: lógica pura (conectividad + catálogo módulos)
node ../../scripts/validate-mobile-migration.cjs  # valida migración SQL real
```

### Pruebas manuales offline/online (requieren emulador/dispositivo)

| # | Paso | Resultado esperado |
|---|------|--------------------|
| 1 | Abrir app sin red (modo avión) | La app abre, carga datos locales, sync queda `offline` sin errores |
| 2 | Crear un gasto estando offline | Queda `pending` en outbox, visible en pantalla |
| 3 | Conectar red con API arriba | Vuelve `online`, `runSync` se dispara, outbox vacío |
| 4 | API caída pero con red | `online=false`, banner de error si falla el sync |
| 5 | `curl localhost:8000/health/ready` | `{"status":"ready","database":"ok"}` |

## 11. Fuera de alcance (etapas siguientes)

- Etapa A: migración `00002` del servidor + `/workspaces` en la API.
- Etapa B: sync de workspaces/roles por usuario.
- Etapa C: `workspaceStore`, selector de workspace, filtros por
  `workspace_id` en repos/reportes/dashboard, creación de BUSINESS por modelo.
- Módulos Ventas/Compras/Gastos/Inventario/OCR/IA.

Referencias: [`docs/architecture.md`](architecture.md) ·
[`docs/workspaces-architecture.md`](workspaces-architecture.md).
