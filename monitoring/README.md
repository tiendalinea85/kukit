# CatoLedger — Guía de Monitoreo

## Tabla de contenido

1. [Qué monitorear](#1-qué-monitorear)
2. [Supabase Dashboard](#2-supabase-dashboard)
3. [Error tracking con Sentry](#3-error-tracking-con-sentry)
4. [Salud del motor de sync](#4-salud-del-motor-de-sync)
5. [Monitoreo de almacenamiento IndexedDB](#5-monitoreo-de-almacenamiento-indexeddb)
6. [Estrategia de rotación de logs](#6-estrategia-de-rotación-de-logs)
7. [Umbrales de alerta](#7-umbrales-de-alerta)

---

## 1. Qué monitorear

| Componente | Métrica clave | Herramienta |
|---|---|---|
| Supabase | Latencia, errores, conexiones activas | Supabase Dashboard |
| App uptime | Disponibilidad HTTP 200 | UptimeRobot / BetterStack |
| Sync engine | Operaciones pendientes/fallidas | Sync store (Zustand) |
| Gemini API | Tasa de éxito, latencia | Logs de servidor |
| IndexedDB | Uso de almacenamiento | Client-side (ver §5) |
| Errores | Excepciones no capturadas | Sentry |

---

## 2. Supabase Dashboard

### Métricas disponibles

Ve a [supabase.com/dashboard](https://supabase.com/dashboard) → tu proyecto:

- **Database → Metrics**: Conexiones activas, queries por segundo, tamaño de BD
- **Authentication → Users**: Usuarios registrados, sesiones activas
- **Storage → Usage**: Almacenamiento usado (si usas Supabase Storage)
- **Logs → Edge Functions**: Logs de funciones server-side (si las usas)
- **API → GraphiQL**: Probar queries manualmente

### Alertas de Supabase

En Settings → Notifications:
- Habilitar alertas de uso de disk
- Habilitar alertas de conexiones
- Configurar webhook para métricas críticas

### Consultas útiles SQL

```sql
-- Tamaño de tablas (en MB)
SELECT
  relname AS tabla,
  pg_size_pretty(pg_total_relation_size(oid)) AS total
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY pg_total_relation_size(oid) DESC;

-- Conexiones activas ahora
SELECT count(*) AS conexiones_activas
FROM pg_stat_activity
WHERE state = 'active';
```

---

## 3. Error tracking con Sentry

### Instalación

```bash
npm i @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

El wizard configura automáticamente:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- Instrumentación en `next.config.ts`

### Configuración manual

**`sentry.client.config.ts`:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1, // 10% de traces para no impactar rendimiento
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0, // 100% de replays en errores
  environment: process.env.NODE_ENV,
  release: process.env.npm_package_version,
});
```

**`sentry.server.config.ts`:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
});
```

### Variables de entorno necesarias

```
NEXT_PUBLIC_SENTRY_DSN=https://tu-dsn@sentry.io/proyecto-id
SENTRY_AUTH_TOKEN=tsip_your_auth_token
SENTRY_ORG=tu-org
SENTRY_PROJECT=catoledger
```

### Capturar errores manualmente

```typescript
import * as Sentry from "@sentry/nextjs";

// En cualquier componente o server action
try {
  // risky operation
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: "sync", entity: "expenses" },
  });
}
```

---

## 4. Salud del motor de sync

### Monitoreo client-side

El `useSyncStore` (Zustand) expone el estado del sync engine:

```typescript
import { useSyncStore } from "@/lib/sync";

// En cualquier componente
const { status, pendingOps, failedOps, lastSyncAt } = useSyncStore();
```

### Estados del sync engine

| Estado | Significado | Acción |
|---|---|---|
| `synced` | Todo sincronizado | Ninguna |
| `syncing` | Sincronizando ahora | Esperar |
| `error` | Hay operaciones fallidas o conflictos | Revisar errores |
| `offline` | Sin conexión | Reconectar |

### Métricas a registrar

En tu sistema de monitoreo o Sentry, registra:

```typescript
// Periodicamente o en cada cambio de estado
useSyncStore.subscribe((state) => {
  if (state.failedOps > 0) {
    // Alertar: hay operaciones fallidas
    console.warn(`[Sync] ${state.failedOps} operaciones fallidas`);
  }
  if (state.pendingOps > 100) {
    // Alertar: hay un backlog grande
    console.warn(`[Sync] ${state.pendingOps} operaciones pendientes`);
  }
});
```

### Logs del sync engine

Los eventos de sync se guardan en IndexedDB (tabla `syncLog`). Para acceder:

```typescript
import { db } from "@/lib/db";

// Obtener últimos 50 eventos de sync
const logs = await db.syncLog.orderBy("timestamp").reverse().limit(50).toArray();
console.table(logs);
```

---

## 5. Monitoreo de almacenamiento IndexedDB

### Cuota de almacenamiento

Los navegadores limitan IndexedDB (generalmente 50-80% del disco disponible):

```typescript
async function getStorageUsage(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
} | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return {
    usage: usage ?? 0,
    quota: quota ?? 0,
    percentage: quota ? Math.round((usage! / quota!) * 100) : 0,
  };
}

// Uso
const storage = await getStorageUsage();
if (storage && storage.percentage > 80) {
  // Alertar al usuario: almacenamiento casi lleno
}
```

### Monitoreo automático

```typescript
// En un provider o layout raíz
useEffect(() => {
  const check = async () => {
    const storage = await getStorageUsage();
    if (storage && storage.percentage > 80) {
      toast.error(`Almacenamiento casi lleno (${storage.percentage}%). Exporta y limpia datos.`);
    }
  };

  check();
  const interval = setInterval(check, 60_000); // Cada minuto
  return () => clearInterval(interval);
}, []);
```

### Limpieza de datos

Si el almacenamiento está casi lleno:
1. Exportar datos a CSV/JSON desde la app
2. Eliminar registros antiguos (gastos de meses anteriores)
3. Limpiar la tabla `syncLog` de Dexie

---

## 6. Estrategia de rotación de logs

### Server-side (Next.js standalone)

El output de `console.log/error` en producción va a stdout/stderr. Con Docker:

```yaml
# docker-compose.yml (ya incluido)
logging:
  driver: "json-file"
  options:
    max-size: "10m"   # Archivo máximo de 10 MB
    max-file: "3"     # Mantener 3 archivos rotados
```

### Client-side (IndexedDB syncLog)

La tabla `syncLog` en Dexie puede crecer indefinidamente. Implementar limpieza:

```typescript
async function cleanOldSyncLogs(maxAgeDays: number = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffISO = cutoff.toISOString();

  const deleted = await db.syncLog
    .where("timestamp")
    .below(cutoffISO)
    .delete();

  console.log(`[Sync] Limpiados ${deleted} logs antiguos`);
}

// Ejecutar al iniciar la app o periódicamente
cleanOldSyncLogs(30);
```

### Server logs en Vercel

Vercel retiene logs automáticamente:
- **Runtime logs**: 1 día (plan Hobby), 7 días (Pro)
- **Function logs**: hasta 1 día
- Exportar logs importantes antes de que expiren si necesitas auditoría

---

## 7. Umbrales de alerta

### Tabla de alertas

| Métrica | Umbral de advertencia | Umbral crítico | Acción |
|---|---|---|---|
| Uptime de la app | < 99.9% | < 99% | Verificar servidor/redeploy |
| Latencia API (voice/ocr) | > 5s | > 15s | Revisar Gemini API |
| Tasa de error Gemini | > 5% | > 20% | Verificar API key / quotas |
| Sync ops fallidas | > 5 | > 50 | Revisar connectivity / server |
| Sync ops pendientes | > 100 | > 500 | Backlog — verificar sync engine |
| Almacenamiento IndexedDB | > 60% | > 85% | Alertar usuario, limpiar datos |
| Supabase conexiones | > 80% del pool | > 95% del pool | Upgrade plan o connection pooling |
| Tamaño de BD Supabase | > 500 MB | > 1 GB | Limpiar datos antiguos |

### Configurar alertas

**UptimeRobot** (gratis para 50 monitores):
1. Crea cuenta en [uptimerobot.com](https://uptimerobot.com)
2. Crea monitor HTTP(s) con URL: `https://catoledger.com`
3. Intervalo: 5 minutos
4. Alertas por email + webhook

**BetterStack** (alternativa moderna):
1. Crea cuenta en [betterstack.com](https://betterstack.com)
2. Configura heartbeat URL: `https://catoledger.com/api/health`
3. Integra con Slack/Discord

### Webhook de alertas (opcional)

Crea un endpoint `/api/health` que verifique todo:

```typescript
// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";

export async function GET() {
  const checks: Record<string, string> = {};

  // App
  checks.app = "ok";

  // Supabase
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabase();
      const { error } = await sb!.auth.getSession();
      checks.supabase = error ? "error" : "ok";
    } catch {
      checks.supabase = "error";
    }
  } else {
    checks.supabase = "not_configured";
  }

  // Gemini
  checks.gemini = process.env.GEMINI_API_KEY ? "configured" : "not_configured";

  const allOk = Object.values(checks).every((v) => v === "ok" || v === "not_configured" || v === "configured");

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
```

Para acceder:
```bash
curl https://catoledger.com/api/health
# {"status":"healthy","checks":{"app":"ok","supabase":"ok","gemini":"configured"},"timestamp":"..."}
```
