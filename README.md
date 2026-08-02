# Zane

Aplicación moderna para el registro y control de gastos. PWA offline-first con sincronización a Supabase y entrada por voz asistida por Gemini.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS 4** + framer-motion
- **Dexie** (IndexedDB) como almacenamiento local offline-first
- **Supabase** para autenticación y sincronización
- **Gemini** (opcional) para el parseo de gastos por voz
- **Zustand**, **react-hook-form**, **zod**, **recharts**

## Requisitos

- Node.js 18.18 o superior
- Una cuenta de Supabase (solo necesaria para auth y sync online)

## Instalación

```bash
npm install
cp .env.local.example .env.local
```

Completa `.env.local` con tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`GEMINI_API_KEY` es opcional y solo se usa para el asistente de voz.

### Base de datos (Supabase)

Aplica las migraciones ubicadas en `supabase/migrations/`:

- `00001_init.sql` — tablas base
- `00002_add_expense_details.sql` — detalle de gastos

## Scripts

| Comando           | Descripción                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Inicia el servidor de desarrollo     |
| `npm run build`   | Compila el proyecto para producción  |
| `npm run start`   | Sirve el build de producción         |
| `npm run lint`    | Ejecuta ESLint                       |

## Estructura

```
src/
  app/          Páginas y rutas (App Router)
  components/   Componentes de UI, layout y voz
  features/     Lógica por dominio (expenses, categories, reports...)
  hooks/        Hooks compartidos
  lib/          Dexie, Supabase, seed, sincronización y voz
  stores/       Estado global (Zustand)
  types/        Tipos de dominio
  utils/        Utilidades (formato, texto, códigos)
supabase/
  migrations/   Migraciones SQL
```
