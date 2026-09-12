-- ============================================================
-- 00003 — MULTI-WORKSPACE: workspaces, workspace_modules,
--          workspace_id en tablas de negocio (API mirror).
-- ============================================================
-- La API se conecta como propietario de la DB (sin RLS).
-- workspace_id se inyecta en cada INSERT desde el sync_service.

-- 1. workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('PERSONAL','TRABAJO','ESTUDIO','NEGOCIO','BUSINESS')),
  parent_id   uuid,
  model_key   text,
  description text NOT NULL DEFAULT '',
  role        text NOT NULL DEFAULT 'OWNER'
                CHECK (role IN ('OWNER','ADMIN','USER','READ_ONLY')),
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted     boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user   ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_type   ON workspaces(type);
CREATE INDEX IF NOT EXISTS idx_workspaces_parent ON workspaces(parent_id);

-- 2. workspace_modules
CREATE TABLE IF NOT EXISTS workspace_modules (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module_key   text NOT NULL,
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','disabled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, module_key)
);

-- 3. workspace_id en tablas de negocio
DO $$
DECLARE
  t text;
  business_tables text[] := ARRAY[
    'categories', 'products', 'purchases', 'purchase_items',
    'expenses', 'expense_details', 'expense_types',
    'investments', 'stock_movements', 'clients',
    'sales', 'sale_items'
  ];
BEGIN
  FOREACH t IN ARRAY business_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'workspace_id') THEN
      RAISE NOTICE 'workspace_id already exists on %', t;
    ELSE
      EXECUTE format('ALTER TABLE %I ADD COLUMN workspace_id uuid', t);
    END IF;
  END LOOP;
END $$;
