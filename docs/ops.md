# Operaciones: despliegue, backups, logging y monitorización

Nota: esta guía complementa `docs/audit.md`. En el repositorio conviven una
PWA (Next.js + Supabase), una app móvil (Expo/SQLite) y una API de
sincronización (FastAPI en `apps/api`).

## 1. Backups (Supabase / Postgres)

- Script: `scripts/backup-supabase.ps1` (pg_dump, formato custom).
- Configurar una tarea programada diaria (Task Scheduler) con la variable de
  entorno `SUPABASE_DB_URL`.
- Retención automática de 14 días. Copiar el directorio `backups/` a
  almacenamiento externo (S3/Dropbox) tras cada backup.
- Probar la restauración al menos 1 vez al trimestre:
  `pg_restore --clean --dbname=... catoledger-XXXX.dump`
- Backup de `auth.users` incluido en el mismo dump (mismo clúster).

## 2. PWA (Next.js)

- `npm ci && npm run build && npm run start` con Node 22+.
- Variables: ver `.env.production.example`.
- El service worker (`public/sw.js`) se registra solo en cliente; requiere
  HTTPS y `Content-Length` correcto en `/sw.js`.
- Encabezados de seguridad recomendados en el hosting:
  - `Content-Security-Policy: default-src 'self'`
  - `Strict-Transport-Security: max-age=63072000`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
- El `anon_key` de Supabase es pública por diseño: la seguridad real la da RLS
  (ver migración `00008`). Verificar que el proyecto Supabase usó la versión
  corregida de `00001` o aplicó `00008`.

## 3. App móvil (Expo / Android)

- Entorno: `apps/mobile/.env.example` (EXPO_PUBLIC_*). Nunca commitear
  `.env`.
- Build:
  - Desarrollo: `npx eas build --platform android --profile development`
  - Preview/APK interno: `npx eas build --platform android --profile preview`
  - Producción (AAB para Play): `npx eas build --platform android --profile production`
- Subir a Play Console: `npx eas submit --platform android --profile production`
  (requiere `service-account.json`).
- Sin EAS (build local): `npx expo prebuild` y luego Gradle:
  `cd android && ./gradlew assembleRelease`.
- Regla del repositorio (`apps/mobile/AGENTS.md`): antes de tocar código móvil
  leer la documentación de Expo SDK 57.

## 4. Logging y monitorización

Estado actual (tras auditoría):
- PWA: el motor de sync registra eventos en la tabla `sync_log` (por usuario).
- API FastAPI: logs de uvicorn a stdout (capturados en `apps/api/uvicorn.*.log`
  en local; NO están versionados gracias a `*.log` en .gitignore).

Recomendaciones pendientes:
- Capturar logs de la API en un agregador (p. ej. Loki/DataDog/paper-trail) en
  lugar de archivos locales.
- Health checks ya disponibles: `GET /health` y `GET /health/ready` (API).
- Uptime monitor externo (UptimeRobot/Healthchecks.io) sobre `/health/ready`.
- Alerta en la PWA: el indicador de sync offline ya existe en la UI
  (`useSyncStore.online`); considerar un contador de operaciones fallidas
  visible (los datos están en `syncOutbox` con estado `failed`/`conflict`).
- Rotar el `GEMINI_API_KEY` anualmente y usar el header `x-goog-api-key`.

## 5. Checklist de rollout de los fixes de auditoría

1. Aplicar `supabase/migrations/00008_rls_hardening.sql` en el proyecto
   Supabase real (leer los comentarios de impacto al inicio del archivo).
2. Verificar RLS con la `anon key`:
   `SELECT * FROM expenses;` sin token debe devolver 0 filas / 401.
3. Rotar/eliminar la `GEMINI_API_KEY` que estuvo expuesta en
   `.env.local.example` (revocarla en Google AI Studio).
4. Regenerar `package-lock.json` ya incluye `next@15.5.23` (CVE).
5. Los datos creados tras este deploy se sincronizan (fix C1). Los registros
   históricos creados antes con `syncStatus: "local"` requieren un one-off:
   migrarlos a `"pending"` en IndexedDB (consola de desarrollo) o, si ya se
   aplicaron migraciones nuevas, se pierden del sync (solo afecta instalaciones
   con datos locales previos sin configurar Supabase).
6. Confirmar registro del service worker en DevTools (Application > Service
   Workers) tras el primer acceso HTTPS.
