-- ============================================================
-- 00006 — CLIENTES, PRODUCTOS, INVENTARIO Y VENTAS
-- ============================================================
-- VENTAS = registro de ventas realizadas (NO e-commerce). Una venta
-- confirmada genera un movimiento SALIDA de inventario; el stock
-- nunca se modifica directamente (se deriva de inventory_movements).
-- products se crea AQUÍ (etapa anterior a compras) para que
-- purchase_details pueda referenciarlo en 00007.

-- 1. Clientes
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Productos (el stock NO se almacena aquí)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2b. Garantía para bases existentes donde products se creó sin category_id
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- 3. Movimientos de inventario (fuente de verdad del stock)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'salida')),
  quantity DECIMAL(12,2) NOT NULL CHECK (quantity > 0),
  reference_type TEXT NOT NULL DEFAULT 'venta'
    CHECK (reference_type IN ('inventario_inicial', 'venta', 'anulacion_venta')),
  reference_id UUID,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Ventas
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'efectivo'
    CHECK (payment_method IN ('efectivo', 'tarjeta_credito', 'tarjeta_debito', 'yape', 'plin', 'transferencia', 'otro')),
  total DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmada', 'anulada')),
  confirmed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Detalle de venta (snapshot del producto para conservar historial)
CREATE TABLE IF NOT EXISTS public.sale_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  quantity DECIMAL(12,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Índices para los patrones de consulta
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_user_id ON public.inventory_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_deleted ON public.sales(deleted);
CREATE INDEX IF NOT EXISTS idx_sale_details_sale_id ON public.sale_details(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_details_product_id ON public.sale_details(product_id);

-- 7. Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own customers" ON public.customers;
CREATE POLICY "Users can read own customers" ON public.customers FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own customers" ON public.customers;
CREATE POLICY "Users can insert own customers" ON public.customers FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own customers" ON public.customers;
CREATE POLICY "Users can update own customers" ON public.customers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own customers" ON public.customers;
CREATE POLICY "Users can delete own customers" ON public.customers FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own products" ON public.products;
CREATE POLICY "Users can read own products" ON public.products FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
CREATE POLICY "Users can insert own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own products" ON public.products;
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own products" ON public.products;
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own inventory movements" ON public.inventory_movements;
CREATE POLICY "Users can read own inventory movements" ON public.inventory_movements FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own inventory movements" ON public.inventory_movements;
CREATE POLICY "Users can insert own inventory movements" ON public.inventory_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own inventory movements" ON public.inventory_movements;
CREATE POLICY "Users can update own inventory movements" ON public.inventory_movements FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own inventory movements" ON public.inventory_movements;
CREATE POLICY "Users can delete own inventory movements" ON public.inventory_movements FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own sales" ON public.sales;
CREATE POLICY "Users can read own sales" ON public.sales FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own sales" ON public.sales;
CREATE POLICY "Users can insert own sales" ON public.sales FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own sales" ON public.sales;
CREATE POLICY "Users can update own sales" ON public.sales FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own sales" ON public.sales;
CREATE POLICY "Users can delete own sales" ON public.sales FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own sale details" ON public.sale_details;
CREATE POLICY "Users can read own sale details" ON public.sale_details FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own sale details" ON public.sale_details;
CREATE POLICY "Users can insert own sale details" ON public.sale_details FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own sale details" ON public.sale_details;
CREATE POLICY "Users can update own sale details" ON public.sale_details FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own sale details" ON public.sale_details;
CREATE POLICY "Users can delete own sale details" ON public.sale_details FOR DELETE USING (auth.uid() = user_id);