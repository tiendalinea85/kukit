-- ============================================================
-- 00010 — AUTH, ROLES, PERMISOS Y AUDITORÍA
-- ============================================================
-- Identidad (profiles), roles por workspace (OWNER/ADMIN/USER/READ_ONLY),
-- auditoría (audit_events) y RLS para las tres.
--
-- NOTA: el catálogo de workspaces del servidor llega en Etapa A
-- (migración 00002 del plan multi-workspace). `workspace_members` queda
-- preparado: la FK hacia `workspaces(id)` se agrega junto con esa tabla.
--
-- Las políticas de las tablas de negocio siguen usando `user_id =
-- auth.uid()` (por usuario). El aislamiento por workspace se aplica en
-- Etapa A/B sobre estas mismas funciones de rol.

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

-- Mantiene updated_at.
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
-- 2. ROLES POR WORKSPACE (OWNER / ADMIN / USER / READ_ONLY)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'USER'
    CHECK (role IN ('OWNER', 'ADMIN', 'USER', 'READ_ONLY')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
  -- FK workspace_id -> workspaces(id): se agrega en Etapa A
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Jerarquía: OWNER(4) > ADMIN(3) > USER(2) > READ_ONLY(1)
CREATE OR REPLACE FUNCTION public.role_rank(p_role text)
RETURNS int
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT CASE p_role
    WHEN 'OWNER' THEN 4
    WHEN 'ADMIN' THEN 3
    WHEN 'USER' THEN 2
    WHEN 'READ_ONLY' THEN 1
    ELSE 0
  END;
$$;

-- true si el usuario actual tiene al menos el rol más bajo de p_roles.
-- SECURITY DEFINER: evita recursión de RLS y centraliza la lógica.
CREATE OR REPLACE FUNCTION public.has_workspace_role(p_workspace uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = p_workspace
      AND m.user_id = auth.uid()
      AND public.role_rank(m.role) >= (
        SELECT min(public.role_rank(x))
        FROM unnest(p_roles) AS x
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_in_workspace(p_workspace uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = p_workspace AND m.user_id = auth.uid()
  );
$$;

-- Lectura: el usuario ve sus propias membresías y las de los workspaces
-- donde participa. Escritura: SOLO a través de las funciones de gestión
-- (no existen políticas INSERT/UPDATE/DELETE).
DROP POLICY IF EXISTS "Members select own or shared" ON public.workspace_members;
CREATE POLICY "Members select own or shared" ON public.workspace_members
  FOR SELECT USING (
    user_id = auth.uid() OR public.current_user_in_workspace(workspace_id)
  );

-- Gestión de miembros (SECURITY DEFINER con control de rol).
CREATE OR REPLACE FUNCTION public.add_workspace_member(p_workspace uuid, p_user uuid, p_role text DEFAULT 'USER')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_role NOT IN ('OWNER', 'ADMIN', 'USER', 'READ_ONLY') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;
  IF NOT public.has_workspace_role(p_workspace, ARRAY['OWNER', 'ADMIN']) THEN
    RAISE EXCEPTION 'Sin permisos para gestionar miembros';
  END IF;
  IF p_role = 'OWNER' AND NOT public.has_workspace_role(p_workspace, ARRAY['OWNER']) THEN
    RAISE EXCEPTION 'Solo el OWNER puede asignar el rol OWNER';
  END IF;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (p_workspace, p_user, p_role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = excluded.role;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_workspace_role(p_workspace uuid, p_user uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role text;
BEGIN
  IF p_role NOT IN ('OWNER', 'ADMIN', 'USER', 'READ_ONLY') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;
  SELECT m.role INTO target_role
  FROM public.workspace_members m
  WHERE m.workspace_id = p_workspace AND m.user_id = p_user;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'El usuario no es miembro del workspace';
  END IF;
  IF NOT public.has_workspace_role(p_workspace, ARRAY['OWNER', 'ADMIN']) THEN
    RAISE EXCEPTION 'Sin permisos para gestionar miembros';
  END IF;
  IF target_role = 'OWNER' OR p_role = 'OWNER' THEN
    IF NOT public.has_workspace_role(p_workspace, ARRAY['OWNER']) THEN
      RAISE EXCEPTION 'Solo el OWNER puede gestionar el rol OWNER';
    END IF;
  END IF;
  UPDATE public.workspace_members SET role = p_role
  WHERE workspace_id = p_workspace AND user_id = p_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_workspace_member(p_workspace uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role text;
BEGIN
  SELECT m.role INTO target_role
  FROM public.workspace_members m
  WHERE m.workspace_id = p_workspace AND m.user_id = p_user;
  IF target_role IS NULL THEN
    RETURN;
  END IF;
  IF target_role = 'OWNER' THEN
    IF NOT public.has_workspace_role(p_workspace, ARRAY['OWNER']) THEN
      RAISE EXCEPTION 'Solo el OWNER puede remover a otro OWNER';
    END IF;
  ELSIF NOT public.has_workspace_role(p_workspace, ARRAY['OWNER', 'ADMIN']) THEN
    RAISE EXCEPTION 'Sin permisos para gestionar miembros';
  END IF;
  DELETE FROM public.workspace_members
  WHERE workspace_id = p_workspace AND user_id = p_user;
END;
$$;

-- ============================================================
-- 3. AUDITORÍA (audit_events)
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
-- 4. GRANTS
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO public;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO public;
GRANT EXECUTE ON FUNCTION public.role_rank(text) TO public;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_in_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_workspace_member(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_workspace_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated;
