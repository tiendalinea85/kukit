-- ============================================================
-- 00002 — USUARIOS / PERFILES Y AUDITORÍA
-- ============================================================
-- Identidad (profiles), auditoría (audit_events), trigger de
-- creación automática de perfil al registrarse y GRANTS básicos.
-- Los roles por workspace y workspace_members viven en 00009.

-- ============================================================
-- 1. PROFILES (identidad por usuario)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles select own" ON public.profiles;
CREATE POLICY "Profiles select own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles insert own" ON public.profiles;
CREATE POLICY "Profiles insert own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
CREATE POLICY "Profiles update own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Crea el perfil automáticamente al registrarse un usuario.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      ''
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Mantiene updated_at (función compartida para perfiles y workspaces).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. AUDITORÍA (audit_events)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user ON public.audit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON public.audit_events(action);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Insert: el usuario solo puede escribir eventos propios (user_id forzado).
DROP POLICY IF EXISTS "Audit insert own" ON public.audit_events;
CREATE POLICY "Audit insert own" ON public.audit_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Select: solo eventos propios.
DROP POLICY IF EXISTS "Audit select own" ON public.audit_events;
CREATE POLICY "Audit select own" ON public.audit_events
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 3. GRANTS (identidad y auditoría)
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO public;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO public;