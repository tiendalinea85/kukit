-- ============================================================
-- 00015 — DETALLES DE GASTO (expense_details)
-- ============================================================
-- Cada línea de un gasto guarda un snapshot del producto (code, name, color)
-- para conservar el historial si el producto se edita o elimina.
-- Patrón idéntico a sale_details / purchase_details (00006 / 00007):
--   - user_id NOT NULL (RLS + pull filtran por auth.uid() = user_id)
--   - deleted BOOLEAN (soft delete / tombstone para borrado Offline-First)
--   - revision + updated_at mantenidos por trigger (conflictos LWW)
--   - workspace_id uuid (filtro de organización; misma convención que 00010)
--   - GRANT explícito a authenticated (mismo patrón que sync_log / workspaces)
--
-- Idempotente: se puede ejecutar varias veces sobre la misma base
-- (CREATE IF NOT EXISTS + ALTER IF NOT EXISTS + DROP POLICY IF EXISTS).

-- 1. Tabla de detalles de gasto
CREATE TABLE IF NOT EXISTS public.expense_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  quantity DECIMAL(12,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  deleted BOOLEAN NOT NULL DEFAULT false,
  workspace_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision BIGINT NOT NULL DEFAULT 1
);

-- 1b. Defensa para bases donde ya exista una versión previa de la tabla
--     (una ejecución parcial de un 00015 anterior): alinear columnas.
ALTER TABLE public.expense_details ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.expense_details ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.expense_details ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.expense_details ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;

-- user_id NOT NULL solo si no hay filas sin dueño (evita fallo si existe data).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.expense_details WHERE user_id IS NULL) THEN
    ALTER TABLE public.expense_details ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- 2. Índices para los patrones de consulta
--    idx_expense_details_user_created soporta el pull incremental:
--    SELECT * WHERE user_id=? ORDER BY created_at ASC LIMIT 500 (watermark).
CREATE INDEX IF NOT EXISTS idx_expense_details_expense_id ON public.expense_details(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_details_product_id ON public.expense_details(product_id);
CREATE INDEX IF NOT EXISTS idx_expense_details_user_id ON public.expense_details(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_details_workspace_id ON public.expense_details(workspace_id);
CREATE INDEX IF NOT EXISTS idx_expense_details_user_created ON public.expense_details(user_id, created_at);

-- 3. Trigger de revisión: incrementa revision y mantiene updated_at (LWW).
CREATE OR REPLACE FUNCTION public.set_expense_details_revision()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.revision = COALESCE(OLD.revision, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expense_details_revision ON public.expense_details;
CREATE TRIGGER trg_expense_details_revision
  BEFORE UPDATE ON public.expense_details
  FOR EACH ROW
  EXECUTE FUNCTION public.set_expense_details_revision();

-- 4. Row Level Security (aislamiento por usuario: auth.uid() = user_id)
ALTER TABLE public.expense_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own expense details" ON public.expense_details;
CREATE POLICY "Users can read own expense details" ON public.expense_details
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own expense details" ON public.expense_details;
CREATE POLICY "Users can insert own expense details" ON public.expense_details
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own expense details" ON public.expense_details;
CREATE POLICY "Users can update own expense details" ON public.expense_details
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own expense details" ON public.expense_details;
CREATE POLICY "Users can delete own expense details" ON public.expense_details
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Permisos para el rol authenticated (PostgREST usa el JWT del usuario)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_details TO authenticated;