-- ============================================================
-- VALIDACIÓN DE ESQUEMA — POS RETAIL EMPRESARIAL
-- ============================================================
-- Ejecutar tras aplicar las migraciones 00001..00013 en orden.
-- Cada bloque es una consulta de verificación:
--   - 0 filas devueltas  = comprobación OK
--   - filas devueltas    = detalle de lo que falta o está mal
-- Al final hay un resumen con conteos y estado de RLS.

-- ============================================================
-- 1. TABLAS OBLIGATORIAS
-- ============================================================
-- Debe devolver 0 filas (todas existen).

SELECT t AS "FALTA_TABLA"
FROM unnest(ARRAY[
  'workspaces', 'workspace_modules',
  'products', 'sales', 'sale_details',
  'purchases', 'purchase_details',
  'inventory_movements'
]) AS t
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = t
);

-- ============================================================
-- 2. COLUMNAS CLAVE (revision / updated_at / workspace_id)
-- ============================================================
-- Cada fila devuelta = columna faltante en una tabla esperada.

SELECT table_name, column_name, 'FALTA_COLUMNA' AS problema
FROM (
  SELECT 'categories'   AS table_name, 'revision'    AS column_name UNION ALL
  SELECT 'types'        , 'revision'                                   UNION ALL
  SELECT 'expenses'     , 'revision'                                   UNION ALL
  SELECT 'investment_categories', 'revision'                           UNION ALL
  SELECT 'investments'  , 'revision'                                   UNION ALL
  SELECT 'customers'    , 'revision'                                   UNION ALL
  SELECT 'products'     , 'revision'                                   UNION ALL
  SELECT 'sales'        , 'revision'                                   UNION ALL
  SELECT 'sale_details' , 'revision'                                   UNION ALL
  SELECT 'purchases'    , 'revision'                                   UNION ALL
  SELECT 'purchase_details', 'revision'                                UNION ALL
  -- updated_at
  SELECT 'purchases'    , 'updated_at'                                 UNION ALL
  SELECT 'purchase_details', 'updated_at'                              UNION ALL
  -- workspace_id en tablas de negocio
  SELECT 'categories'   , 'workspace_id'                               UNION ALL
  SELECT 'types'        , 'workspace_id'                               UNION ALL
  SELECT 'expenses'     , 'workspace_id'                               UNION ALL
  SELECT 'investment_categories', 'workspace_id'                       UNION ALL
  SELECT 'investments'  , 'workspace_id'                               UNION ALL
  SELECT 'customers'    , 'workspace_id'                               UNION ALL
  SELECT 'products'     , 'workspace_id'                               UNION ALL
  SELECT 'sales'        , 'workspace_id'                               UNION ALL
  SELECT 'sale_details' , 'workspace_id'                               UNION ALL
  SELECT 'purchases'    , 'workspace_id'                               UNION ALL
  SELECT 'purchase_details', 'workspace_id'                            UNION ALL
  SELECT 'inventory_movements', 'workspace_id'
) AS checks (table_name, column_name)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name  = checks.table_name
    AND column_name = checks.column_name
);

-- ============================================================
-- 3. RELACIONES (claves foráneas)
-- ============================================================
-- 3.1 purchase_details.purchase_id → purchases.id

SELECT 'purchase_details.purchase_id->purchases.id' AS "FALTA_FK"
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
   AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'purchase_details'
    AND kcu.column_name = 'purchase_id'
    AND ccu.table_name  = 'purchases'
);

-- 3.2 purchase_details.product_id → products.id

SELECT 'purchase_details.product_id->products.id' AS "FALTA_FK"
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
   AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'purchase_details'
    AND kcu.column_name = 'product_id'
    AND ccu.table_name  = 'products'
);

-- 3.3 workspace_modules.workspace_id → workspaces.id

SELECT 'workspace_modules.workspace_id->workspaces.id' AS "FALTA_FK"
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
   AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'workspace_modules'
    AND kcu.column_name = 'workspace_id'
    AND ccu.table_name  = 'workspaces'
);

-- 3.4 workspace_members.workspace_id → workspaces.id

SELECT 'workspace_members.workspace_id->workspaces.id' AS "FALTA_FK"
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
   AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'workspace_members'
    AND kcu.column_name = 'workspace_id'
    AND ccu.table_name  = 'workspaces'
);

-- ============================================================
-- 4. TRIGGERS trg_bump_revision
-- ============================================================
-- 4.1 Tablas esperadas que carecen del trigger (debe ser 0 filas)

WITH esperadas AS (
  SELECT unnest(ARRAY[
    'categories', 'types', 'expenses',
    'investment_categories', 'investments',
    'customers', 'products', 'sales', 'sale_details',
    'purchases', 'purchase_details'
  ]) AS table_name
)
SELECT e.table_name AS "SIN_TRG_BUMP"
FROM esperadas e
WHERE EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name=e.table_name)
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.triggers tr
    WHERE tr.event_object_schema = 'public'
      AND tr.event_object_table = e.table_name
      AND tr.trigger_name = 'trg_bump_revision'
  );

-- 4.2 inventory_movements NO debe llevar trg_bump_revision (es append-only)
--     Debe devolver 0 filas.

SELECT 'inventory_movements' AS "TRG_BUMP_NO_DESEADO"
WHERE EXISTS (
  SELECT 1 FROM information_schema.triggers tr
  WHERE tr.event_object_schema = 'public'
    AND tr.event_object_table = 'inventory_movements'
    AND tr.trigger_name = 'trg_bump_revision'
);

-- 4.3 inventory_movements SÍ debe llevar trg_inventory_append_only

SELECT 'inventory_movements' AS "SIN_TRG_APPEND_ONLY"
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.triggers tr
  WHERE tr.event_object_schema = 'public'
    AND tr.event_object_table = 'inventory_movements'
    AND tr.trigger_name = 'trg_inventory_append_only'
);

-- ============================================================
-- 5. RLS HABILITADO
-- ============================================================
-- Cada fila devuelta = tabla de negocio con RLS deshabilitado.

SELECT c.relname AS "RLS_DESACTIVADO"
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;

-- ============================================================
-- 6. RESUMEN
-- ============================================================

SELECT
  (SELECT count(*) FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE')                       AS tablas_public,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND column_name = 'workspace_id')                     AS columnas_workspace_id,
  (SELECT count(*) FROM (
     SELECT tr.event_object_table FROM information_schema.triggers tr
     WHERE tr.event_object_schema = 'public' AND tr.trigger_name = 'trg_bump_revision'
     GROUP BY tr.event_object_table
   ) t)                                                                                AS tablas_con_trg_bump,
  (SELECT count(*) FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity)                AS tablas_con_rls;

-- ============================================================
-- FIN
-- ============================================================