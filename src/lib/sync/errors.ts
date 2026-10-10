import type { SyncErrorInfo, SyncErrorType } from "../../types/sync.ts";

// Clasificación de errores de sincronización.
//
//   - network:    sin conectividad (navigator offline o fetch falla).
//   - timeout:    el servidor no respondió a tiempo (AbortError o 408).
//   - auth:       401/403 — sesión inválida o expirada.
//   - server:     5xx, 429 y errores transitorios (404 de tabla aún no creada).
//   - validation: 4xx — el payload fue rechazado (no retryable sin cambio).
//   - conflict:   el servidor tiene una revisión más nueva (409 o guardado OCC).
//   - unknown:    cualquier otra cosa.
//
// Reglas de reintento:
//   - 429, 500/502/503/504 y fallos de red → retryable (backoff exponencial).
//   - 408 → timeout retryable.
//   - errores de esquema (PGRST204 columna ausente, PGRST1xx de consulta) → NO
//     se reintentan para siempre: quedan `failed` hasta que se aplique la
//     migración o el usuario decida reintentar.
//   - 409 → se decide por el contenido real (transitorio / clave duplicada /
//     conflicto de versión), no solo por el número.
//
// PostgREST devuelve el SQLSTATE de PostgreSQL en `code` ("42501", "23505",
// "PGRST301") y el estado HTTP en `status`; ver classifySqlState y
// classifyHttpStatus. `classifyWriteResponse` es la única vía que autoriza un
// ACK (solo 2xx sin error).
//
// Los errores `retryable` se reintentan con backoff exponencial; el resto se
// marcan como `failed` permanente o `conflict` (requieren intervención).

const ABORT_NAME = "AbortError";
const TIMEOUT = "TimeoutError";

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === ABORT_NAME || err.name === TIMEOUT
    : (err as { name?: string } | null)?.name === ABORT_NAME ||
        (err as { name?: string } | null)?.name === TIMEOUT;
}

export function isFetchNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /fetch|network|load failed|failed to fetch/i.test(String(err.message));
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const any = err as { message?: unknown; error?: { message?: unknown } };
    if (typeof any.error?.message === "string") return any.error.message;
    if (typeof any.message === "string") return any.message;
  }
  return "Error desconocido";
}

export interface ClassifyOptions {
  offline: boolean;
}

// SQLSTATE de PostgreSQL (5 caracteres), errores propios de PostgREST
// ("PGRST" + 3 dígitos) y estados HTTP (3 dígitos).
const SQLSTATE_RE = /^(PGRST\d{3}|[0-9A-Z]{5})$/;
const HTTP_STATUS_RE = /^\d{3}$/;

function classifySqlState(code: string, message: string): SyncErrorInfo | null {
  if (code.startsWith("PGRST")) {
    if (/^PGRST3\d\d$/.test(code)) {
      return { type: "auth", message: `Sesión inválida o expirada: ${message}`, retryable: false };
    }
    if (code === "PGRST204") {
      // Columna ausente del schema cache: el payload no se arregla solo y
      // reintentar no crea la columna (p. ej. "Could not find the 'category_id'
      // column..."). El transporte retira del payload las columnas ausentes que
      // puede; si el error persiste, queda `failed` hasta aplicar la migración.
      return {
        type: "validation",
        message: `Columna ausente en el esquema del servidor (migración pendiente): ${message}`,
        retryable: false,
      };
    }
    if (code.startsWith("PGRST1")) {
      // Errores de consulta (p. ej. PGRST116 "multiple rows returned"):
      // reintentar con los mismos datos produce el mismo resultado.
      return { type: "validation", message, retryable: false };
    }
    // PGRST205 y demás PGRST2xx: tabla o recurso ausente del esquema. Como un
    // 404, se reintenta con backoff para auto-repararse cuando se publique la
    // migración que falta.
    return { type: "server", message, retryable: true };
  }

  switch (code.slice(0, 2)) {
    case "28": // credenciales de autenticación inválidas
      return { type: "auth", message, retryable: false };
    case "40": // 40001 serialization_failure / 40P01 deadlock_detected
      return { type: "server", message, retryable: true };
    case "42":
      if (code === "42501") {
        // RLS o GRANT denegado: reintentar no cambia nada, hay que revisar
        // permisos/ políticas en el servidor.
        return { type: "auth", message: `Sin permisos sobre la tabla (RLS): ${message}`, retryable: false };
      }
      if (code === "42P01") {
        // Tabla inexistente: igual que un 404, esperar a que exista.
        return { type: "server", message, retryable: true };
      }
      return { type: "validation", message, retryable: false };
    case "23": // violación de integridad
      if (code === "23503") {
        return { type: "server", message: "Referencia pendiente de sincronizar (dependencia)", retryable: true };
      }
      // 23505 (clave duplicada) y 23514 (check): el payload no se arregla solo.
      return { type: "validation", message, retryable: false };
    case "22": // rango / conversión de datos
      return { type: "validation", message, retryable: false };
    case "53":
    case "54":
    case "57":
    case "58": // recursos insuficientes, límites, conexión
      return { type: "server", message, retryable: true };
    default:
      return null;
  }
}

