// Reintentos con backoff exponencial + jitter.
//
// La demora crece de forma exponencial según el número de intentos fallidos,
// con un límite superior y un factor aleatorio (±jitter) para evitar que todos
// los dispositivos golpeen al servidor al mismo tiempo tras una reconexión
// masiva. Un intento con delay `null` significa "reintentar inmediatamente".

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  factor?: number;
  jitter?: number;
}

export const DEFAULT_BACKOFF: Required<BackoffOptions> = {
  baseMs: 1000,
  maxMs: 60_000,
  factor: 2,
  jitter: 0.2,
};

export function clampBackoffDelay(delayMs: number, maxMs: number): number {
  return Math.max(0, Math.min(Math.round(delayMs), maxMs));
}

export function withJitter(delayMs: number, jitter: number, random: () => number = Math.random): number {
  const spread = delayMs * jitter;
  const min = Math.max(0, delayMs - spread);
  const max = delayMs + spread;
  return min + random() * (max - min);
}

/**
 * Calcula la demora de reintento para un intento dado (1-indexed).
 *
 * @param attempts Número de intentos ya fallidos.
 * @param options  Configuración del backoff.
 * @param random   Generador de aleatoriedad inyectable para pruebas.
 */
export function computeBackoffDelay(
  attempts: number,
  options: BackoffOptions = {},
  random: () => number = Math.random,
): number {
  const { baseMs, maxMs, factor, jitter } = { ...DEFAULT_BACKOFF, ...options };
  if (attempts <= 0) return 0;
  const exponential = baseMs * Math.pow(factor, attempts - 1);
  const clamped = clampBackoffDelay(exponential, maxMs);
  return clampBackoffDelay(withJitter(clamped, jitter, random), maxMs);
}

/** Secuencia de demoras esperada para un esquema dado (con jitter = 0). */
export function backoffSequence(attempts: number, options: BackoffOptions = {}): number[] {
  const { baseMs, maxMs, factor } = { ...DEFAULT_BACKOFF, ...options };
  const seq: number[] = [];
  for (let i = 1; i <= attempts; i++) {
    seq.push(clampBackoffDelay(baseMs * Math.pow(factor, i - 1), maxMs));
  }
  return seq;
}
