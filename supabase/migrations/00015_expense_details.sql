-- ============================================================
-- 00015 — DETALLES DE GASTO (expense_details)
-- ============================================================
-- Cada línea de un gasto guarda un snapshot del producto (code, name, color)
-- para conservar el historial si el producto se edita o elimina.
-- Patrón idéntico a sale_details / purchase_details.

-- 1. Tabla de detalles de gasto
CREATE TABLE IF NOT EXISTS public.expense_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  quantity DECIMAL(12,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision BIGINT NOT NULL DEFAULT 1,
  workspace_id UUID
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_expense_details_expense_id ON public.expense_details(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_details_product_id ON public.expense_details(product_id);
CREATE INDEX IF NOT EXISTS idx_expense_details_user_id ON public.expense_details(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_details_workspace_id ON public.expense_details(workspace_id);

-- 3. Trigger de revisión
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

-- 4. Row Level Security
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
