// Cierre de seguridad del flujo de recuperación de contraseña:
// mientras el link de recovery no se consuma (cambiar la contraseña), la sesión
// creada por el evento PASSWORD_RECOVERY no debe servir para navegar la app.
// El flag vive en localStorage y por eso sobrevive recargas y navegación.

const FLAG_KEY = "zane-recovery-pending";

export function markRecoveryPending(): void {
  localStorage.setItem(FLAG_KEY, "true");
}

export function clearRecoveryPending(): void {
  localStorage.removeItem(FLAG_KEY);
}

export function isRecoveryPending(): boolean {
  return localStorage.getItem(FLAG_KEY) === "true";
}

// Rutas que el usuario puede ver con el flag activo: la página de reset y el
// login (para poder volver a pedir el link o iniciar sesión con la contraseña vieja).
const ALLOWED_PREFIXES = ["/auth/reset", "/auth"];

// Decisión pura del guard: ¿hay que redirigir a /auth/reset?
// - Sin flag → no intervenir.
// - Flag en /auth/* → no intervenir (esas rutas manejan su flujo).
// - Flag fuera de /auth → forzar /auth/reset.
export function shouldForceReset(pathname: string | null, pending: boolean): boolean {
  if (!pending) return false;
  if (!pathname) return true;
  return !ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export interface AuthCallbackParams {
  // Código PKCE (?code= o #code=); null en el flujo implícito.
  code: string | null;
  // Tokens de recovery en el hash (#access_token=...&type=recovery).
  hasRecoveryTokens: boolean;
  // El link devolvió un error (expirado, ya usado, etc.).
  hasError: boolean;
}

// Analiza la URL de retorno de Supabase sin tocar window (pura, testeable).
export function parseAuthCallback(href: string): AuthCallbackParams {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get("code") ?? hash.get("code") ?? null;
  return {
    code,
    hasRecoveryTokens:
      hash.get("type") === "recovery" && !!hash.get("access_token"),
    hasError: !!(url.searchParams.get("error") || hash.get("error")),
  };
}
