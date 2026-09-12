# CatoLedger — Guía de Despliegue

## Tabla de contenido

1. [Variables de entorno](#1-variables-de-entorno)
2. [Configuración de Supabase](#2-configuración-de-supabase)
3. [Build de producción](#3-build-de-producción)
4. [Despliegue con Docker](#4-despliegue-con-docker)
5. [Despliegue con Vercel](#5-despliegue-con-vercel)
6. [Build de Android (PWA)](#6-build-de-android-pwa)
7. [Scripts recomendados para package.json](#7-scripts-recomendados-para-packagejson)
8. [Verificación post-despliegue](#8-verificación-post-despliegue)

---

## 1. Variables de entorno

Copia `.env.example` como `.env.local` para desarrollo:

```bash
cp .env.example .env.local
```

### Requeridas (la app no funciona sin ellas)

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima pública | Supabase Dashboard → Settings → API → anon public |

### Opcional pero recomendadas

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `GEMINI_API_KEY` | API Key de Google AI Studio | *(sin default — OCR y voz no funcionan)* |
| `GEMINI_MODEL` | Modelo de Gemini | `gemini-2.5-flash` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo server) | *(necesaria para backups)* |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app | `http://localhost:3000` |
| `NODE_ENV` | Entorno de ejecución | `development` |

### Internas (configuración avanzada)

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `SYNC_BATCH_SIZE` | Operaciones por lote en sync push | `25` |
| `SYNC_STALE_THRESHOLD_MS` | Tiempo antes de reintentar ops estancadas | `300000` (5 min) |
| `API_RATE_LIMIT_MAX` | Max solicitudes por ventana | `10` |
| `API_RATE_LIMIT_WINDOW_MS` | Duración de ventana de rate limit | `60000` (1 min) |

---

## 2. Configuración de Supabase

### 2.1 Crear proyecto

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta.
2. Crea un nuevo proyecto.
3. Anota la **Project URL** y la **anon public** key.

### 2.2 Schema de base de datos

CatoLedger usa Dexie (IndexedDB) localmente y sincroniza con Supabase. Ejecuta las migraciones SQL desde `supabase/migrations/` en el SQL Editor del Dashboard:

```bash
# Listar migraciones disponibles
ls supabase/migrations/
```

### 2.3 Autenticación

En Supabase Dashboard → Authentication → Providers, habilita:
- **Email/Password** (habilitado por defecto)

### 2.4 Row Level Security (RLS)

Asegúrate de que RLS está habilitado en todas las tablas. Las políticas deben permitir:
- SELECT/INSERT/UPDATE/DELETE solo para el usuario autenticado (`auth.uid()`)
- Service role bypass para operaciones server-side

---

## 3. Build de producción

### Build local

```bash
# Instalar dependencias
npm ci

# Lint y typecheck
npm run lint
npm run typecheck

# Tests
npm run test:ci

# Build (genera .next/standalone/)
npm run build
```

### Standalone mode

El `next.config.ts` tiene `output: "standalone"`, lo que genera un directorio `.next/standalone/` autocontenido que incluye solo las dependencias necesarias. Esto reduce drásticamente el tamaño de la imagen Docker.

### Iniciar producción localmente

```bash
# After build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cd .next/standalone
node server.js
```

---

## 4. Despliegue con Docker

### Build de imagen

```bash
docker build -t catoledger:latest .
```

### Ejecutar

```bash
docker run -d \
  --name catoledger \
  -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-anon-key" \
  -e GEMINI_API_KEY="tu-gemini-key" \
  -e NEXT_PUBLIC_APP_URL="https://catoledger.com" \
  -e NODE_ENV=production \
  catoledger:latest
```

### Docker Compose

Crea `docker-compose.yml`:

```yaml
services:
  catoledger:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.5-flash}
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-https://catoledger.com}
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Ejecutar con Docker Compose

```bash
# Usando .env.local
docker compose --env-file .env.local up -d

# Ver logs
docker compose logs -f catoledger

# Detener
docker compose down
```

---

## 5. Despliegue con Vercel

### 5.1 Instalar CLI

```bash
npm i -g vercel
vercel login
```

### 5.2 Desplegar

```bash
# Preview (rama no-main)
vercel

# Producción
vercel --prod
```

### 5.3 Variables de entorno en Vercel

Configura en el Dashboard → Settings → Environment Variables:

| Variable | Ambiente |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production |
| `GEMINI_API_KEY` | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | Production (`https://catoledger.com`), Preview |

### 5.4 Build settings

En Vercel Dashboard → Settings → General:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm ci`

### 5.5 Dominio personalizado

1. Ve a Settings → Domains
2. Agrega tu dominio (ej. `catoledger.com`)
3. Configura los registros DNS según las instrucciones de Vercel
4. Verifica el dominio

---

## 6. Build de Android (PWA)

CatoLedger es una PWA con `manifest.json` y `sw.js` ya configurados. Para empaquetar como app Android existen dos opciones principales:

### Opción A: Bubblewrap (TWA — Trusted Web Activity)

[Trusted Web Activities](https://web.dev/articles/using-a-trusted-web-activity) usan Chrome para renderizar tu PWA dentro de un contenedor nativo, sin cambiar tu código.

```bash
# Instalar Bubblewrap
npm i -g @nickcanz/bubblewrap-cli

# O usar la CLI oficial de Google
npm i -g @nickcanz/bubblewrap-cli

# Inicializar el proyecto TWA
bubblewrap init --manifest=https://catoledger.com/manifest.json

# Build
bubblewrap build
```

**Requisitos del manifest.json:**
- ✅ `name`, `short_name`, `start_url` — ya configurados
- ✅ `display: standalone` — ya configurado
- ✅ `icons` con 192x192 y 512x512 — ya configurados
- ⚠️ Agregar `id` al manifest para TWA:
  ```json
  "id": "/?source=pwa"
  ```
- ⚠️ Los iconos deben ser PNG (no SVG) para Android. Genera versiones PNG:
  ```bash
  # Convertir SVG a PNG 192x192 y 512x512
  # Usar sharp o herramienta similar
  ```

### Opción B: Capacitor (Ionic)

Capacitor envuelve tu app web en un WebView nativo y permite acceder a APIs nativas.

```bash
# Instalar Capacitor
npm i @capacitor/core @capacitor/cli

# Inicializar
npx cap init "CatoLedger" "com.catoledger.app" --web-dir=.next/standalone

# Agregar plataforma Android
npx cap add android

# Sincronizar web build con Android
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
npx cap sync android

# Abrir en Android Studio
npx cap open android
```

**`capacitor.config.ts`:**

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.catoledger.app',
  appName: 'CatoLedger',
  webDir: '.next/standalone',
  server: {
    androidScheme: 'https',
    // Para producción, comenta la línea url para que cargue archivos empaquetados:
    // url: 'http://10.0.2.2:3000',  // Solo para desarrollo
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#09090b',
      showSpinner: false,
    },
  },
};

export default config;
```

### Comparativa

| Característica | Bubblewrap (TWA) | Capacitor |
|---|---|---|
| Tamaño del APK | Mínimo (~1 MB) | Mayor (~5-10 MB) |
| Acceso a APIs nativas | No | Sí (cámara, GPS, etc.) |
| Actualizaciones | Automáticas (web) | Requiere rebuild |
| Personalización | Mínima | Alta |
| Complexidad | Baja | Media |

**Recomendación para CatoLedger:** Usar **Bubblewrap** si solo necesitas la PWA empaquetada (la app ya tiene todas las funcionalidades en web). Usar **Capacitor** si planeas agregar funcionalidades nativas como acceso a cámara offline o GPS.

### Publicación en Google Play Store

1. Firma el APK con una keystore:
   ```bash
   keytool -genkey -v -keystore catoledger-release.keystore \
     -alias catoledger -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Compila el AAB (Android App Bundle) desde Android Studio o con `./gradlew bundleRelease`

3. Sube a [Google Play Console](https://play.google.com/console)

---

## 7. Scripts recomendados para package.json

Agrega estos scripts a tu `package.json`:

```json
{
  "scripts": {
    "docker:build": "docker build -t catoledger:latest .",
    "docker:run": "docker run -d --name catoledger -p 3000:3000 --env-file .env.local catoledger:latest",
    "backup": "bash scripts/backup.sh",
    "restore": "bash scripts/restore.sh",
    "health-check": "bash scripts/health-check.sh",
    "android:build": "npm run build && npx cap sync android && npx cap open android"
  }
}
```

> **Nota para Windows:** Los scripts bash no funcionan directamente en PowerShell.
> Usa WSL, Git Bash, o adapta los scripts a PowerShell.
> Ya existe `scripts/backup-supabase.ps1` como alternativa nativa de Windows.

---

## 8. Verificación post-despliegue

### Checklist manual

- [ ] La app carga correctamente en el navegador
- [ ] Login con email/password funciona
- [ ] Logout funciona
- [ ] Se puede crear un gasto nuevo
- [ ] Los gastos aparecen en la lista
- [ ] La sincronización funciona (índice de sync cambia a "synced")
- [ ] La app funciona offline (desconecta red y prueba)
- [ ] El OCR de facturas funciona (sube una imagen)
- [ ] El asistente de voz funciona (graba y procesa)
- [ ] Los reportes/gráficos muestran datos correctos
- [ ] Los headers de seguridad están presentes (verificar con `curl -I`)

### Health check automatizado

```bash
# Verificar salud de la app
./scripts/health-check.sh https://catoledger.com

# Output esperado:
# 4 pass | 0 fail | 1 warn
# STATUS: HEALTHY
```

### Monitoreo continuo

Ver `monitoring/README.md` para configurar:
- Monitoreo de uptime con UptimeRobot o similar
- Error tracking con Sentry
- Métricas de Supabase Dashboard

### Logs de producción

```bash
# Docker
docker logs -f catoledger

# Vercel
vercel logs catoledger --follow
```
