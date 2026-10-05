-- Iconos propios reutilizables del workspace.
-- Set que el usuario sube o importa y puede aplicar a varias categorías.
-- `data_url` es un PNG de 128px en base64 (3-8 KB), por eso TEXT y no BYTEA:
-- el PWA lo lee tal cual para pintar un <img> sin pasar por un bucket.

CREATE TABLE IF NOT EXISTS custom_icons (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  data_url    TEXT NOT NULL,
  deleted     INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'synced'
);

-- workspace_id se inyecta desde el sync_service tras validar membresía y rol
-- (misma convención que las tablas de negocio de 00003).
ALTER TABLE custom_icons ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- El pull incremental ordena por updated_at: ese índice es la marca de agua.
CREATE INDEX IF NOT EXISTS idx_custom_icons_user ON custom_icons(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_icons_user_updated ON custom_icons(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_custom_icons_workspace ON custom_icons(workspace_id);

DROP TRIGGER IF EXISTS trg_custom_icons_updated_at ON custom_icons;
CREATE TRIGGER trg_custom_icons_updated_at
  BEFORE UPDATE ON custom_icons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE custom_icons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_custom_icons ON custom_icons;
CREATE POLICY tenant_isolation_custom_icons ON custom_icons
  USING (user_id = auth.uid());