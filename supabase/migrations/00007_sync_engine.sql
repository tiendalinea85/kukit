-- SYNC ENGINE: soporte para sincronización Offline First.
--
--  1. `revision` en todas las entidades + trigger que la incrementa y actualiza
--     `updated_at` → detección de escrituras perdidas / conflictos (LWW).
--  2. `inventory_movements` pasa a ser APPEND-ONLY: trigger que rechaza UPDATE
--     y DELETE. Los movimientos son operaciones registradas, nunca se sobrescriben.
--  3. Tablas faltantes de COMPRAS (`purchases`, `purchase_details`) con RLS.
--  4. `category_id` en products (reportes por categoría).
--  5. Relaja CHECK de `inventory_movements` para `ajuste` (cantidad firmada) y
--     referencias de compra.
--  6. `sync_log`: registro de eventos de sincronización (auditoría).

-- ============================================================
-- 1. Revisión optimista (detección de conflictos)
-- ============================================================

CREATE OR REPLACE FUNCTION bump_revision()
RETURNS TRIGGER AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_bump_revision ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_bump_revision BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION bump_revision()', t);
  END LOOP;
END $$;

-- Movimientos de inventario: append-only, no llevan revisión (nunca se actualizan).
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;

-- ============================================================
-- 2. inventory_movements APPEND-ONLY
-- ============================================================

CREATE OR REPLACE FUNCTION guard_append_only_inventory()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements is append-only: updates and deletes are not allowed (id %)', OLD.id
    USING ERRCODE = '23601';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_append_only ON inventory_movements;
CREATE TRIGGER trg_inventory_append_only
BEFORE UPDATE OR DELETE ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION guard_append_only_inventory();

-- Relaja CHECK para soportar ajustes (cantidad firmada) y referencias de compra.
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check
  CHECK (type IN ('entrada', 'salida', 'ajuste'));

ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_quantity_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_quantity_check
  CHECK (quantity <> 0);

ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_reference_type_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_reference_type_check
  CHECK (reference_type IN
    ('inventario_inicial', 'compra', 'anulacion_compra', 'venta', 'anulacion_venta', 'ajuste'));

-- ============================================================
-- 3. COMPRAS (faltaban en migraciones)
-- ============================================================

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  supplier TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'efectivo'
    CHECK (payment_method IN ('efectivo', 'tarjeta_credito', 'tarjeta_debito', 'yape', 'plin', 'transferencia', 'otro')),
  total DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'recibida', 'anulada')),
  received_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS purchase_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  quantity DECIMAL(12,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_user_code ON purchases(user_id, code);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_deleted ON purchases(deleted);
CREATE INDEX IF NOT EXISTS idx_purchase_details_purchase_id ON purchase_details(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_details_product_id ON purchase_details(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_details_user_id ON purchase_details(user_id);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own purchases" ON purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own purchases" ON purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own purchases" ON purchases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own purchases" ON purchases FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own purchase details" ON purchase_details FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own purchase details" ON purchase_details FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own purchase details" ON purchase_details FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own purchase details" ON purchase_details FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 4. category_id en products (reportes por categoría)
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- ============================================================
-- 5. sync_log: registro de eventos de sincronización
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_log (
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

CREATE INDEX IF NOT EXISTS idx_sync_log_user_ts ON sync_log(user_id, ts DESC);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sync log" ON sync_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sync log" ON sync_log FOR INSERT WITH CHECK (auth.uid() = user_id);
