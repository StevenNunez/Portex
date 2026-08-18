-- ================================================================
-- PORTEX · Schema inicial
-- Correr en: Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- Edificios (1 por tenant en esta fase)
CREATE TABLE IF NOT EXISTS buildings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  address      text,
  units_total  int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Residentes
CREATE TABLE IF NOT EXISTS residents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  unit_code   text NOT NULL,
  name        text NOT NULL,
  household   text,
  tags        text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Visitantes frecuentes
CREATE TABLE IF NOT EXISTS frequent_visitors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id  uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name         text NOT NULL,
  rut          text,
  reason       text,
  default_unit text,
  last_seen_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Bitácora de accesos (tabla principal)
CREATE TABLE IF NOT EXISTS access_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('in','out','parcel','vehicle','delivery','provider')),
  who         text NOT NULL,
  context     text,
  unit        text,
  plate       text,
  recorded_by text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para queries del turno (filtrar por edificio + fecha desc)
CREATE INDEX IF NOT EXISTS access_log_building_time
  ON access_log (building_id, recorded_at DESC);

-- ================================================================
-- Datos de prueba (edificio demo + residentes)
-- ================================================================

INSERT INTO buildings (id, name, address, units_total) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Mirador del Parque', 'Av. Las Hualtatas 4288 · Vitacura', 312)
ON CONFLICT (id) DO NOTHING;

INSERT INTO residents (building_id, unit_code, name, household, tags) VALUES
  ('00000000-0000-0000-0000-000000000001', 'A · 1204', 'Martín Reyes',    'Reyes / Soto',    ARRAY['mascota']),
  ('00000000-0000-0000-0000-000000000001', 'A · 1503', 'Familia Vergara', '4 integrantes',   ARRAY[]::text[]),
  ('00000000-0000-0000-0000-000000000001', 'A · 0807', 'Ignacia Pérez',   'Pérez',           ARRAY[]::text[]),
  ('00000000-0000-0000-0000-000000000001', 'B · 0802', 'Andrea Pinto',    'Pinto / Aravena', ARRAY['estacionamiento 42']),
  ('00000000-0000-0000-0000-000000000001', 'B · 1106', 'Felipe Larraín',  'Larraín',         ARRAY[]::text[]),
  ('00000000-0000-0000-0000-000000000001', 'B · 1402', 'Cristián Bravo',  'Bravo / Ruiz',    ARRAY['no molestar']),
  ('00000000-0000-0000-0000-000000000001', 'C · 0304', 'María Fernández', 'Fernández',       ARRAY[]::text[]),
  ('00000000-0000-0000-0000-000000000001', 'C · 1809', 'Diego Mella',     'Mella / Tapia',   ARRAY['mascota']);

INSERT INTO frequent_visitors (building_id, name, rut, reason, default_unit) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Pedro Ramírez',   '15.234.890-1', 'Familia',        'A · 1204'),
  ('00000000-0000-0000-0000-000000000001', 'Catalina Donoso', '18.902.451-K', 'Nana',           'B · 0802'),
  ('00000000-0000-0000-0000-000000000001', 'Luis Vega',       '12.443.881-7', 'Mant. piscina',  'Áreas comunes'),
  ('00000000-0000-0000-0000-000000000001', 'Sofía Ortiz',     '20.118.337-2', 'Pareja',         'C · 1809');
