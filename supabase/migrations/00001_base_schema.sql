-- ============================================================
-- 00001 — ESTRUCTURA BASE (esquema public)
-- ============================================================
-- Categorías, tipos y gastos (expenses) con user_id (Supabase Auth)
-- y RLS por usuario. Es idempotente: se puede ejecutar sobre una
-- base que ya contenga estas tablas sin borrar datos.

-- ============================================================
-- 1. TABLAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  icon TEXT NOT NULL DEFAULT '📦',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount DECIMAL(12,2) NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  type_id UUID REFERENCES public.types(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'pagado', 'pendiente', 'cancelado')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  notes TEXT DEFAULT '',
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_expenses_code ON public.expenses(code);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_type_id ON public.expenses(type_id);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON public.expenses(deleted);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);

-- ============================================================
-- 2. user_id (SIEMPRE ANTES de las políticas: las referencian)
-- ============================================================

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.types ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.types ENABLE ROW LEVEL SECURITY;

-- Políticas: el usuario autenticado solo accede a SUS filas.
-- UPDATE con USING + WITH CHECK para impedir reasignar user_id.

DROP POLICY IF EXISTS "Users can read own expenses" ON public.expenses;
CREATE POLICY "Users can read own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
CREATE POLICY "Users can insert own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;
CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own categories" ON public.categories;
CREATE POLICY "Users can read own categories"
  ON public.categories FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can delete own categories"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own types" ON public.types;
CREATE POLICY "Users can read own types"
  ON public.types FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own types" ON public.types;
CREATE POLICY "Users can insert own types"
  ON public.types FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own types" ON public.types;
CREATE POLICY "Users can update own types"
  ON public.types FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own types" ON public.types;
CREATE POLICY "Users can delete own types"
  ON public.types FOR DELETE
  USING (auth.uid() = user_id);