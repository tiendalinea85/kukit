-- Per-user data isolation: an expense code must be unique per user, not globally.
-- This allows multiple users to each have their own G000001, G000002, etc.

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_user_code ON expenses(user_id, code);
