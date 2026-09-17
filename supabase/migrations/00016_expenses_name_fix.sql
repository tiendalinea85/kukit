-- ============================================================
-- 00016 — EXPENSES: name opcional (fix de sincronización)
-- ============================================================
-- La tabla `expenses` (00001) definió `name TEXT NOT NULL` sin default.
-- El push offline-first NO envía `name` (la descripción es el texto real:
-- 00004 usa name solo como respaldo). Todo INSERT del Sync Engine fallaba
-- con "null value in column name violates not-null constraint" y la tabla
-- quedaba vacía. Aquí name pasa a tener default '' y a ser nullable.
--
-- Idempotente: seguro de re-ejecutar.

ALTER TABLE public.expenses ALTER COLUMN name SET DEFAULT '';
ALTER TABLE public.expenses ALTER COLUMN name DROP NOT NULL;

-- Índice para el pull incremental (WHERE user_id=? ORDER BY updated_at).
CREATE INDEX IF NOT EXISTS idx_expenses_user_updated
  ON public.expenses(user_id, updated_at);