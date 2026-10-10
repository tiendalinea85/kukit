-- ============================================================
-- 00006 — ALINEACIÓN DE ESQUEMA MÓVIL ↔ API (sync lossless).
-- ============================================================
-- El payload del móvil usa el vocabulario de su SQLite (product_name,
-- unit_price, subtotal, total_amount, cost_price/sale_price, name, status…).
-- El esquema 00001 usaba *_cents y otros nombres. Este script añade a las
-- tablas de la API las columnas que faltan para que el mapeo push/pull del
-- sync_service sea 1:1 (sin pérdida de datos al hacer la vuelta API→móvil).
-- Idempotente: cada ALTER usa IF NOT EXISTS.

-- categories (el móvil pinta color + icon)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#8b5cf6';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT '';

-- products (el móvil manda sku, tax_rate y active; brand se conserva)
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active INT NOT NULL DEFAULT 1;

-- purchases (el móvil manda invoice, time, status, payment_method, items_count)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendiente';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS items_count INT NOT NULL DEFAULT 0;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS invoice TEXT NOT NULL DEFAULT '';

-- purchase_items: espejo de name para que el móvil recupere product_name
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS product_name TEXT NOT NULL DEFAULT '';

-- expenses (el móvil manda name, total_amount, items_count, has_details,
-- category_id, type_id y time; name alimenta la descripción de gasto simple)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS total_amount_cents BIGINT NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS items_count INT NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS has_details INT NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS time TEXT;

-- expense_details (el móvil manda product_name, quantity, unit_price, subtotal)
ALTER TABLE expense_details ADD COLUMN IF NOT EXISTS product_name TEXT NOT NULL DEFAULT '';
ALTER TABLE expense_details ADD COLUMN IF NOT EXISTS quantity REAL NOT NULL DEFAULT 1;
ALTER TABLE expense_details ADD COLUMN IF NOT EXISTS unit_price_cents BIGINT NOT NULL DEFAULT 0;
ALTER TABLE expense_details ADD COLUMN IF NOT EXISTS subtotal_cents BIGINT NOT NULL DEFAULT 0;

-- investments (el móvil manda code, asset_name/asset_type, return_rate,
-- category, supplier, payment_method, status y voided_at)
ALTER TABLE investments ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS asset_name TEXT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS asset_type TEXT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS return_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE investments ADD COLUMN IF NOT EXISTS supplier TEXT NOT NULL DEFAULT '';
ALTER TABLE investments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pagado';
ALTER TABLE investments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

-- clients (el móvil manda notes)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

-- sales (el móvil manda time, status, tax e items_count)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'borrador';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_cents BIGINT NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS items_count INT NOT NULL DEFAULT 0;

-- sale_items (el móvil manda product_name y discount)
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS product_name TEXT NOT NULL DEFAULT '';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS discount_cents BIGINT NOT NULL DEFAULT 0;

-- Índices para los patrones de consulta del pull por workspace
CREATE INDEX IF NOT EXISTS idx_expenses_workspace ON expenses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_workspace ON products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_purchases_workspace ON purchases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_investments_workspace ON investments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sales_workspace ON sales(workspace_id);