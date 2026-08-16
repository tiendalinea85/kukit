export type ErrorCode =
  | 'VALIDATION'
  | 'STORAGE'
  | 'NETWORK'
  | 'AUTH'
  | 'SYNC'
  | 'CONFLICT'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly context?: Record<string, unknown>;

  constructor(message: string, code: ErrorCode = 'UNKNOWN', context?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
  }

  static from(error: unknown, fallback: ErrorCode = 'UNKNOWN'): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof Error) return new AppError(error.message, fallback);
    return new AppError(String(error), fallback);
  }
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(error: unknown): Result<T> {
  return { ok: false, error: AppError.from(error) };
}

export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
}
