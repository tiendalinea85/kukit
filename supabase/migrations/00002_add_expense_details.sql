-- Add expense_details table and new columns to expenses

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS has_details BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS items_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS expense_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_details_expense_id ON expense_details(expense_id);

ALTER TABLE expense_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own expense details"
  ON expense_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM expenses WHERE expenses.id = expense_details.expense_id AND expenses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own expense details"
  ON expense_details FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses WHERE expenses.id = expense_details.expense_id AND expenses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own expense details"
  ON expense_details FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM expenses WHERE expenses.id = expense_details.expense_id AND expenses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own expense details"
  ON expense_details FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM expenses WHERE expenses.id = expense_details.expense_id AND expenses.user_id = auth.uid()
    )
  );
