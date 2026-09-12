-- Expenses: prepare for receipt/OCR capture + void lifecycle support.
-- Mirrors mobile V4 schema (voided_at, receipt_url, receipt_thumb_url).

-- Void support: timestamp when an expense was voided (anulada).
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

-- Future receipt/invoice photography + OCR.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_thumb_url TEXT;

-- Indexes for the GASTOS query patterns (void filter + search by code).
CREATE INDEX IF NOT EXISTS idx_expenses_voided_at ON expenses(voided_at);
CREATE INDEX IF NOT EXISTS idx_expenses_code ON expenses(code);

-- Ensure workspace indexes exist for the list/search queries.
CREATE INDEX IF NOT EXISTS idx_expenses_workspace_date
  ON expenses(workspace_id, date DESC);
