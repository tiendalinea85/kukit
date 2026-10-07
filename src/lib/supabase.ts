import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isOffline, withTimeout } from "./net";
import { parseAuthCallback } from "./recoveryGuard";

let _supabase: SupabaseClient | null = null;
let _currentUser: User | null = null;
// Distingue "todavía no he resuelto quién es el usuario" de "no hay sesión":
// sin esta bandera, onAuthStateChange notificaba un null síncrono al suscribirse
// y AuthProvider expulsaba a /auth en cada carga antes de resolver la sesión.
let _userResolved = false;
let _authListeners: Array<(user: User | null, event?: string) => void> = [];
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
  return parseAuthCallback(window.location.href).code;
}

// Borra los tokens del hash tras montar para que no se re-procesen en recargas
// ni queden expuestos en la barra de direcciones.
export function clearAuthHash(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
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
  if (_userResolved) return _currentUser;
  const sb = getSupabase();
  if (!sb) {
    _userResolved = true;
    return null;
  }

  // Offline-First: si no hay red, usar la sesión cacheada localmente
  // (persistSession) SIN llamadas de red. Si no hay sesión local, devuelve
  // null y AuthProvider cae al fallback (mock local), nunca a un spinner.
  if (isOffline()) {
    const { data } = await sb.auth.getSession();
    _currentUser = data.session?.user ?? null;
    _userResolved = true;
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
  _userResolved = true;
  return _currentUser;
}

export function onAuthStateChange(
  callback: (user: User | null, event?: string) => void
): () => void {
  _authListeners.push(callback);
  // Solo se replica el estado si ya se resolvió: notificar un null " provisional"
  // provocaba un ciclo logout→login en cada recarga de la PWA.
  if (_userResolved) callback(_currentUser);

  if (!_authUnsub) {
    const sb = getSupabase();
    if (sb) {
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        _currentUser = session?.user ?? null;
        _userResolved = true;
        _authListeners.forEach((cb) => cb(_currentUser, event));
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