// Un 409 no es siempre lo mismo: según el contenido real puede ser una colisión
// transitoria del motor de transacciones (reintenta), una clave única que ya
// existe en el servidor (reintentar no la arregla) o un conflicto de versión
// que requiere decisión del usuario.
function classifyConflict409(message: string): SyncErrorInfo {
  const m = message.toLowerCase();
  if (/deadlock|serializ|try again|concurrent|lock( |_)?timeout|lock_not_available|transaction/.test(m)) {
    return { type: "server", message: `Conflicto transitorio de transacción (409): ${message}`, retryable: true };
  }
  if (/duplicate|unique|already exists|violat/.test(m)) {
    return {
      type: "validation",
      message: `El servidor ya tiene una fila con esa clave (409): ${message}`,
      retryable: false,
    };
  }
  return {
    type: "conflict",
    message: "Conflicto de versión: el registro cambió en otro dispositivo",
    retryable: false,
  };
}

/** Clasificación por estado HTTP (O2/O3). */
export function classifyHttpStatus(status: number, message: string): SyncErrorInfo {
  if (status === 0) {
    // postgrest-js devuelve status 0 cuando fetch fue rechazado (red caída).
    return { type: "network", message: "Sin respuesta del servidor (fetch rechazado)", retryable: true };
  }
  if (status === 401 || status === 403) {
    return { type: "auth", message: "Sesión inválida o sin permisos", retryable: false };
  }
  if (status === 408) {
    return { type: "timeout", message: `Tiempo de espera agotado (408): ${message}`, retryable: true };
  }
  if (status === 429) {
    return { type: "server", message: `Límite de peticiones alcanzado (429): ${message}`, retryable: true };
  }
  if (status === 409) return classifyConflict409(message);
  if (status === 404) {
    // El recurso no existe en el servidor (p. ej. la tabla no está creada o
    // la ruta del endpoint cambió). Es transitorio: se reintenta con backoff
    // para auto-repararse cuando el backend esté listo (Offline-First).
    return { type: "server", message: `El servidor no encontró el recurso (404): ${message}`, retryable: true };
  }
  if (status >= 400 && status < 500) {
    return { type: "validation", message: `El servidor rechazó el registro: ${message}`, retryable: false };
  }
  if (status >= 500) {
    return { type: "server", message: `Error del servidor (${status}): ${message}`, retryable: true };
  }
  if (status >= 200 && status < 300) {
    // 2xx acompañado de un error: el cuerpo no era el esperado. No es un
    // éxito y reintentar con los mismos datos no lo arregla.
    return {
      type: "validation",
      message: `Respuesta 2xx con cuerpo inesperado (${status}): ${message}`,
      retryable: false,
    };
  }
  // 1xx/3xx: respuesta intermedia que no esperábamos (normalmente un proxy).
  return { type: "server", message: `Respuesta HTTP inesperada (${status}): ${message}`, retryable: true };
}

