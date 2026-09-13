-- ============================================================
-- 00009 — WORKSPACE MEMBERS / USUARIOS DE WORKSPACE
-- ============================================================
-- roles por workspace (OWNER > ADMIN > USER > READ_ONLY) y funciones
-- de gestión de miembros. La FK workspace_id → workspaces(id) se
-- agrega en 00010 junto con el catálogo de workspaces.

-- ============================================================
-- 1. WORKSAPCE_MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'USER'
    CHECK (role IN ('OWNER', 'ADMIN', 'USER', 'READ_ONLY')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
  -- FK workspace_id -> workspaces(id): se agrega en 00010
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
-- donde participa. Escritura: SOLO a través de las funciones de gestión.
DROP POLICY IF EXISTS "Members select own or shared" ON public.workspace_members;
CREATE POLICY "Members select own or shared" ON public.workspace_members
  FOR SELECT USING (
    user_id = auth.uid() OR public.current_user_in_workspace(workspace_id)
  );

-- ============================================================
-- 2. GESTIÓN DE MIEMBROS (SECURITY DEFINER con control de rol)
-- ============================================================

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
-- 3. GRANTS
-- ============================================================

GRANT SELECT ON public.workspace_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.role_rank(text) TO public;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_in_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_workspace_member(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_workspace_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated;