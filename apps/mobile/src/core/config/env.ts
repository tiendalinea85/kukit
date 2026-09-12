function read(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export const env = {
  apiUrl: read('EXPO_PUBLIC_API_URL', 'http://localhost:8000'),
  supabaseUrl: read('EXPO_PUBLIC_SUPABASE_URL', ''),
  supabaseAnonKey: read('EXPO_PUBLIC_SUPABASE_ANON_KEY', ''),
};

export function isSupabaseConfigured(): boolean {
  return env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
}
