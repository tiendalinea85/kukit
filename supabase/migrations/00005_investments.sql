-- ============================================================
-- 00005 — INVERSIONES (activos fijos del negocio)
-- ============================================================
-- Separadas de compras, gastos y ventas: una inversión NO genera
-- movimientos de inventario de productos comerciales.

-- 1. Categorías de inversión (taxonomía de activos fijos)
CREATE TABLE IF NOT EXISTS public.investment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT '📦',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Inversiones
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value DECIMAL(12,2) NOT NULL CHECK (value > 0),
  category_id UUID REFERENCES public.investment_categories(id) ON DELETE SET NULL,
  supplier TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'efectivo'
    CHECK (payment_method IN ('efectivo', 'tarjeta_credito', 'tarjeta_debito', 'yape', 'plin', 'transferencia', 'otro')),
  status TEXT NOT NULL DEFAULT 'pagado' CHECK (status IN ('pagado', 'pendiente', 'anulado')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  deleted BOOLEAN NOT NULL DEFAULT false,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_date ON public.investments(date);
CREATE INDEX IF NOT EXISTS idx_investments_category_id ON public.investments(category_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON public.investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_deleted ON public.investments(deleted);
CREATE INDEX IF NOT EXISTS idx_investment_categories_user_id ON public.investment_categories(user_id);

-- 4. Row Level Security
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own investments" ON public.investments;
CREATE POLICY "Users can read own investments"
  ON public.investments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own investments" ON public.investments;
CREATE POLICY "Users can insert own investments"
  ON public.investments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own investments" ON public.investments;
CREATE POLICY "Users can update own investments"
  ON public.investments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own investments" ON public.investments;
CREATE POLICY "Users can delete own investments"
  ON public.investments FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own investment categories" ON public.investment_categories;
CREATE POLICY "Users can read own investment categories"
  ON public.investment_categories FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own investment categories" ON public.investment_categories;
CREATE POLICY "Users can insert own investment categories"
  ON public.investment_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own investment categories" ON public.investment_categories;
CREATE POLICY "Users can update own investment categories"
  ON public.investment_categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own investment categories" ON public.investment_categories;
CREATE POLICY "Users can delete own investment categories"
  ON public.investment_categories FOR DELETE
  USING (auth.uid() = user_id);