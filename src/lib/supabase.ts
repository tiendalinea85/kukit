import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isOffline, withTimeout } from "./net";

let _supabase: SupabaseClient | null = null;
let _currentUser: User | null = null;
let _authListeners: Array<(user: User | null) => void> = [];
let _authUnsub: (() => void) | null = null;

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

export function isSupabaseConfigured(): boolean {
  return !!(getSupabaseUrl() && getSupabaseAnonKey());
}

// Lee el código OAuth/recovery desde la URL, tanto si llega como query param
// (PKCE) como en el hash. Usado por /auth/callback y /auth/reset.
export function getOAuthCode(): string | null {
  const url = new URL(window.location.href);
  let code = url.searchParams.get("code");
  if (!code) {
    code = new URLSearchParams(window.location.hash.slice(1)).get("code");
  }
  return code;
}

export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  if (!isSupabaseConfigured()) return null;
  _supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: true, autoRefreshToken: true },
    db: { schema: "public" },
  });
  return _supabase;
}

export async function getCurrentUser(): Promise<User | null> {
  if (_currentUser) return _currentUser;
  const sb = getSupabase();
  if (!sb) return null;

  // Offline-First: si no hay red, usar la sesión cacheada localmente
  // (persistSession) SIN llamadas de red. Si no hay sesión local, devuelve
  // null y AuthProvider cae al fallback (mock local), nunca a un spinner.
  if (isOffline()) {
    const { data } = await sb.auth.getSession();
    _currentUser = data.session?.user ?? null;
    return _currentUser;
  }

  try {
    const { data } = await withTimeout(sb.auth.getUser());
    _currentUser = data?.user ?? null;
  } catch {
    // Red lenta / "online" reportado pero sin internet real: no colgar la UI,
    // usar la sesión local cacheada como fallback.
    const { data } = await sb.auth.getSession();
    _currentUser = data.session?.user ?? null;
  }
  return _currentUser;
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  _authListeners.push(callback);
  if (_currentUser !== undefined) callback(_currentUser);

  if (!_authUnsub) {
    const sb = getSupabase();
    if (sb) {
      const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
        _currentUser = session?.user ?? null;
        _authListeners.forEach((cb) => cb(_currentUser));
      });
      _authUnsub = () => sub.subscription.unsubscribe();
    }
  }

  return () => {
    _authListeners = _authListeners.filter((cb) => cb !== callback);
    if (!_authListeners.length && _authUnsub) {
      _authUnsub();
      _authUnsub = null;
    }
  };
}

export async function signInWithEmail(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase no configurado");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase no configurado");
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase no configurado");
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase no configurado");
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset`,
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase no configurado");
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  _currentUser = null;
  await sb.auth.signOut();
}
