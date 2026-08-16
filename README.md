# CatoLedger (Zane)

Aplicación de control de gastos **offline-first** para negocios: gastos, ventas,
compras, inventario, inversiones y clientes. Monorepo con tres piezas:

| Pieza | Tecnología | Ruta |
|-------|------------|------|
| **PWA** | Next.js 15 (App Router) + React 19 + Dexie (IndexedDB) + Supabase | `.` |
| **App móvil** | Expo SDK 57 + expo-sqlite | `apps/mobile` |
| **API de sync** | FastAPI + asyncpg (usada por la app móvil) | `apps/api` |

## Stack (PWA)

- Next.js 15, React 19, TypeScript, Tailwind CSS 4, framer-motion
- Dexie (IndexedDB) como fuente de verdad local — funciona sin conexión
- Supabase: autenticación + sync por RLS + revisiones (LWW)
- Gemini (opcional): parseo de gastos por voz (`/api/voice/parse`)
- Motor de sync propio en `src/lib/sync/` (outbox, backoff, conflictos,
  watermarks) — ver `docs/architecture.md`

## Requisitos

- Node.js 24+ (usa `node --test` con type-stripping para los tests)
- Python 3.13 (solo para `apps/api`)
- Cuenta de Supabase (solo para auth y sync online; sin configurar la app
  funciona 100 % local con datos de demostración)

## Instalación (PWA)

```bash
npm install
cp .env.local.example .env.local
```

Completa `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=            # opcional, asistente de voz
```

### Base de datos (Supabase)

Aplica las migraciones de `supabase/migrations/` **en orden** (00001 a 00008):

| Migración | Contenido |
|-----------|-----------|
| `00001` | Tablas base + user_id + RLS |
| `00002` | Detalle de gastos |
| `00003` | Códigos únicos por usuario |
| `00004` | Módulo de gastos |
| `00005` | Inversiones |
| `00006` | Ventas + inventario |
| `00007` | Motor de sync (revisiones, compras, sync_log) |
| `00008` | Hardening RLS (WITH CHECK, índices, sales único) |
| `00009` | Seed de datos de prueba (dev; requiere un usuario creado) |

> ℹ️ `00001` ya incluye `user_id` antes de las políticas (bug de orden
> corregido) y `00008` excluye `expense_details` (la eliminó `00004`), por lo
> que la secuencia `00001`→`00008` corre limpia de corrida en una base nueva.
> `00008` es idempotente y protege también a proyectos que aplicaron la
> versión anterior con el fallo. Ver `docs/audit.md` §6.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (output standalone) |
| `npm run start` | Sirve el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests (node --test, 190 en verde) |
| `npm run test:ci` | Tests con reporter compacto (CI) |
| `npm run clean` | Limpia `.next` y caches |

## Despliegue

- **Vercel/Netlify:** el proyecto raíz es una app Next estándar. En Vercel, no
  hace falta el output standalone.
- **Docker:** `docker build -t catoledger .` → sirve en `:3000`
  (multi-stage, standalone). Los headers de seguridad (CSP, HSTS, etc.) se
  aplican desde `next.config.ts`.
- **App móvil:** `apps/mobile/eas.json` con perfiles `development`,
  `preview` y `production` (AAB). Entorno: `apps/mobile/.env.example`.
- **API:** `docker build -t catoledger-api apps/api` → sirve en `:8000`
  (uvicorn, 2 workers). Variables en `apps/api/.env.example`.

Backups, monitorización y checklist de rollout: **`docs/ops.md`**.
Informe completo de la auditoría de seguridad/QA/DevOps: **`docs/audit.md`**.

## Estructura

```
src/
  app/          Rutas (App Router) + API routes (/api/voice/parse)
  components/   UI, layout, auth, voz
  features/     Dominios: expenses, sales, purchases, investments, reports...
  lib/          db.ts (Dexie), supabase.ts, seed, sync/, voice/
  types/        Tipos de dominio y de sync
apps/
  mobile/       App Expo (SQLite, syncManager)
  api/          FastAPI (sync del móvil)
supabase/
  migrations/   SQL versionado
scripts/        backup-supabase.ps1
docs/           architecture.md, audit.md, ops.md
```
