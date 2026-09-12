-- Migración 00013: Módulos especializados
-- Taller de confección, agricultura, repuestos automotrices, crianza.
-- Cada tabla incluye workspace_id para aislamiento por workspace.

-- ============================================================
-- TALLER DE CONFECCIÓN
-- ============================================================

CREATE TABLE IF NOT EXISTS garments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category_id TEXT,
  sale_price NUMERIC(12,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sizes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS garment_colors (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  hex TEXT DEFAULT '#8b5cf6',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'metro',
  cost_per_unit NUMERIC(12,2) DEFAULT 0,
  stock NUMERIC(12,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS production_orders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  garment_id TEXT NOT NULL,
  garment_name TEXT NOT NULL,
  size_id TEXT NOT NULL,
  size_name TEXT NOT NULL,
  color_id TEXT NOT NULL,
  color_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendiente',
  start_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  voided_at TIMESTAMPTZ,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS production_materials (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  production_order_id TEXT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AGRICULTURA
-- ============================================================

CREATE TABLE IF NOT EXISTS crops (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  season TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'activa',
  start_date TEXT NOT NULL,
  end_date TEXT,
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS farm_lots (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  area NUMERIC(12,2) DEFAULT 0,
  area_unit TEXT DEFAULT 'hectarea',
  location TEXT DEFAULT '',
  soil_type TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS agro_inputs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'otro',
  unit TEXT NOT NULL DEFAULT 'kg',
  cost_per_unit NUMERIC(12,2) DEFAULT 0,
  stock NUMERIC(12,2) DEFAULT 0,
  supplier TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  crop_id TEXT NOT NULL,
  crop_name TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  lot_name TEXT NOT NULL,
  input_id TEXT NOT NULL,
  input_name TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  application_date TEXT NOT NULL,
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS labors (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  crop_id TEXT NOT NULL,
  crop_name TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  lot_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'otro',
  description TEXT DEFAULT '',
  labor_date TEXT NOT NULL,
  labor_cost NUMERIC(12,2) DEFAULT 0,
  worker_count INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS harvests (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  crop_id TEXT NOT NULL,
  crop_name TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  lot_name TEXT NOT NULL,
  product TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  unit_price NUMERIC(12,2) DEFAULT 0,
  total_value NUMERIC(12,2) DEFAULT 0,
  harvest_date TEXT NOT NULL,
  quality TEXT DEFAULT 'estandar',
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

-- ============================================================
-- REPUESTOS AUTOMOTRICES
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicle_brands (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  country TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  brand_id TEXT NOT NULL REFERENCES vehicle_brands(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  name TEXT NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER,
  engine TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auto_parts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  part_number TEXT DEFAULT '',
  brand TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'otro',
  unit_price NUMERIC(12,2) DEFAULT 0,
  cost_price NUMERIC(12,2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS part_compatibilities (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  part_id TEXT NOT NULL REFERENCES auto_parts(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  year_from INTEGER NOT NULL,
  year_to INTEGER,
  engine TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CRIANZA
-- ============================================================

CREATE TABLE IF NOT EXISTS species (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'otro',
  unit TEXT NOT NULL DEFAULT 'unidad',
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS breeding_lots (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  species_id TEXT NOT NULL,
  species_name TEXT NOT NULL,
  location TEXT DEFAULT '',
  capacity INTEGER DEFAULT 0,
  current_count INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS animals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  species_id TEXT NOT NULL,
  species_name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'macho',
  birth_date TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  lot_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'activo',
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS feedings (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  lot_name TEXT NOT NULL,
  feed_type TEXT NOT NULL DEFAULT 'otro',
  feed_name TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  cost NUMERIC(12,2) DEFAULT 0,
  feeding_date TEXT NOT NULL,
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS reproductions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  animal_id TEXT NOT NULL,
  animal_name TEXT NOT NULL,
  event TEXT NOT NULL DEFAULT 'otro',
  event_date TEXT NOT NULL,
  target_animal TEXT DEFAULT '',
  result TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS livestock_productions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  lot_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'otro',
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unidad',
  unit_price NUMERIC(12,2) DEFAULT 0,
  total_value NUMERIC(12,2) DEFAULT 0,
  production_date TEXT NOT NULL,
  notes TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INTEGER DEFAULT 1
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_garments_workspace ON garments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sizes_workspace ON sizes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_garment_colors_workspace ON garment_colors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_materials_workspace ON materials(workspace_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_workspace ON production_orders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_production_materials_workspace ON production_materials(workspace_id);

CREATE INDEX IF NOT EXISTS idx_crops_workspace ON crops(workspace_id);
CREATE INDEX IF NOT EXISTS idx_farm_lots_workspace ON farm_lots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agro_inputs_workspace ON agro_inputs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_applications_workspace ON applications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_labors_workspace ON labors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_harvests_workspace ON harvests(workspace_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_brands_workspace ON vehicle_brands(workspace_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_workspace ON vehicle_models(workspace_id);
CREATE INDEX IF NOT EXISTS idx_auto_parts_workspace ON auto_parts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_part_compatibilities_workspace ON part_compatibilities(workspace_id);

CREATE INDEX IF NOT EXISTS idx_species_workspace ON species(workspace_id);
CREATE INDEX IF NOT EXISTS idx_breeding_lots_workspace ON breeding_lots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_animals_workspace ON animals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_feedings_workspace ON feedings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reproductions_workspace ON reproductions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_livestock_productions_workspace ON livestock_productions(workspace_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE garment_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_materials ENABLE ROW LEVEL SECURITY;

ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE agro_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE labors ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvests ENABLE ROW LEVEL SECURITY;

ALTER TABLE vehicle_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_compatibilities ENABLE ROW LEVEL SECURITY;

ALTER TABLE species ENABLE ROW LEVEL SECURITY;
ALTER TABLE breeding_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reproductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestock_productions ENABLE ROW LEVEL SECURITY;

-- Policies: each user can only access their own rows.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'garments', 'sizes', 'garment_colors', 'materials',
      'production_orders', 'production_materials',
      'crops', 'farm_lots', 'agro_inputs', 'applications', 'labors', 'harvests',
      'vehicle_brands', 'vehicle_models', 'auto_parts', 'part_compatibilities',
      'species', 'breeding_lots', 'animals', 'feedings', 'reproductions', 'livestock_productions'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "%s_user_isolation" ON %I
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)',
      t, t
    );
  END LOOP;
END $$;
