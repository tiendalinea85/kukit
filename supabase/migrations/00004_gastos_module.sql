-- GASTOS module: expense is an operating outflow (no inventory, no line items)
-- Normalize status values, add void support, prepare future invoice capture.

-- 1. Status lifecycle: activo -> pagado, cancelado -> anulado
UPDATE expenses SET status = 'pagado' WHERE status = 'activo';
UPDATE expenses SET status = 'anulado' WHERE status = 'cancelado';

-- 2. New columns for void + future receipt/invoice capture
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 3. Rebuild the status check constraint with the GASTOS lifecycle
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_status_check
  CHECK (status IN ('pagado', 'pendiente', 'anulado'));

-- 4. Legacy purchase columns become nullable, then dropped once data is safe.
--    Keep name as a fallback description when description is empty.
UPDATE expenses SET description = COALESCE(NULLIF(description, ''), name)
  WHERE description IS NULL OR description = '';

ALTER TABLE expenses ALTER COLUMN description DROP NOT NULL;
ALTER TABLE expenses ALTER COLUMN description SET DEFAULT '';
UPDATE expenses SET description = '' WHERE description IS NULL;

-- 5. Remove purchase semantics (no inventory, no line items).
DROP TABLE IF EXISTS expense_details;

-- 6. Indexes for the GASTOS query patterns (filter by date / category / status)
CREATE INDEX IF NOT EXISTS idx_expenses_voided_at ON expenses(voided_at);

-- 7. RLS: ensure policies match the schema (user-scoped access)
DROP POLICY IF EXISTS "Users can read own expenses" ON expenses;
CREATE POLICY "Users can read own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;
CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  USING (auth.uid() = user_id);
