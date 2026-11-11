-- ============================================================
-- 00022 — SOFT DELETE EN production_materials
-- ============================================================
-- production_materials (00013) se creó como detalle append-only del taller de
-- confección: al editar una orden sus líneas se borraban físicamente, lo que
-- rompe el invariante 2 (soft delete) y hace resucitar las filas en otros
-- dispositivos. Se alinea con el patrón de los demás detalles (00015/00021):
--   - deleted     → tombstone para el soft delete Offline-First
--   - updated_at  → orden de pull incremental y LWW (el trigger lo mantiene)
--   - revision    → guardado condicional por revisión del Sync Engine
--
-- La entidad pasa a modo "guarded" en el cliente (antes "append"): admite
-- UPDATE (soft delete) y su tombstone viaja a Supabase.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
-- DROP TRIGGER IF EXISTS. Reutiliza public.bump_revision() de 00008.

-- 1. Columnas de soft delete / revisión
ALTER TABLE public.production_materials ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.production_materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.production_materials ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;

-- 2. Índices para los patrones de consulta / pull incremental
CREATE INDEX IF NOT EXISTS idx_production_materials_user_updated
  ON public.production_materials(user_id, updated_at);

-- 3. Trigger de revisión: mantiene revision y updated_at en cada UPDATE (LWW).
--    Se reutiliza la función única del esquema (00008).
DROP TRIGGER IF EXISTS trg_bump_revision ON public.production_materials;
CREATE TRIGGER trg_bump_revision
  BEFORE UPDATE ON public.production_materials
  FOR EACH ROW EXECUTE FUNCTION public.bump_revision();

-- 4. Permisos explícitos para el rol authenticated (PostgREST usa el JWT).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_materials TO authenticated;
