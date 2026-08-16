import { accessToken } from '../auth/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

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

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    } catch {
      // ignore
    }
    throw new Error(`API ${res.status}: ${detail}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const apiClient = {
  push(changes: { id: number; entity_type: string; entity_id: string; operation: string; payload: string }[]): Promise<PushResponse> {
    return request<PushResponse>('/sync/push', 'POST', { changes });
  },

  pull(cursors: Record<string, string>): Promise<PullResponse> {
    return request<PullResponse>('/sync/pull', 'POST', { cursors });
  },
};
