# CatoLedger — Procedimientos de recuperación de errores

## Tabla de contenido

1. [Corrupción de IndexedDB](#1-corrupción-de-indexeddb)
2. [Conflictos de sincronización](#2-conflictos-de-sincronización)
3. [Fallo de conexión a Supabase](#3-fallo-de-conexión-a-supabase)
4. [Fallo de la API de Gemini](#4-fallo-de-la-api-de-gemini)
5. [Cuota de almacenamiento excedida](#5-cuota-de-almacenamiento-excedida)
6. [Expiración de token de auth](#6-expiración-de-token-de-auth)
7. [Exportación e importación de datos](#7-exportación-e-importación-de-datos)
8. [Recuperación ante desastres](#8-recuperación-ante-desastres)

---

## 1. Corrupción de IndexedDB

### Síntomas

- La app no carga datos locales
- Errores en consola del navegador tipo `NotFoundError`, `InvalidStateError`
- Los gastos desaparecen pero la app funciona

### Causas comunes

- Navegador cerrado durante una operación de escritura
- Actualización del navegador corrompió la DB
- Cuota de almacenamiento excedida durante escritura
- Migración de esquema de Dexie falló

### Procedimiento de recuperación

#### Opción A: Recrear la base de datos

1. Abre DevTools → Application → IndexedDB
2. Elimina manualmente la base de datos `CatoLedgerDB` (o el nombre que uses)
3. Recarga la app — Dexie recreará las tablas automáticamente
4. Los datos se restaurarán desde Supabase (si hay sync configurado)

#### Opción B: Usar la función de reset (si existe)

```typescript
// En la consola del navegador:
import { db } from "@/lib/db";
await db.delete();
location.reload();
```

#### Opción C: Forzar desde el código

Si tienes acceso al código, agregar un botón de "Resetear datos" en Settings:

```typescript
import { db } from "@/lib/db";

async function resetLocalData() {
  if (!confirm("¿Estás seguro? Se borrarán todos los datos locales.")) return;
  await db.delete();
  location.reload();
}
```

### Prevención

- No cerrar la app durante una sincronización activa
- Monitorear la cuota de almacenamiento (ver monitoring/README.md)
- Implementar migraciones de Dexie con `upgrades` callback

---

## 2. Conflictos de sincronización

### Síntomas

- El ícono de sync muestra estado "error"
- Operaciones en estado `conflict` en el outbox
- Datos diferentes en el servidor vs. local

### Cómo funcionan los conflictos

CatoLedger usa un sistema de **optimistic locking**:
- Cada registro tiene un `updated_at` timestamp
- Al sincronizar, si el servidor tiene un registro más reciente → conflicto
- El conflicto se marca en el outbox para revisión manual

### Procedimiento de resolución

#### Revisar conflictos desde la UI

1. Ve a Settings → Sync (o el indicador de sync)
2. Identifica operaciones marcadas como "conflicto"
3. Para cada conflicto, la app muestra:
   - Versión local (modificada offline)
   - Versión del servidor (modificada por otro dispositivo o sync previo)
4. Elige: **mantener local** o **usar servidor**

#### Resolución automática (para implementar)

```typescript
// Estrategia "last-write-wins" (simple)
function resolveConflict(local: any, server: any): any {
  const localTime = new Date(local.updated_at).getTime();
  const serverTime = new Date(server.updated_at).getTime();
  return localTime >= serverTime ? local : server;
}

// Estrategia "server wins" (más segura)
function resolveConflict(local: any, server: any): any {
  return server;
}

// Estrategia "merge" (para campos específicos)
function resolveConflict(local: any, server: any): any {
  return {
    ...server,
    description: local.description || server.description,
    amount: Math.max(local.amount, server.amount), // o average, etc.
  };
}
```

#### Forzar resolución desde consola

```typescript
// Listar operaciones en conflicto
import { db } from "@/lib/db";
const conflicts = await db.syncOps.where("state").equals("conflict").toArray();
console.table(conflicts);

// Forzar: accept server version para todas
import { completeOperation } from "@/lib/sync/outbox";
for (const op of conflicts) {
  await completeOperation(op.id, { serverRevision: op.entityId });
}
```

### Prevención

- Minimizar el tiempo offline (sincronizar al恢复 conexión)
- Usar campos granulares en lugar de sobrescribir registros completos
- Implementar merge inteligente para campos específicos

---

## 3. Fallo de conexión a Supabase

### Síntomas

- Sync engine en estado `offline` o `error`
- Login/logout no funciona
- La app funciona pero sin datos del servidor

### Diagnóstico

```bash
# Verificar si Supabase está arriba
curl -s https://tu-proyecto.supabase.co/auth/v1/health

# Verificar desde la app
./scripts/health-check.sh https://catoledger.com
```

### Procedimiento

#### Si es un problema temporal de red

1. La app funciona offline con datos locales
2. El sync engine reintentará automáticamente (backoff exponencial)
3. Al恢复 conexión, se sincronizará automáticamente

#### Si Supabase está caído

1. Verificar [status.supabase.com](https://status.supabase.com)
2. Si es outage general → esperar resolución
3. Si es solo tu proyecto → contactar soporte de Supabase

#### Si es problema de configuración

1. Verificar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Verificar que RLS no está bloqueando las queries
3. Verificar en Supabase Dashboard → Logs → Postgres

### Recuperación post-fallo

```typescript
// La app reconecta automáticamente, pero si necesitas forzar:
import { runManualSync } from "@/lib/sync";
await runManualSync();
```

---

## 4. Fallo de la API de Gemini

### Síntomas

- OCR de facturas retorna error 502
- Asistente de voz retorna `missing_api_key` o `parse_error`
- Errores en server logs: `Gemini error 429` (rate limit)

### Causas

| Error HTTP | Causa | Solución |
|---|---|---|
| 400 | API key inválida | Regenerar key en Google AI Studio |
| 403 | Key sin permisos o proyecto suspendido | Verificar proyecto en Google Cloud Console |
| 429 | Rate limit excedido | Esperar o incrementar cuota |
| 500 | Error interno de Google | Esperar y reintentar |
| 502 | Modelo no disponible | Cambiar `GEMINI_MODEL` a otro modelo |

### Procedimiento

1. Verificar que `GEMINI_API_KEY` está configurada
2. Probar la key directamente:
   ```bash
   curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=TU_KEY"
   ```
3. Si es rate limit → incrementar cuota en Google Cloud Console
4. Si el modelo falla → cambiar `GEMINI_MODEL`:
   ```
   GEMINI_MODEL=gemini-2.0-flash  # Alternativa más estable
   ```

### Fallback

La app maneja gracefully los fallos de Gemini:
- OCR: retorna `confidence: low` con campos vacíos
- Voz: retorna `intent: unclear` con razón del error
- El usuario puede ingressar datos manualmente

---

## 5. Cuota de almacenamiento excedida

### Síntomas

- `QuotaExceededError` en consola del navegador
- La app no guarda nuevos gastos
- IndexedDB no responde

### Diagnóstico

```typescript
// Verificar uso actual
const { usage, quota } = await navigator.storage.estimate();
console.log(`Uso: ${(usage / 1024 / 1024).toFixed(1)} MB / ${(quota / 1024 / 1024).toFixed(1)} MB`);
console.log(`Porcentaje: ${Math.round((usage / quota) * 100)}%`);
```

### Procedimiento de emergencia

1. **Exportar datos inmediatamente** (ver §7)
2. **Limpiar syncLog antiguo:**
   ```typescript
   import { db } from "@/lib/db";
   await db.syncLog.clear();
   ```
3. **Eliminar registros antiguos:**
   ```typescript
   // Eliminar gastos de hace más de 1 año
   const cutoff = new Date();
   cutoff.setFullYear(cutoff.getFullYear() - 1);
   await db.expenses.where("date").below(cutoff.toISOString().split("T")[0]).delete();
   ```
4. **Recargar la app**

### Prevención

- Implementar alerta al 60% de uso (ver monitoring/README.md)
- Exportar datos periódicamente
- Limpiar syncLog cada 30 días

---

## 6. Expiración de token de auth

### Síntomas

- La app muestra "sesión expirada" o errores 401
- Sync falla con errores de autenticación
- El usuario es deslogueado

### Procedimiento

1. **Re-login automático:** Supabase refresca tokens automáticamente. Si falla:
   - El usuario debe hacer logout y login manualmente
2. **Forzar refresh:**
   ```typescript
   import { getSupabase } from "@/lib/supabase";
   const sb = getSupabase();
   const { data, error } = await sb.auth.refreshSession();
   ```
3. **Verificar configuración:**
   - `NEXT_PUBLIC_SUPABASE_URL` correcto
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` correcto
   - Cookies no bloqueadas por el navegador

### Tokens de service role

Si `SUPABASE_SERVICE_ROLE_KEY` expira:
1. Ir a Supabase Dashboard → Settings → API
2. Regenerar la service role key
3. Actualizar en variables de entorno
4. Redesplegar la app

---

## 7. Exportación e importación de datos

### Exportar desde la app

La app debe tener un botón de exportar en Settings:

```typescript
import { db } from "@/lib/db";
import * as XLSX from "xlsx";

async function exportToJSON() {
  const data = {
    expenses: await db.expenses.toArray(),
    categories: await db.categories.toArray(),
    types: await db.types.toArray(),
    investments: await db.investments.toArray(),
    exportDate: new Date().toISOString(),
    version: "1.0.0",
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `catoledger-backup-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportToCSV() {
  const expenses = await db.expenses.toArray();
  const ws = XLSX.utils.json_to_sheet(expenses);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gastos");
  XLSX.writeFile(wb, `catoledger-gastos-${new Date().toISOString().split("T")[0]}.xlsx`);
}
```

### Importar desde JSON

```typescript
async function importFromJSON(file: File) {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data.expenses || !Array.isArray(data.expenses)) {
    throw new Error("Formato de backup inválido");
  }

  // Confirmar con el usuario
  if (!confirm(`Se importarán ${data.expenses.length} gastos. ¿Continuar?`)) return;

  await db.expenses.bulkPut(data.expenses);
  if (data.categories) await db.categories.bulkPut(data.categories);
  if (data.types) await db.types.bulkPut(data.types);
  if (data.investments) await db.investments.bulkPut(data.investments);

  // Sync con servidor
  await runManualSync();
}
```

### Backup de Supabase (server-side)

```bash
# Usando el script existente
.\scripts\backup-supabase.ps1

# O con supabase CLI
supabase db dump --file=backups/catoledger-$(date +%Y%m%d).dump
```

---

## 8. Recuperación ante desastres

### Escenarios

| Escenario | Severidad | RTO (Recovery Time Objective) |
|---|---|---|
| Datos locales perdidos (IndexedDB) | Media | 5 min (restore desde Supabase) |
| Supabase caído | Alta | 1-24h (esperar Supabase) |
| Servidor de app caído | Alta | < 1h (redeploy) |
| Base de datos Supabase corrupta | Crítica | < 4h (restore desde backup) |
| Pérdida total de infraestructura | Crítica | < 24h |

### Plan de recuperación

#### Nivel 1: Datos locales perdidos

1. Los datos están seguros en Supabase
2. Recarga la app — sincronizará automáticamente
3. Si no sync → verificar credenciales y conexión

#### Nivel 2: Supabase inaccesible

1. La app sigue funcionando offline
2. Los datos se mantienen en IndexedDB
3. Al恢复 conexión, sync automático
4. Si outage > 24h → considerar migración temporal a otro backend

#### Nivel 3: Datos del servidor perdidos

1. Restaurar desde el backup más reciente:
   ```bash
   # PowerShell (ya existe)
   .\scripts\backup-supabase.ps1  # Para crear backup nuevo

   # Para restaurar:
   pg_restore --no-owner --if-exists --clean \
     --dbname="$env:SUPABASE_DB_URL" \
     ".\backups\catoledger-YYYYMMDD.dump"
   ```
2. Los clientes se sincronizarán con los datos restaurados
3. Verificar que no hay conflictos post-restore

#### Nivel 4: Pérdida total

1. Crear nuevo proyecto Supabase
2. Ejecutar migraciones SQL
3. Restaurar desde backup (si existe)
4. Actualizar variables de entorno
5. Redesplegar la app
6. Los clientes con datos locales sincronizarán al reconectar

### Backups automáticos

Configurar backup diario con cron (Linux/Mac):

```bash
# Crontab: backup diario a las 3 AM
0 3 * * * /path/to/scripts/backup.sh >> /var/log/catoledger-backup.log 2>&1
```

Windows (Task Scheduler):

```powershell
# Crear tarea programada diaria
schtasks /create /tn "CatoLedger Backup" /tr "powershell -File C:\path\to\scripts\backup-supabase.ps1" /sc daily /st 03:00
```

### Prueba de restauración

Realizar una prueba de restauración cada trimestre:
1. Crear backup de Supabase
2. Clonar el proyecto (o usar un proyecto temporal)
3. Restaurar el backup
4. Verificar que los datos son correctos
5. Documentar cualquier problema encontrado

### Contactos de emergencia

| Servicio | URL | Contacto |
|---|---|---|
| Supabase | [status.supabase.com](https://status.supabase.com) | Dashboard → Support |
| Google AI (Gemini) | [aistudio.google.com](https://aistudio.google.com) | Google Cloud Support |
| Vercel | [vercel.com](https://vercel.com) | Dashboard → Support |
| Sentry | [sentry.io](https://sentry.io) | Dashboard → Support |
