-- ============================================================
-- 00020 — products.category_id (cierre de drift con el despliegue)
-- ============================================================
-- Contexto
--   La app permite asignar una categoría a un producto (ProductForm →
--   categoryId, productSchema). El modelo la guarda localmente y el pull la
--   conserva como campo local, pero `public.products` del proyecto desplegado
--   NO tiene `category_id`. Las sentencias que la definen (00006 §2b y 00008
--   §4) se añadieron DESPUÉS de que ese despliegue ya hubiera aplicado esas
--   migraciones, por lo que nunca se ejecutaron allí (drift por migración
--   editada: el historial aplicado no coincide con el archivo actual).
--
-- Decisión
--   NO se reescriben 00006/00008 (ya aplicadas en el despliegue). La corrección
--   es aditiva y reproducible mediante una migración versionada nueva, idéntica
--   en intención a las anteriores pero ejecutable de forma independiente.
--
-- Compatibilidad
--   - Aditiva: ADD COLUMN IF NOT EXISTS. No borra ni recrea tablas, no toca
--     datos ni RLS.
--   - Nullable y sin DEFAULT: los productos existentes quedan en NULL y el
--     código ya tolera ausencia (productToPayload omite la columna; el pull la
--     conserva como campo local).
--   - FK `category_id → public.categories(id) ON DELETE SET NULL`, creada solo
--     si no existe.
--   - Índice `idx_products_category_id` si no existe.
--
-- Dependencia: `public.categories` (00001). Si `products` no existe, se omite.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    RAISE NOTICE '00020: public.products no existe, se omite';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID';

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'products'
      AND c.contype = 'f'
      AND c.conname = 'products_category_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL';
  END IF;

  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id)';
END $$;

-- Recarga del schema cache de PostgREST para que category_id esté disponible
-- de inmediato tras aplicar la migración.
NOTIFY pgrst, 'reload schema';
