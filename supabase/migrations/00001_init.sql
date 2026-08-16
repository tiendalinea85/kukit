-- Create tables for Zane expense tracker

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  icon TEXT NOT NULL DEFAULT '📦',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount DECIMAL(12,2) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  type_id UUID REFERENCES types(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'pagado', 'pendiente', 'cancelado')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  notes TEXT DEFAULT '',
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_expenses_code ON expenses(code);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_type_id ON expenses(type_id);
CREATE INDEX idx_expenses_deleted ON expenses(deleted);
CREATE INDEX idx_expenses_status ON expenses(status);

-- Add user_id column BEFORE policies (las políticas la referencian)
ALTER TABLE expenses ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE types ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Row Level Security
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE types ENABLE ROW LEVEL SECURITY;

-- Policies (authenticated users can CRUD their own data)
CREATE POLICY "Users can read own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Repeat for categories
CREATE POLICY "Users can read own categories"
  ON categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

-- Repeat for types
CREATE POLICY "Users can read own types"
  ON types FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own types"
  ON types FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own types"
  ON types FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own types"
  ON types FOR DELETE
  USING (auth.uid() = user_id);
