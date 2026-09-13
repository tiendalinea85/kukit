-- ============================================================
-- 00007 — COMPRAS: public.purchases + public.purchase_details
-- ============================================================
-- Migración dedicada a COMPRAS, ejecutada DESPUÉS de products
-- (00006) y ANTES de revisiones/triggers (00008) y multi-workspace
-- (00010). Es la corrección de la dependencia que producía:
--
--   ERROR: 42P01 relation "purchases" does not exist
--   ALTER TABLE purchases ADD COLUMN IF NOT EXISTS revision ...
--
-- Regla de la casa: NUNCA hacer ALTER TABLE sobre una tabla que no
-- está garantizada en una etapa anterior.

-- ============================================================
-- 1. public.purchases
-- ============================================================

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  supplier TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'efectivo'
    CHECK (payment_method IN ('efectivo', 'tarjeta_credito', 'tarjeta_debito', 'yape', 'plin', 'transferencia', 'otro')),
  total DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'recibida', 'anulada')),
  received_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision BIGINT NOT NULL DEFAULT 1
);

-- ============================================================
-- 2. public.purchase_details (después de purchases)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.purchase_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  quantity DECIMAL(12,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision BIGINT NOT NULL DEFAULT 1
);

-- ============================================================
-- 3. Índices
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_user_code ON public.purchases(user_id, code);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON public.purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_deleted ON public.purchases(deleted);
CREATE INDEX IF NOT EXISTS idx_purchase_details_purchase_id ON public.purchase_details(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_details_product_id ON public.purchase_details(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_details_user_id ON public.purchase_details(user_id);

-- ============================================================
-- 4. Row Level Security (aislamiento por usuario)
-- ============================================================

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own purchases" ON public.purchases;
CREATE POLICY "Users can read own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.purchases;
CREATE POLICY "Users can insert own purchases" ON public.purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own purchases" ON public.purchases;
CREATE POLICY "Users can update own purchases" ON public.purchases FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own purchases" ON public.purchases;
CREATE POLICY "Users can delete own purchases" ON public.purchases FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own purchase details" ON public.purchase_details;
CREATE POLICY "Users can read own purchase details" ON public.purchase_details FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own purchase details" ON public.purchase_details;
CREATE POLICY "Users can insert own purchase details" ON public.purchase_details FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own purchase details" ON public.purchase_details;
CREATE POLICY "Users can update own purchase details" ON public.purchase_details FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own purchase details" ON public.purchase_details;
CREATE POLICY "Users can delete own purchase details" ON public.purchase_details FOR DELETE USING (auth.uid() = user_id);