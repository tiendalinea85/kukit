-- ============================================================
-- 00017 — ICONOS PROPIOS (custom_icons)
-- ============================================================
-- Set de iconos reutilizables del workspace: el usuario sube una imagen o
-- importa un set y puede aplicarlo a varias categorías.
--
-- `categories.icon` guarda el valor final (un emoji del catálogo o un data URL
-- PNG) para que las pantallas no tengan que resolver ids. Esta tabla solo
-- guarda el set desde el que se elige, así que una categoría puede apuntar a
-- un icono propio sin que exista ninguna FK.
--
-- Patrón idéntico a expense_details (00015):
--   - user_id NOT NULL (RLS + pull filtran por auth.uid() = user_id)
--   - deleted BOOLEAN (soft delete / tombstone para borrado Offline-First)
--   - revision + updated_at mantenidos por trigger (conflictos LWW)
--   - workspace_id uuid (filtro de organización; misma convención que 00010)
--   - GRANT explícito a authenticated
--
-- Idempotente: se puede ejecutar varias veces sobre la misma base
-- (CREATE IF NOT EXISTS + ALTER IF NOT EXISTS + DROP POLICY IF EXISTS).

-- 1. Tabla de iconos propios
CREATE TABLE IF NOT EXISTS public.custom_icons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- PNG de 128px codificado en base64 (3-8 KB por icono).
  data_url TEXT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT false,
  workspace_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision BIGINT NOT NULL DEFAULT 1
);

-- 1b. Defensa para bases donde ya exista una versión previa de la tabla
--     (una ejecución parcial de un 00017 anterior): alinear columnas.
ALTER TABLE public.custom_icons ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.custom_icons ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.custom_icons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.custom_icons ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;

-- 2. Índices para los patrones de consulta
--    El pull incremental ordena por updated_at: ese índice es el que sostiene
--    la marca de agua.
CREATE INDEX IF NOT EXISTS idx_custom_icons_user_id ON public.custom_icons(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_icons_workspace_id ON public.custom_icons(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_icons_user_updated ON public.custom_icons(user_id, updated_at);

-- 3. Trigger de revisión: incrementa revision y mantiene updated_at (LWW).
CREATE OR REPLACE FUNCTION public.set_custom_icons_revision()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.revision = COALESCE(OLD.revision, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_custom_icons_revision ON public.custom_icons;
CREATE TRIGGER trg_custom_icons_revision
  BEFORE UPDATE ON public.custom_icons
  FOR EACH ROW
  EXECUTE FUNCTION public.set_custom_icons_revision();

-- 4. Row Level Security (aislamiento por usuario: auth.uid() = user_id)
ALTER TABLE public.custom_icons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own custom icons" ON public.custom_icons;
CREATE POLICY "Users can read own custom icons" ON public.custom_icons
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own custom icons" ON public.custom_icons;
CREATE POLICY "Users can insert own custom icons" ON public.custom_icons
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own custom icons" ON public.custom_icons;
CREATE POLICY "Users can update own custom icons" ON public.custom_icons
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own custom icons" ON public.custom_icons;
CREATE POLICY "Users can delete own custom icons" ON public.custom_icons
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Permisos para el rol authenticated (PostgREST usa el JWT del usuario)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_icons TO authenticated;