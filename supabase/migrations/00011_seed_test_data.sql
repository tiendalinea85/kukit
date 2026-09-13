-- SEED DE DATOS DE PRUEBA (solo desarrollo)
--
-- Inserta datos de demostración coherentes (categorías, gastos, productos,
-- clientes, ventas, compras, inversiones e inventario) asignados al PRIMER
-- usuario autenticado del proyecto.
--
-- CÓMO USARLO:
--   1. Aplica 00001..00010 en orden.
--   2. Crea tu cuenta en la app (Registrarse) para que exista un usuario en
--      auth.users. El seed asigna los datos a ESE primer usuario.
--   3. Ejecuta este archivo en el SQL Editor de Supabase.
--
-- Es idempotente: si los datos ya existen (mismos IDs fijos), no hace nada.

DO $$
DECLARE
  owner_uuid UUID;
BEGIN
  SELECT id INTO owner_uuid FROM auth.users ORDER BY created_at LIMIT 1;

  IF owner_uuid IS NULL THEN
    RAISE NOTICE 'No hay usuarios en auth.users. Crea tu cuenta en la app y vuelve a ejecutar el seed.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM categories WHERE id = 'c0000000-0000-4000-8000-000000000001') THEN
    RAISE NOTICE 'El seed ya fue aplicado. No se hace nada.';
    RETURN;
  END IF;

  -- ============================================================
  -- Categorías y tipos
  -- ============================================================

  INSERT INTO categories (id, user_id, name, color, icon) VALUES
    ('c0000000-0000-4000-8000-000000000001', owner_uuid, 'Efectivo',    '#10b981', '💰'),
    ('c0000000-0000-4000-8000-000000000002', owner_uuid, 'Alquiler',    '#8b5cf6', '🏠'),
    ('c0000000-0000-4000-8000-000000000003', owner_uuid, 'Proveedores', '#f59e0b', '📦');

  INSERT INTO types (id, user_id, name) VALUES
    ('f0000000-0000-4000-8000-000000000001', owner_uuid, 'Fijo'),
    ('f0000000-0000-4000-8000-000000000002', owner_uuid, 'Variable');

  -- ============================================================
  -- Gastos
  -- ============================================================

  INSERT INTO expenses
    (id, user_id, code, name, description, amount, category_id, type_id,
     payment_method, status, date, time, notes) VALUES
    ('e0000000-0000-4000-8000-000000000001', owner_uuid, 'G000001', 'Alquiler local',
     'Alquiler mensual del local', 1500.00, 'c0000000-0000-4000-8000-000000000002',
     'f0000000-0000-4000-8000-000000000001', 'transferencia', 'pagado',
     '2026-07-01', '09:00', 'Pagar el día 1 de cada mes'),
    ('e0000000-0000-4000-8000-000000000002', owner_uuid, 'G000002', 'Compra de suministros',
     'Papelería y suministros de oficina', 320.50, 'c0000000-0000-4000-8000-000000000003',
     'f0000000-0000-4000-8000-000000000002', 'efectivo', 'pagado',
     '2026-07-15', '14:30', ''),
    ('e0000000-0000-4000-8000-000000000003', owner_uuid, 'G000003', 'Recibo de luz',
     '', 180.00, 'c0000000-0000-4000-8000-000000000001',
     'f0000000-0000-4000-8000-000000000002', 'transferencia', 'pendiente',
     '2026-08-01', '18:00', '');

  -- ============================================================
  -- Categorías de inversión e inversiones
  -- ============================================================

  INSERT INTO investment_categories (id, user_id, name, color, icon) VALUES
    ('a0000000-0000-4000-8000-000000000001', owner_uuid, 'Equipos', '#6366f1', '💻'),
    ('a0000000-0000-4000-8000-000000000002', owner_uuid, 'Muebles', '#f97316', '🪑');

  INSERT INTO investments
    (id, user_id, name, value, category_id, supplier, payment_method, status, date, notes) VALUES
    ('b0000000-0000-4000-8000-000000000001', owner_uuid, 'Impresora',
     1200.00, 'a0000000-0000-4000-8000-000000000001', 'Marketplace',
     'transferencia', 'pagado', '2026-06-10', 'Impresora láser multifunción'),
    ('b0000000-0000-4000-8000-000000000002', owner_uuid, 'Escritorio de madera',
     350.00, 'a0000000-0000-4000-8000-000000000002', 'Mueblería Andina',
     'efectivo', 'pagado', '2026-06-20', '');

  -- ============================================================
  -- Clientes y productos
  -- ============================================================

  INSERT INTO customers (id, user_id, name, phone, address, notes) VALUES
    ('d0000000-0000-4000-8000-000000000001', owner_uuid, 'María García', '987654321', 'Av. Lima 123', ''),
    ('d0000000-0000-4000-8000-000000000002', owner_uuid, 'Juan Pérez', '912345678', 'Jr. Cusco 45', '');

  INSERT INTO products (id, user_id, code, name, color, category_id) VALUES
    ('a1000000-0000-4000-8000-000000000001', owner_uuid, 'P00001', 'Cuaderno A4',  'Azul',   'c0000000-0000-4000-8000-000000000001'),
    ('a1000000-0000-4000-8000-000000000002', owner_uuid, 'P00002', 'Lapicero azul', 'Azul',   'c0000000-0000-4000-8000-000000000001'),
    ('a1000000-0000-4000-8000-000000000003', owner_uuid, 'P00003', 'Resaltador',    'Amarillo','c0000000-0000-4000-8000-000000000001');

  -- ============================================================
  -- Compras
  -- ============================================================

  INSERT INTO purchases
    (id, user_id, code, supplier, date, payment_method, total, notes, status, received_at) VALUES
    ('b1000000-0000-4000-8000-000000000001', owner_uuid, 'C000001', 'Distribuidora Nacional',
     '2026-08-05', 'transferencia', 90.00, 'Reabastecimiento', 'recibida', now());

  INSERT INTO purchase_details
    (id, user_id, purchase_id, product_id, code, name, color, quantity, unit_price, subtotal) VALUES
    ('b2000000-0000-4000-8000-000000000001', owner_uuid, 'b1000000-0000-4000-8000-000000000001',
     'a1000000-0000-4000-8000-000000000002', 'P00002', 'Lapicero azul', 'Azul', 30, 1.50, 45.00),
    ('b2000000-0000-4000-8000-000000000002', owner_uuid, 'b1000000-0000-4000-8000-000000000001',
     'a1000000-0000-4000-8000-000000000001', 'P00001', 'Cuaderno A4',  'Azul', 10, 4.50, 45.00);

  -- ============================================================
  -- Ventas (confirmadas -> generan salida de inventario)
  -- ============================================================

  INSERT INTO sales
    (id, user_id, code, customer_id, date, payment_method, total, notes, status, confirmed_at) VALUES
    ('e1000000-0000-4000-8000-000000000001', owner_uuid, 'S000001',
     'd0000000-0000-4000-8000-000000000001', '2026-08-10', 'efectivo', 24.00, '', 'confirmada', now());

  INSERT INTO sale_details
    (id, user_id, sale_id, product_id, code, name, color, quantity, unit_price, subtotal) VALUES
    ('e2000000-0000-4000-8000-000000000001', owner_uuid, 'e1000000-0000-4000-8000-000000000001',
     'a1000000-0000-4000-8000-000000000001', 'P00001', 'Cuaderno A4',  'Azul', 2, 8.00, 16.00),
    ('e2000000-0000-4000-8000-000000000002', owner_uuid, 'e1000000-0000-4000-8000-000000000001',
     'a1000000-0000-4000-8000-000000000002', 'P00002', 'Lapicero azul', 'Azul', 4, 2.00,  8.00);

  -- ============================================================
  -- Inventario (append-only): stock inicial + salidas de la venta
  -- ============================================================

  INSERT INTO inventory_movements
    (id, user_id, product_id, type, quantity, reference_type, reference_id, notes) VALUES
    ('c1000000-0000-4000-8000-000000000001', owner_uuid, 'a1000000-0000-4000-8000-000000000001',
     'entrada', 50, 'inventario_inicial', NULL, 'Stock inicial'),
    ('c1000000-0000-4000-8000-000000000002', owner_uuid, 'a1000000-0000-4000-8000-000000000002',
     'entrada', 100, 'inventario_inicial', NULL, 'Stock inicial'),
    ('c1000000-0000-4000-8000-000000000003', owner_uuid, 'a1000000-0000-4000-8000-000000000001',
     'salida', 2, 'venta', 'e1000000-0000-4000-8000-000000000001', 'Venta S000001'),
    ('c1000000-0000-4000-8000-000000000004', owner_uuid, 'a1000000-0000-4000-8000-000000000002',
     'salida', 4, 'venta', 'e1000000-0000-4000-8000-000000000001', 'Venta S000001');

  RAISE NOTICE 'Seed de datos de prueba aplicado para el usuario %.', owner_uuid;
END $$;