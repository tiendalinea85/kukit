-- ============================================================
-- 00019 — RLS DE COMPRAS: reafirmar políticas de 00007
-- ============================================================
-- Síntoma: el push de `purchases` responde HTTP 403 / SQLSTATE 42501
-- ("new row violates row-level security policy for table \"purchases\"")
-- con una sesión válida, mientras `expenses` sí acepta el mismo INSERT
-- con el mismo usuario. El rol `authenticated` sí tiene GRANT sobre la
-- tabla (una consulta anónima llega a la comprobación de RLS en vez de
-- fallar con "permission denied"), así que lo que falla es la política
-- de INSERT: no está activa en esta base o su condición difiere de la del
-- repositorio.
--
-- Esta migración reaplica, de forma idempotente, las políticas canónicas
-- de 00007 sobre `purchases` y `purchase_details` y añade el GRANT
-- explícito que ya usan 00008 / 00015 / 00017, para que el esquema vivo
-- vuelva a coincidir con lo que declara este repositorio.
--
-- Verificación previa opcional (SQL editor de Supabase):
--   SELECT c.relname, p.polname, p.polcmd,
--          pg_get_expr(p.polqual, p.polrelid)      AS using_expr,
--          pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
--   FROM pg_policy p
--   JOIN pg_class c ON c.oid = p.polrelid
--   WHERE c.relname IN ('purchases', 'purchase_details')
--   ORDER BY c.relname, p.polname;
--
-- Idempotente: se puede ejecutar varias veces sobre la misma base
-- (ENABLE ROW LEVEL SECURITY + DROP POLICY IF EXISTS + CREATE POLICY).

-- 1. RLS activa (no-op si ya lo está)
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_details ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de public.purchases (mismas condiciones que 00007)
DROP POLICY IF EXISTS "Users can read own purchases" ON public.purchases;
CREATE POLICY "Users can read own purchases" ON public.purchases
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own purchases" ON public.purchases;
CREATE POLICY "Users can insert own purchases" ON public.purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own purchases" ON public.purchases;
CREATE POLICY "Users can update own purchases" ON public.purchases
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own purchases" ON public.purchases;
CREATE POLICY "Users can delete own purchases" ON public.purchases
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Políticas de public.purchase_details
DROP POLICY IF EXISTS "Users can read own purchase details" ON public.purchase_details;
CREATE POLICY "Users can read own purchase details" ON public.purchase_details
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own purchase details" ON public.purchase_details;
CREATE POLICY "Users can insert own purchase details" ON public.purchase_details
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own purchase details" ON public.purchase_details;
CREATE POLICY "Users can update own purchase details" ON public.purchase_details
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own purchase details" ON public.purchase_details;
CREATE POLICY "Users can delete own purchase details" ON public.purchase_details
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Permisos para el rol authenticated (PostgREST usa el JWT del usuario)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_details TO authenticated;
