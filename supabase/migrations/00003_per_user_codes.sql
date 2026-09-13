-- ============================================================
-- 00003 — CÓDIGOS ÚNICOS POR USUARIO
-- ============================================================
-- Aislamiento de datos por usuario: el código de un gasto debe ser
-- único POR USUARIO y no global. Así cada usuario puede tener su
-- propio G000001, G000002, etc.

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_user_code ON public.expenses(user_id, code);