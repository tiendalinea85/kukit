-- RLS HARDENING (auditoría de seguridad)
--
-- Contexto del hallazgo F4: `00001_init.sql` crea políticas que referencian la
-- columna `user_id` (líneas 51-99) ANTES de que la columna exista (líneas
-- 102-104). Si esa migración se aplicó tal cual, falló a mitad de camino y las
-- políticas NO existen en producción (con la `anon key` pública, cualquiera
-- puede leer/escribir los datos de todos los usuarios).
--
-- Esta migración es IDEMPOTENTE y autocura esa situación:
--   1. Asegura que `user_id` exista en TODAS las tablas de negocio vigentes.
--      NOTA: `expense_details` se excluye porque `00004` la eliminó (los
--      gastos ya no tienen líneas).
--   2. Asegura RLS habilitado en todas.
--   3. Recrea las políticas con `WITH CHECK` también en UPDATE (antes solo
--      tenían `USING`), evitando que un usuario reasigne filas a otro
--      (`user_id` era editable).
--   4. `sales` recupera el índice único por (user_id, code) que le faltaba
--      (las demás cabeceras ya lo tienen).
--
-- IMPACTO AL APLICAR (leer antes):
--   - Si hay filas existentes en una tabla a la que se le agrega `user_id`
--     ahora, quedarán con `user_id = NULL` e INVISIBLES por RLS hasta que se
--     asigne su propietario. Ejecutar el backfill comentado al final para
--     asignarlas al primer usuario (o eliminar las filas huérfanas).
--   - El índice único de `sales(user_id, code)` fallará si ya existen ventas
--     duplicadas con el mismo código para el mismo usuario. Deduplicar antes.

-- ============================================================
-- 1. Asegurar columna user_id en todas las tablas de negocio
-- ============================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories', 'types', 'expenses',
    'investment_categories', 'investments',
    'customers', 'products',
    'sales', 'sale_details',
    'purchases', 'purchase_details',
    'inventory_movements'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE',
      t);
  END LOOP;
END $$;

-- ============================================================
-- 2. RLS habilitado en todas las tablas
-- ============================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories', 'types', 'expenses',
    'investment_categories', 'investments',
    'customers', 'products',
    'sales', 'sale_details',
    'purchases', 'purchase_details',
    'inventory_movements', 'sync_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ============================================================
-- 3. Políticas con WITH CHECK en UPDATE (DROP + CREATE idempotente)
-- ============================================================

DO $$
DECLARE
  t TEXT;
  name TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories', 'types', 'expenses',
    'investment_categories', 'investments',
    'customers', 'products',
    'sales', 'sale_details',
    'purchases', 'purchase_details'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can read own %I" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %I" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update own %I" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %I" ON %I', t, t);

    EXECUTE format('CREATE POLICY "Users can read own %I" ON %I FOR SELECT USING (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Users can insert own %I" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Users can update own %I" ON %I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Users can delete own %I" ON %I FOR DELETE USING (auth.uid() = user_id)', t, t);
  END LOOP;
END $$;

-- inventory_movements es APPEND-ONLY (trigger en 00007): solo SELECT + INSERT.
DO $$
DECLARE
  t TEXT := 'inventory_movements';
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS "Users can read own %I" ON %I', t, t);
  EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %I" ON %I', t, t);
  EXECUTE format('DROP POLICY IF EXISTS "Users can update own %I" ON %I', t, t);
  EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %I" ON %I', t, t);

  -- 00006 nombró las políticas con espacios; se derriban ambas variantes
  -- para no dejar políticas duplicadas al re-ejecutar.
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own inventory movements" ON inventory_movements';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own inventory movements" ON inventory_movements';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own inventory movements" ON inventory_movements';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own inventory movements" ON inventory_movements';

  EXECUTE format('CREATE POLICY "Users can read own %I" ON %I FOR SELECT USING (auth.uid() = user_id)', t, t);
  EXECUTE format('CREATE POLICY "Users can insert own %I" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)', t, t);
END $$;

-- ============================================================
-- 4. Índices para rendimiento de RLS
-- ============================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories', 'types', 'expenses',
    'investment_categories', 'investments',
    'customers', 'products',
    'sales', 'sale_details',
    'purchases', 'purchase_details',
    'inventory_movements'
  ] LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_user_id ON %I(user_id)', t, t);
  END LOOP;
END $$;

-- sales carece del índice único por usuario+código (el resto de cabeceras lo tiene)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_user_code ON sales(user_id, code);

-- ============================================================
-- 5. BACKFILL DE FILAS HUÉRFANAS (EJECUTAR MANUALMENTE SI APLICA)
--    Asigna las filas sin propietario al primer usuario autenticado.
-- ============================================================

-- DO $$
-- DECLARE
--   owner_uuid UUID;
--   t TEXT;
-- BEGIN
--   SELECT id INTO owner_uuid FROM auth.users ORDER BY created_at LIMIT 1;
--   IF owner_uuid IS NULL THEN RETURN; END IF;
--   FOREACH t IN ARRAY ARRAY[
--     'categories', 'types', 'expenses',
--     'investment_categories', 'investments',
--     'customers', 'products',
--     'sales', 'sale_details',
--     'purchases', 'purchase_details',
--     'inventory_movements'
--   ] LOOP
--     EXECUTE format('UPDATE %I SET user_id = $1 WHERE user_id IS NULL', t) USING owner_uuid;
--   END LOOP;
-- END $$;
