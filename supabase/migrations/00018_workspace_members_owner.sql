-- ============================================================
-- 00018 — WORKSPACE_MEMBERS: FK, trigger de propietario y backfill
-- ============================================================
-- Por qué esta migración existe: 00009 (workspace_members) nunca llegó a
-- aplicarse en esta base. 00010 intentó agregar la FK workspace_id →
-- workspaces.id pero la omitió con un NOTICE porque la tabla todavía no
-- existía (00010:99-107). El resultado es que `workspaces` sí tiene dueño
-- pero nadie está registrado como miembro, y sin fila en workspace_members
-- la API no puede validar pertenencia ni rol:
--   - apps/api/app/auth.py:72 → 403 "No eres miembro de este workspace"
--   - apps/api/app/roles.py:15 → get_workspace_role() devuelve None
--
-- Además arregla la causa de raíz, no solo el síntoma. Nadie insertaba la
-- membresía del propietario:
--   - la PWA crea el workspace insertando directo en `workspaces`
--     (src/lib/workspace-sync.ts:120) y nunca toca workspace_members;
--   - el RPC add_workspace_member de 00009 exige `has_workspace_role(...,
--     ARRAY['OWNER','ADMIN'])`, así que un propietario recién creado, sin
--     fila, no puede invocarlo: gallina y huevo.
-- El trigger AFTER INSERT resuelve ambos casos de una vez, venga el alta
-- de la PWA, de la API o de un seed futuro.
--
-- SECURITY DEFINER en el trigger: workspace_members solo tiene política
-- SELECT (las escrituras pasan por las funciones de gestión de 00009), así
-- que sin SECURITY DEFINER el trigger no podría insertar.
--
-- Idempotente: se puede ejecutar varias veces sobre la misma base.

-- ============================================================
-- 1. FK workspace_members.workspace_id → workspaces.id
-- ============================================================
-- 00010 la omitió porque la tabla no existía. Se crea ahora, pero solo si
-- workspace_members está presente (por si 00009 aún no se ha aplicado).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workspace_members'
  ) THEN
    RAISE NOTICE 'workspace_members no existe: omite la FK (aplica antes 00009)';
    RETURN;
  END IF;

  ALTER TABLE public.workspace_members
    ADD COLUMN IF NOT EXISTS workspace_id UUID;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_workspace_members_workspace'
      AND conrelid = 'public.workspace_members'::regclass
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT fk_workspace_members_workspace
      FOREIGN KEY (workspace_id)
      REFERENCES public.workspaces(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 2. Trigger: el dueño del workspace es OWNER de su workspace
-- ============================================================
-- Cubre los workspaces ya existentes (backfill, sección 3) y todos los
-- futuros, sin tocar el código de la PWA ni de la API.

CREATE OR REPLACE FUNCTION public.sync_workspace_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  -- user_id es nullable en workspaces: un workspace sin dueño no genera fila.
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'OWNER')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public;

-- El trigger se crea solo si existe la tabla destino: en una base donde
-- 00009 va después, el plpgsql se crearía igual pero fallaría en runtime.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workspace_members'
  ) THEN
    RAISE NOTICE 'workspace_members no existe: omite el trigger (aplica antes 00009)';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trg_workspace_owner_membership ON public.workspaces;
  CREATE TRIGGER trg_workspace_owner_membership
    AFTER INSERT ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_workspace_owner_membership();
END $$;

-- ============================================================
-- 3. Backfill de los workspaces que ya existen
-- ============================================================
-- INSERT ... SELECT ... ON CONFLICT: la migración se puede repetir sin
-- duplicar filas ni pisar un rol que alguien haya cambiado a mano.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workspace_members'
  ) THEN
    RAISE NOTICE 'workspace_members no existe: omite el backfill (aplica antes 00009)';
    RETURN;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT w.id, w.user_id, 'OWNER'
  FROM public.workspaces w
  WHERE w.user_id IS NOT NULL
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
END $$;

-- ============================================================
-- 4. Verificación (debe devolver 0 filas)
-- ============================================================
-- SELECT w.id FROM public.workspaces w
-- WHERE w.user_id IS NOT NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM public.workspace_members m
--     WHERE m.workspace_id = w.id AND m.user_id = w.user_id
--   );
