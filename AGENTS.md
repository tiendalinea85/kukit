# AGENTS.md — CatoLedger (zane-app)

Aplicación de control de gastos **offline-first** y multi-workspace. Monorepo con tres piezas:

| Pieza | Tecnología | Ruta |
|-------|------------|------|
| **PWA** (raíz) | Next.js 15 App Router, React 19, Dexie/IndexedDB, Supabase, Tailwind 4 | `.` |
| **App móvil** (producto oficial, Android) | Expo SDK 57 + expo-sqlite + zustand | `apps/mobile` |
| **API de sync** | FastAPI + asyncpg + PyJWT | `apps/api` |

Documentos canónicos: `docs/architecture.md`, `docs/workspaces-architecture.md`,
`docs/foundation.md`, `docs/audit.md`, `docs/ops.md`. Léelos antes de tocar sync,
workspaces o esquema.

## Comandos

```bash
npm run dev        # servidor de desarrollo
npm run build      # build de producción (output standalone)
npm run lint       # ESLint (next/core-web-vitals + next/typescript)
npm run typecheck  # tsc --noEmit
npm test           # node --test (requiere Node 24, type-stripping)
npm run test:ci    # mismo con reporter compacto (es lo que corre CI)

cd apps/mobile && npm run typecheck && npm test   # app Expo
python -m compileall -q apps/api/app              # check de la API
```

Antes de dar por terminado cualquier cambio: `npm run lint && npm run typecheck && npm test`.

## Estructura

```
src/
  app/        Rutas App Router (una carpeta por dominio) + /api/{voice,ai}
  components/ UI compartida: ui/, layout/, auth/, sync/, voice/
  features/   Módulos de dominio, layout uniforme por feature:
              components/ · domain/ · hooks/ · schemas/ · services/ · *.test.ts
  lib/        db.ts (Dexie), supabase.ts, seed.ts, sync/ (motor), voice/, ai/
  stores/     zustand (useAppStore, useWorkspaceStore)
  types/      index.ts (dominio) · sync.ts · modules.ts (catálogo)
  utils/      code.ts (códigos correlativos), formato
  __tests__/  tests de utils y aislamiento
supabase/migrations/   SQL versionado (00001→00019, aplicar EN ORDEN)
scripts/              backup/restore/health-check, validador de migración móvil
docs/                 arquitectura y operación
```

Dentro de una `feature`, la dependencia va siempre hacia adentro:
`components/ → hooks/ → services/ → domain/ + schemas/`.
- `domain/` — reglas puras, sin React ni Dexie (fácil de testear).
- `schemas/` — validación zod (`react-hook-form` + `@hookform/resolvers`).
- `services/` — acceso a Dexie, transacciones, `syncStatus`, `workspaceId`.
- `hooks/` — `useState` + `liveQuery` de Dexie, filtrado por `activeWorkspaceId`.

## Convenciones

- **Idioma**: documentación, comentarios y mensajes de error al usuario en
  **español**; los nombres de los casos de test (`it(...)`) van en inglés.
- Imports con el alias `@/*` → `src/*`; dentro de una feature, rutas relativas
  (`../domain/expenseRules`).
- Imports de tipos con extensión explícita cuando el archivo es TS puro de
  dominio/test: `import type { X } from "./x.ts"`.
- Nombres de archivos en `camelCase.ts` (`expenseService.ts`), tipos en `PascalCase`,
  funciones/variables en `camelCase`, componentes React en `PascalCase.tsx`.
- Strings de dominio en español y en minúsculas (`"pagado"`, `"anulado"`,
  `"efectivo"`, `"taller"`). Son valores persistidos en la BD: renombrarlos es
  una migración.
- Sin clases ni frameworks de estado nuevos: `zustand` para estado global,
  `useState` local, `liveQuery` para leer de Dexie.
- Comentarios solo para explicar el *porqué* (invariantes, decisiones de sync,
  trampas de la BD). No comentes código evidente.
- Sin emojis en el código.

## Invariantes del dominio (no romper)

1. **Toda fila de negocio lleva `workspaceId`.** Se lee del
   `useWorkspaceStore.getState().activeWorkspaceId` y se filtra SIEMPRE por él en
   lecturas, escrituras, reportes y dashboard. `workspaceIsolation.test.ts`
   protege esto: usa ese test como referencia al añadir campos o consultas.
2. **Soft delete.** Nunca `DELETE` físico: marca `deleted: true` y
   `syncStatus: "pending"` para que el Sync Engine propague el tombstone. Un
   borrado físico hace resucitar la fila en otros dispositivos.
3. **Toda escritura marca `syncStatus: "pending"` y actualiza `updatedAt`**
   (ISO string) dentro de la misma transacción Dexie.
4. **Transacciones para operaciones multi-tabla** (cabecera + líneas): cabecera
   primero, `bulkAdd`/`modify` de hijos dentro de `db.transaction("rw", ...)`.
5. **IDs generados en el cliente** (`crypto.randomUUID()`) → idempotencia del sync.
6. **Dinero**: la PWA usa `number` redondeado a 2 decimales; el móvil y la API
   usan enteros (centavos). No introduzcas flotantes en la API.
7. **Anulado ≠ borrado**: anular es un cambio de estado (`status: "anulado"`,
   `voidedAt`); un gasto anulado no se edita (`canEditExpense`).

## Tests

- `node:test` + `node:assert/strict` (sin Jest/Vitest). Imports relativos con
  extensión: `import { x } from "./expenseRules.ts"`.
- Fichero `<nombre>.test.ts` junto al módulo que prueba; `describe` agrupa por
  función pública, `it` describe el comportamiento en inglés.
- Tests de Dexie usan `fake-indexeddb`; los servicios se prueban sobre lógica
  pura + `describe` de reglas, sin renderizar React.
- **Al crear un test nuevo hay que añadir su carpeta al glob de `npm test` y
  `npm run test:ci` en `package.json`** (el script lista rutas explícitas; hoy
  cubre expenses, investments, sales, purchases, invoice, tailoring, stores,
  lib/sync y `__tests__`). Un test no listado no se ejecuta.
- Mock de tiempo por parámetro: las reglas puras reciben `now: string` en vez de
  llamar a `new Date()`.

## Entorno

- Copia `.env.local.example` → `.env.local`. Sin Supabase configurado la app
  funciona 100 % local con datos demo.
- Solo se versionan `*.env.example`. Nunca commits de `.env.local` ni claves.
- Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `GEMINI_API_KEY` (opcional, parseo de voz).
- Migraciones nuevas: numeración consecutiva, **idempotentes**
  (`IF NOT EXISTS`, `DROP/CREATE`), aplicadas en orden sobre `supabase/`.
  Actualiza también la tabla de migraciones del `README.md`.

## Seguridad

- Nunca confíes en el `workspaceId`/`userId` del cliente: el servidor valida
  membresía y rol y escribe el valor validado. RLS de Supabase es defensa en
  profundidad.
- El API key de Gemini es secreto de servidor: solo en rutas `/api/*`.
- Listas blancas de columnas en SQL, siempre parametrizado.

## Commits y PRs

- El historial usa mensajes cortos en español, a menudo de un grupo de palabras
  ("nuevo front", "sincronización", "botón retroceso"). Mantén ese estilo.
- Antes de commitear: revisa `git status` / `git diff`, no incluyas
  `.env*` (salvo `.example`), `dev-server*.log`, `.next/` ni `node_modules/`.
- No hagas force-push ni reescribas commits existentes.
