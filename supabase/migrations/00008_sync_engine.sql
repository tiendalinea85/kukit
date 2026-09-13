-- ============================================================
-- 00008 — MOTOR DE SINCRONIZACIÓN (Offline First)
-- ============================================================
--  1. `revision` en todas las entidades + trigger que la incrementa
--     y actualiza `updated_at` → detección de escrituras perdidas (LWW).
--  2. inventory_movements pasa a APPEND-ONLY (rechaza UPDATE/DELETE).
--  3. products.category_id (compatibilidad con bases pre-00006).
--  4. sync_log: auditoría de eventos de sincronización.
--
-- REGLA: se comprueba que cada tabla EXISTA antes de modificarla.
-- purchases y purchase_details ya fueron creadas en 00007, por lo
-- que aquí se les agrega `revision` + trigger sin error 42P01.

-- ============================================================
-- 1. Función de revisión optimista (única para todo el esquema)
-- ============================================================

CREATE OR REPLACE FUNCTION public.bump_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. revision + trigger trg_bump_revision SOLO en tablas existentes
-- ============================================================
-- Para cada tabla: comprobar existencia → ADD COLUMN si falta →
-- DROP del trigger anterior (mismo nombre) → CREATE. NO elimina
-- otros triggers ni tablas.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories', 'types', 'expenses',
    'investment_categories', 'investments',
    'customers', 'products',
    'sales', 'sale_details',
    'purchases', 'purchase_details'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1', t);

      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_bump_revision ON public.%I', t);

      EXECUTE format(
        'CREATE TRIGGER trg_bump_revision BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.bump_revision()', t);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 3. inventory_movements: append-only + revisión (sin bump)
-- ============================================================

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_movements'
  ) THEN
    EXECUTE 'ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1';

    CREATE OR REPLACE FUNCTION public.guard_append_only_inventory()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'inventory_movements is append-only: updates and deletes are not allowed (id %)', OLD.id
        USING ERRCODE = '23601';
    END;
    $$ LANGUAGE plpgsql;

    EXECUTE 'DROP TRIGGER IF EXISTS trg_inventory_append_only ON public.inventory_movements';
    EXECUTE 'CREATE TRIGGER trg_inventory_append_only
      BEFORE UPDATE OR DELETE ON public.inventory_movements
      FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_inventory()';

    -- Relaja CHECK para soportar ajustes (cantidad firmada) y referencias de compra.
    EXECUTE 'ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check';
    EXECUTE 'ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_type_check
      CHECK (type IN (''entrada'', ''salida'', ''ajuste''))';

    EXECUTE 'ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_quantity_check';
    EXECUTE 'ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_quantity_check
      CHECK (quantity <> 0)';

    EXECUTE 'ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_reference_type_check';
    EXECUTE 'ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_reference_type_check
      CHECK (reference_type IN
        (''inventario_inicial'', ''compra'', ''anulacion_compra'', ''venta'', ''anulacion_venta'', ''ajuste''))';
  END IF;
END $do$;

-- ============================================================
-- 4. products.category_id (compatibilidad con bases pre-00006)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    EXECUTE 'ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id)';
  END IF;
END $$;

-- ============================================================
-- 5. sync_log: registro de eventos de sincronización
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  event TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  message TEXT,
  error_type TEXT,
  attempts INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sync_log_user_ts ON public.sync_log(user_id, ts DESC);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own sync log" ON public.sync_log;
CREATE POLICY "Users can read own sync log" ON public.sync_log FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own sync log" ON public.sync_log;
CREATE POLICY "Users can insert own sync log" ON public.sync_log FOR INSERT WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.sync_log TO authenticated;