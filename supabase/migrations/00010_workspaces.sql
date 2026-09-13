-- ============================================================
-- 00010 — MULTI-WORKSPACE: workspaces, workspace_modules,
--          workspace_id en tablas de negocio, FK en members.
-- ============================================================
-- Regla de la casa: workspace_id se agrega ÚNICAMENTE a las tablas
-- de negocio que realmente existen (misma comprobación que en 00008).

-- ============================================================
-- 1. TABLA workspaces
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('PERSONAL','TRABAJO','ESTUDIO','NEGOCIO','BUSINESS')),
  parent_id   uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  model_key   text,
  description text NOT NULL DEFAULT '',
  role        text NOT NULL DEFAULT 'OWNER'
                CHECK (role IN ('OWNER','ADMIN','USER','READ_ONLY')),
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted     boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user    ON public.workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_type    ON public.workspaces(type);
CREATE INDEX IF NOT EXISTS idx_workspaces_parent  ON public.workspaces(parent_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_status  ON public.workspaces(status);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspaces select own"  ON public.workspaces;
CREATE POLICY "Workspaces select own" ON public.workspaces
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Workspaces insert own"  ON public.workspaces;
CREATE POLICY "Workspaces insert own" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Workspaces update own"  ON public.workspaces;
CREATE POLICY "Workspaces update own" ON public.workspaces
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. TABLA workspace_modules (módulos activos por workspace)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspace_modules (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  module_key   text NOT NULL,
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','disabled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_workspace_modules_ws ON public.workspace_modules(workspace_id);

ALTER TABLE public.workspace_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace modules select own" ON public.workspace_modules;
CREATE POLICY "Workspace modules select own" ON public.workspace_modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workspace modules insert own" ON public.workspace_modules;
CREATE POLICY "Workspace modules insert own" ON public.workspace_modules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workspace modules delete own" ON public.workspace_modules;
CREATE POLICY "Workspace modules delete own" ON public.workspace_modules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. FK: workspace_members → workspaces (completa 00009)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_workspace_members_workspace'
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT fk_workspace_members_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 4. workspace_id en las tablas de negocio EXISTENTES
-- ============================================================
-- workspace_id es un filtro de organización aplicado por la capa de
-- aplicación (queries + sync). Las RLS por user_id se conservan como
-- capa primaria de aislamiento entre usuarios.

DO $$
DECLARE
  t text;
  business_tables text[] := ARRAY[
    'categories', 'types', 'expenses',
    'investment_categories', 'investments',
    'customers', 'products',
    'sales', 'sale_details',
    'purchases', 'purchase_details',
    'inventory_movements'
  ];
BEGIN
  FOREACH t IN ARRAY business_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid', t);
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%I_workspace ON public.%I(workspace_id)', t, t);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 5. TRIGGER updated_at para workspaces
-- ============================================================

DROP TRIGGER IF EXISTS workspaces_set_updated_at ON public.workspaces;
CREATE TRIGGER workspaces_set_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.workspace_modules TO authenticated;

-- ============================================================
-- 7. COMENTARIOS
-- ============================================================

COMMENT ON TABLE public.workspaces IS 'Espacios de trabajo del usuario. PERSONAL/TRABAJO/ESTUDIO/NEGOCIO+BUSINESS.';
COMMENT ON TABLE public.workspace_modules IS 'Módulos activos por workspace.';
COMMENT ON COLUMN public.workspaces.model_key IS 'Modelo de negocio (solo type=BUSINESS): tailoring, agriculture, etc.';
COMMENT ON COLUMN public.workspaces.parent_id IS 'Workspace padre (BUSINESS→NEGOCIO). NULL para espacios raíz.';