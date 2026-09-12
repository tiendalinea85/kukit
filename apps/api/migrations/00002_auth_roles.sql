-- ============================================================
-- 00002 — AUTH, ROLES Y AUDITORÍA (espejo para la API)
-- ============================================================
-- La app móvil autentica contra Supabase; la API valida el JWT y consulta
-- estas tablas para roles/permisos y auditoría. La API se conecta como
-- propietario de la base (sin RLS): la seguridad por rol se aplica en el
-- código (dependencias de FastAPI) y en Supabase vía RLS.
--
-- Los ids coinciden con Supabase auth.users (UUID).

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'USER'
    CHECK (role IN ('OWNER', 'ADMIN', 'USER', 'READ_ONLY')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user ON audit_events(user_id, created_at DESC);
