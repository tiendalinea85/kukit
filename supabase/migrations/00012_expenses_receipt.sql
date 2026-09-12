-- Expenses: prepare for future receipt/invoice photography + OCR.
-- Mirrors mobile V4 schema additions.

-- Future receipt/invoice photography + OCR (thumb variant added).
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_thumb_url TEXT;

-- Indexes for the GASTOS query patterns (void filter + search by code).
CREATE INDEX IF NOT EXISTS idx_expenses_code ON expenses(code);
CREATE INDEX IF NOT EXISTS idx_expenses_workspace_date
  ON expenses(workspace_id, date DESC);
