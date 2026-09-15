-- ============================================================
-- 00011 — WORKSPACES: PROPIEDAD + RLS COMPLETO
--
-- La relación de propiedad YA existe desde 00010:
--   public.workspaces.user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
-- (equivalente a "owner_id"). Este archivo:
--   1. reafirma de forma idempotente las políticas SELECT/INSERT/UPDATE,
--   2. agrega la política DELETE que faltaba,
--   3. completa los GRANTS (faltaba DELETE),
--   4. indexa la consulta por propietario (+ no borrado),
--   5. documenta la semántica de user_id = dueño del workspace.
-- ============================================================

-- ------------------------------------------------------------
-- 1. POLÍTICAS RLS (idempotentes)
-- ------------------------------------------------------------
-- Toda operación se filtra por auth.uid(): un usuario solo ve/crea/edita/
-- borra SUS workspaces. Nunca se usa service_role en el frontend.

DROP POLICY IF EXISTS "Workspaces select own" ON public.workspaces;
CREATE POLICY "Workspaces select own" ON public.workspaces
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Workspaces insert own" ON public.workspaces;
CREATE POLICY "Workspaces insert own" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Workspaces update own" ON public.workspaces;
CREATE POLICY "Workspaces update own" ON public.workspaces
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Workspaces delete own" ON public.workspaces;
CREATE POLICY "Workspaces delete own" ON public.workspaces
  FOR DELETE USING (auth.uid() = user_id);

-- workspace_modules se controla contra el dueño del workspace padre.
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

-- ------------------------------------------------------------
-- 2. GRANTS
-- ------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.workspace_modules TO authenticated;

-- ------------------------------------------------------------
-- 3. ÍNDICE para "lista de workspaces de ${userId} sin borrados"
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_workspaces_user_deleted
  ON public.workspaces(user_id, deleted);

-- ------------------------------------------------------------
-- 4. DOCUMENTACIÓN
-- ------------------------------------------------------------

COMMENT ON COLUMN public.workspaces.user_id
  IS 'Dueño/autor del workspace (FK a auth.users). user_id = owner_id. RLS filtra toda operación con auth.uid() = user_id.';