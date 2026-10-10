-- ============================================================
-- 00021 — SOFT DELETE EN DETALLES DE VENTA/COMPRA
-- ============================================================
-- sale_details (00006) y purchase_details (00007) se crearon ANTES de que el
-- patrón Offline-First quedara fijado en 00015 (expense_details). Les faltaban:
--   - deleted BOOLEAN  → tombstone para el soft delete (invariante 2)
--   - workspace_id     → aislamiento por organización (invariante 1)
--   - updated_at       → el trigger de revisión de 00008 escribe NEW.updated_at
--                        y sin la columna cualquier UPDATE falla (error plpgsql
--                        "record new has no field updated_at")
--
-- Reemplazar los detalles de una venta/compra editada ya no hace DELETE físico
-- local: marca deleted=true. Para que ese tombstone viaje a Supabase y no
-- resucite en el pull, las columnas deben existir aquí.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
-- DROP TRIGGER IF EXISTS. Se puede ejecutar varias veces.

-- ============================================================
-- 1. sale_details
-- ============================================================

ALTER TABLE public.sale_details ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.sale_details ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.sale_details ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_sale_details_workspace_id ON public.sale_details(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sale_details_user_created ON public.sale_details(user_id, created_at);

-- ============================================================
-- 2. purchase_details
-- ============================================================

ALTER TABLE public.purchase_details ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.purchase_details ADD COLUMN IF NOT EXISTS workspace_id UUID;

CREATE INDEX IF NOT EXISTS idx_purchase_details_workspace_id ON public.purchase_details(workspace_id);
CREATE INDEX IF NOT EXISTS idx_purchase_details_user_created ON public.purchase_details(user_id, created_at);

-- ============================================================
-- 3. Trigger de revisión en sale_details
-- ============================================================
-- 00008 ya creó trg_bump_revision sobre sale_details, cuya función
-- bump_revision() escribe NEW.updated_at. Con la columna añadida arriba vuelve
-- a funcionar. No se re-declara el trigger para no duplicarlo.

-- ============================================================
-- 4. Backfill de workspace_id desde la cabecera
-- ============================================================
-- Las filas existentes quedan con workspace_id NULL; se rellenan desde su
-- venta/compra para no quedar fuera del aislamiento por workspace.

UPDATE public.sale_details d
SET workspace_id = s.workspace_id
FROM public.sales s
WHERE d.sale_id = s.id
  AND d.workspace_id IS NULL;

UPDATE public.purchase_details d
SET workspace_id = p.workspace_id
FROM public.purchases p
WHERE d.purchase_id = p.id
  AND d.workspace_id IS NULL;
