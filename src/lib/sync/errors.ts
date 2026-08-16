import type { SyncErrorInfo, SyncErrorType } from "../../types/sync.ts";

// Clasificación de errores de sincronización.
//
//   - network:    sin conectividad (navigator offline o fetch falla).
//   - timeout:    el servidor no respondió a tiempo (AbortError).
//   - auth:       401/403 — sesión inválida o expirada.
//   - server:     5xx — error transitorio del servidor.
//   - validation: 4xx — el payload fue rechazado (no retryable sin cambio).
//   - conflict:   el servidor tiene una revisión más nueva (409 o guardado OCC).
//   - unknown:    cualquier otra cosa.
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

  const code = (err as { code?: unknown } | null)?.code;
  const status = (err as { status?: number; statusCode?: number } | null)?.status;

  if (typeof status === "number" || typeof code === "number" || typeof code === "string") {
    const httpStatus =
      typeof status === "number"
        ? status
        : typeof code === "number"
          ? code
          : Number(String(code).replace(/\D/g, "")) || 0;

    if (httpStatus === 401 || httpStatus === 403) {
      return { type: "auth", message: "Sesión inválida o sin permisos", retryable: false };
    }
    if (httpStatus === 409 || message.toLowerCase().includes("conflict")) {
      return { type: "conflict", message: "Conflicto de versión: el registro cambió en otro dispositivo", retryable: false };
    }
    if (httpStatus >= 400 && httpStatus < 500) {
      return { type: "validation", message: `El servidor rechazó el registro: ${message}`, retryable: false };
    }
    if (httpStatus >= 500) {
      return { type: "server", message: `Error del servidor (${httpStatus}): ${message}`, retryable: true };
    }
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

  return { type: "unknown", message, retryable: true };
}

export function isPermanentError(type: SyncErrorType): boolean {
  return type === "validation" || type === "conflict" || type === "auth";
}

export function isRetryableError(info: SyncErrorInfo): boolean {
  return info.retryable;
}