export function classifySyncError(err: unknown, opts: ClassifyOptions = { offline: false }): SyncErrorInfo {
  const message = messageOf(err);

  if (opts.offline) {
    return { type: "network", message: "Sin conexión a internet", retryable: true };
  }
  if (isAbortError(err)) {
    return { type: "timeout", message: "Tiempo de espera agotado al contactar el servidor", retryable: true };
  }
  if (isFetchNetworkError(err)) {
    return { type: "network", message: "Fallo de red al contactar el servidor", retryable: true };
  }
  // postgrest-js empaqueta la cancelación como un objeto con mensaje "AbortError: ..."
  // (no como DOMException), así que el name no basta para detectarla.
  if (/^aborterror\b|the user aborted|request was aborted/i.test(message)) {
    return { type: "timeout", message: "Tiempo de espera agotado al contactar el servidor", retryable: true };
  }

  const code = (err as { code?: unknown } | null)?.code;
  const status = (err as { status?: number; statusCode?: number } | null)?.status;

  // PostgREST entrega en `code` el SQLSTATE de PostgreSQL ("42501", "23505",
  // "PGRST301"), que NO es un estado HTTP. Tratarlo como tal mete 42501 (RLS)
  // y 23505 (duplicado) en la rama ">= 500" y se reintentan para siempre.
  if (typeof code === "string" && SQLSTATE_RE.test(code)) {
    const info = classifySqlState(code, message);
    if (info) return info;
  }

  if (typeof status === "number" || typeof code === "number" || typeof code === "string") {
    const httpStatus =
      typeof status === "number"
        ? status
        : typeof code === "number"
          ? code
          : typeof code === "string" && HTTP_STATUS_RE.test(code)
            ? Number(code)
            : 0;

    const info = classifyHttpStatus(httpStatus, message);
    if (info) return info;
  }

  // Códigos de error específicos del cliente Supabase.
  const messageNorm = message.toLowerCase();
  if (messageNorm.includes("jwt") || messageNorm.includes("token") || messageNorm.includes("auth")) {
    return { type: "auth", message, retryable: false };
  }
  if (
    messageNorm.includes("duplicate") ||
    messageNorm.includes("already exists") ||
    messageNorm.includes("unique")
  ) {
    return { type: "validation", message, retryable: false };
  }
  if (messageNorm.includes("foreign key") || messageNorm.includes("23503")) {
    return { type: "server", message: "Referencia pendiente de sincronizar (dependencia)", retryable: true };
  }
  if (messageNorm.includes("append-only") || messageNorm.includes("23601")) {
    return { type: "conflict", message: "Operación no permitida sobre un movimiento registrado", retryable: false };
  }
  if (messageNorm.includes("conflict")) {
    return { type: "conflict", message: "Conflicto de versión: el registro cambió en otro dispositivo", retryable: false };
  }

  return { type: "unknown", message, retryable: true };
}

/**
 * ACK real (O5): solo confirma una escritura cuando el servidor respondió con
 * un 2xx sin error. Un `fetch` que no lanzó excepción, un cuerpo inesperado o
 * un status fuera de 2xx NO son éxito: se devuelve un error clasificado para
 * que el outbox no marque la operación como `synced`.
 */
export interface WriteResponseLike {
  error?: unknown;
  status?: number;
}

export function classifyWriteResponse(res: WriteResponseLike | null | undefined): SyncErrorInfo | null {
  if (res?.error) {
    const info = classifySyncError(res.error);
    // El error vino sin contexto usable (sin SQLSTATE ni status propio): manda
    // el status real de la respuesta. Así un cuerpo no JSON con HTTP 400 no se
    // queda como "unknown" reintentable para siempre.
    if (info.type === "unknown" && typeof res.status === "number" && res.status !== 0) {
      return classifyHttpStatus(res.status, info.message);
    }
    return info;
  }

  const status = typeof res?.status === "number" ? res.status : null;
  if (status === null) {
    return { type: "network", message: "Sin confirmación del servidor (status HTTP ausente)", retryable: true };
  }
  if (status >= 200 && status < 300) return null;

  return classifyHttpStatus(status, "La escritura no fue confirmada por el servidor");
}

export function isPermanentError(type: SyncErrorType): boolean {
  return type === "validation" || type === "conflict" || type === "auth";
}

export function isRetryableError(info: SyncErrorInfo): boolean {
  return info.retryable;
}
