-- INVERSIONES module: fixed assets (activo fijo) of the business.
-- Kept separate from purchases, expenses and sales: an investment does NOT
-- generate inventory movements of commercial products.

-- 1. Investment categories (taxonomy of fixed assets)
CREATE TABLE IF NOT EXISTS investment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT '📦',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Investments
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value DECIMAL(12,2) NOT NULL CHECK (value > 0),
  category_id UUID REFERENCES investment_categories(id) ON DELETE SET NULL,
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

-- 3. Indexes for the query patterns (filter by date / category / status)
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_date ON investments(date);
CREATE INDEX IF NOT EXISTS idx_investments_category_id ON investments(category_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_deleted ON investments(deleted);
CREATE INDEX IF NOT EXISTS idx_investment_categories_user_id ON investment_categories(user_id);

-- 4. Row Level Security
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own investments"
  ON investments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own investments"
  ON investments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investments"
  ON investments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investments"
  ON investments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own investment categories"
  ON investment_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own investment categories"
  ON investment_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investment categories"
  ON investment_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investment categories"
  ON investment_categories FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Arquitectura futura: gestión de activos y depreciación (NO implementado).
-- Se añadirán columnas como:
--   useful_life_years INTEGER,         -- vida útil en años
--   depreciation_method TEXT,          -- lineal / doble_declinante / unidades
--   residual_value DECIMAL(12,2),      -- valor residual
--   acquisition_date DATE,             -- fecha de puesta en servicio
--   asset_status TEXT                  -- activo / depreciado / retirado / vendido
-- `value` se conserva como base depreciable.
