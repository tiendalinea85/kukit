import { accessToken } from '../auth/supabase';
import { env } from '../config/env';
import { AppError, type ErrorCode } from '../errors';
import { logger } from '../logging';

const apiLogger = logger.child('api');

export interface ChangePayload {
  entity_type: string;
  entity_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
}

export interface PullRequest {
  cursors: Record<string, string>;
}

export interface PullResponse {
  changes: ChangePayload[];
  server_time: string;
}

export interface PushResponse {
  applied_ids: number[];
  conflicts: string[];
}

interface RequestOptions {
  timeoutMs?: number;
}

async function request<T>(path: string, method: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  const token = await accessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);

  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    throw new AppError('Sin conexión con el servidor', 'NETWORK', { path });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const code = classifyStatus(res.status);
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    } catch {
      // ignore
    }
    throw new AppError(`API ${res.status}: ${detail}`, code, { path, status: res.status });
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function classifyStatus(status: number): ErrorCode {
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 409) return 'CONFLICT';
  if (status === 422) return 'VALIDATION';
  return 'SYNC';
}

export const apiClient = {
  health(): Promise<boolean> {
    return request<{ status: string }>('/health/ready', 'GET', undefined, { timeoutMs: 4000 })
      .then((data) => data?.status === 'ready')
      .catch((error) => {
        apiLogger.warn('Health check falló', error);
        return false;
      });
  },

  push(changes: { id: number; entity_type: string; entity_id: string; operation: string; payload: string }[]): Promise<PushResponse> {
    return request<PushResponse>('/sync/push', 'POST', { changes });
  },

  pull(cursors: Record<string, string>): Promise<PullResponse> {
    return request<PullResponse>('/sync/pull', 'POST', { cursors });
  },
};
