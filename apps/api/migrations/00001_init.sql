-- CatoLedger - Migración 00001: esquema inicial de sincronización
-- Cada tabla replica el esquema SQLite de la app móvil y agrega user_id para multi-tenant.

-- ============================================================
-- Utilidades
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Tablas de dominio
-- ============================================================

CREATE TABLE categories (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  deleted     INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'synced'
);

CREATE TABLE products (
  id                   UUID PRIMARY KEY,
  user_id              UUID NOT NULL,
  code                 TEXT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT,
  category_id          UUID,
  brand                TEXT,
  unit                 TEXT,
  price_cents          BIGINT NOT NULL DEFAULT 0,
  purchase_price_cents BIGINT NOT NULL DEFAULT 0,
  stock                INT   NOT NULL DEFAULT 0,
  min_stock            INT   NOT NULL DEFAULT 0,
  deleted              INT   NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status          TEXT NOT NULL DEFAULT 'synced'
);

CREATE TABLE purchases (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL,
  code        TEXT NOT NULL,
  date        TIMESTAMPTZ NOT NULL,
  supplier    TEXT,
  total_cents BIGINT NOT NULL DEFAULT 0,
  notes       TEXT,
  deleted     INT   NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'synced'
);

CREATE TABLE purchase_items (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL,
  purchase_id     UUID NOT NULL,
  product_id      UUID,
  name            TEXT NOT NULL,
  quantity        INT  NOT NULL DEFAULT 0,
  unit_price_cents BIGINT NOT NULL DEFAULT 0,
  total_cents     BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expenses (
  id             UUID PRIMARY KEY,
  user_id        UUID NOT NULL,
  code           TEXT NOT NULL,
  date           TIMESTAMPTZ NOT NULL,
  description    TEXT NOT NULL,
  amount_cents   BIGINT NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'activo',
  payment_method TEXT,
  paid_date      TEXT,
  notes          TEXT,
  deleted        INT   NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status    TEXT NOT NULL DEFAULT 'synced'
);

CREATE TABLE expense_details (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL,
  expense_id      UUID NOT NULL,
  expense_type_id UUID,
  description     TEXT NOT NULL,
  amount_cents    BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expense_types (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'synced'
);

CREATE TABLE investments (
  id                 UUID PRIMARY KEY,
  user_id            UUID NOT NULL,
  name               TEXT NOT NULL,
  kind               TEXT,
  amount_cents       BIGINT NOT NULL DEFAULT 0,
  current_value_cents BIGINT NOT NULL DEFAULT 0,
  date               TIMESTAMPTZ NOT NULL,
  notes              TEXT,
  deleted            INT   NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status        TEXT NOT NULL DEFAULT 'synced'
);

CREATE TABLE stock_movements (
  id             UUID PRIMARY KEY,
  user_id        UUID NOT NULL,
  product_id     UUID NOT NULL,
  movement_type  TEXT NOT NULL,
  quantity       INT  NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id   UUID,
  date           TIMESTAMPTZ NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status    TEXT NOT NULL DEFAULT 'synced'
);

CREATE TABLE clients (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  debt_cents  BIGINT NOT NULL DEFAULT 0,
  deleted     INT   NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'synced'
);

CREATE TABLE sales (
  id             UUID PRIMARY KEY,
  user_id        UUID NOT NULL,
  code           TEXT NOT NULL,
  date           TIMESTAMPTZ NOT NULL,
  client_id      UUID,
  subtotal_cents BIGINT NOT NULL DEFAULT 0,
  discount_cents BIGINT NOT NULL DEFAULT 0,
  total_cents    BIGINT NOT NULL DEFAULT 0,
  payment_method TEXT,
  notes          TEXT,
  deleted        INT   NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status    TEXT NOT NULL DEFAULT 'synced'
);

CREATE TABLE sale_items (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL,
  sale_id         UUID NOT NULL,
  product_id      UUID,
  name            TEXT NOT NULL,
  quantity        INT  NOT NULL DEFAULT 0,
  unit_price_cents BIGINT NOT NULL DEFAULT 0,
  total_cents     BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Triggers updated_at
-- ============================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'categories','products','purchases','purchase_items','expenses',
      'expense_details','expense_types','investments','stock_movements',
      'clients','sales','sale_items'
    ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- ============================================================
-- Índices
-- ============================================================

CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_products_user ON products(user_id);
CREATE INDEX idx_purchases_user ON purchases(user_id);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expense_details_expense ON expense_details(expense_id);
CREATE INDEX idx_expense_types_user ON expense_types(user_id);
CREATE INDEX idx_investments_user ON investments(user_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_clients_user ON clients(user_id);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);

-- Cursor de pull por usuario y entidad
CREATE INDEX idx_products_user_updated ON products(user_id, updated_at);
CREATE INDEX idx_purchases_user_updated ON purchases(user_id, updated_at);
CREATE INDEX idx_expenses_user_updated ON expenses(user_id, updated_at);
CREATE INDEX idx_expense_types_user_updated ON expense_types(user_id, updated_at);
CREATE INDEX idx_investments_user_updated ON investments(user_id, updated_at);
CREATE INDEX idx_stock_movements_user_updated ON stock_movements(user_id, updated_at);
CREATE INDEX idx_clients_user_updated ON clients(user_id, updated_at);
CREATE INDEX idx_sales_user_updated ON sales(user_id, updated_at);
CREATE INDEX idx_categories_user_updated ON categories(user_id, updated_at);

-- ============================================================
-- Row Level Security
-- ============================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'categories','products','purchases','purchase_items','expenses',
      'expense_details','expense_types','investments','stock_movements',
      'clients','sales','sale_items'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%s ON %s
         USING (user_id = auth.uid());',
      t, t
    );
  END LOOP;
END;
$$;
