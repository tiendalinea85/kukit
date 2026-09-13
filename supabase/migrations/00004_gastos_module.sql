-- ============================================================
-- 00004 — MÓDULO DE GASTOS
-- ============================================================
-- Un gasto es una salida de operación (NO inventario, NO partidas).
-- Normaliza estados, agrega soporte de anulación y prepara captura
-- futura de recibos. Conserva las columnas de detalle heredadas
-- (has_details / total_amount / items_count) y limpia la tabla
-- legacy expense_details si aún existiera en la base.

-- 1. Estado heredado: activo -> pagado, cancelado -> anulado
UPDATE public.expenses SET status = 'pagado' WHERE status = 'activo';
UPDATE public.expenses SET status = 'anulado' WHERE status = 'cancelado';

-- 2. Columnas heredadas del stage "detalle de gastos"
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS has_details BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS items_count INTEGER NOT NULL DEFAULT 0;

-- 3. Columnas para anulación + recibo/comprobante futuro
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 4. Reconstruir el CHECK de status con el ciclo de vida de GASTOS
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_status_check
  CHECK (status IN ('pagado', 'pendiente', 'anulado'));

-- 5. Legacy: la tabla expense_details ya no existe en el servidor.
--    (se conserva name como descripción de respaldo cuando falta desc).
UPDATE public.expenses SET description = COALESCE(NULLIF(description, ''), name)
  WHERE description IS NULL OR description = '';

ALTER TABLE public.expenses ALTER COLUMN description DROP NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN description SET DEFAULT '';
UPDATE public.expenses SET description = '' WHERE description IS NULL;

DROP TABLE IF EXISTS expense_details;
DROP TABLE IF EXISTS public.expense_details;

-- 6. Índices para los patrones de consulta de GASTOS
CREATE INDEX IF NOT EXISTS idx_expenses_voided_at ON public.expenses(voided_at);

-- 7. RLS: recrear políticas con USING + WITH CHECK (aislamiento por usuario)
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