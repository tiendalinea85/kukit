import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

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
  const { data } = await sb.auth.getUser();
  _currentUser = data?.user ?? null;
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

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  _currentUser = null;
  await sb.auth.signOut();
}
