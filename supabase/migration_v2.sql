-- ================================================================
-- PORTEX · Migración v2
-- Agrega: rut/contact/status a residents, tablas staff y shifts
-- ================================================================

-- Expandir residents
ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS rut     text,
  ADD COLUMN IF NOT EXISTS contact text,
  ADD COLUMN IF NOT EXISTS status  text NOT NULL DEFAULT 'activo'
    CHECK (status IN ('activo','pendiente','inactivo'));

-- Personal del condominio
CREATE TABLE IF NOT EXISTS staff (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id  uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name         text NOT NULL,
  rut          text,
  role         text NOT NULL DEFAULT 'conserje',
  contact      text,
  hourly_rate  numeric(10,2),
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Turnos del personal
CREATE TABLE IF NOT EXISTS shifts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  staff_id    uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date        date NOT NULL,
  type        text NOT NULL CHECK (type IN ('mañana','tarde','noche')),
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  location    text,
  status      text NOT NULL DEFAULT 'programado'
    CHECK (status IN ('programado','activo','completado','libre','sin_cubrir')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shifts_building_date
  ON shifts (building_id, date);

-- ================================================================
-- Datos de prueba (residents expandidos + staff + turnos)
-- ================================================================

-- Actualizar residentes existentes con RUT y contacto
UPDATE residents SET
  rut = '12.443.881-7', contact = '+56 9 5512 3344', status = 'activo'
WHERE name = 'Martín Reyes';

UPDATE residents SET
  rut = '18.902.451-K', contact = '+56 9 6678 0190', status = 'activo'
WHERE name = 'Familia Vergara';

UPDATE residents SET
  rut = '15.234.890-1', contact = '+56 9 4456 7723', status = 'activo'
WHERE name = 'Ignacia Pérez';

UPDATE residents SET
  rut = '11.882.005-2', contact = '+56 9 8801 2245', status = 'activo'
WHERE name = 'Andrea Pinto';

UPDATE residents SET
  rut = '20.118.337-2', contact = '+56 9 3320 7714', status = 'activo'
WHERE name = 'Felipe Larraín';

UPDATE residents SET
  rut = '17.665.901-8', contact = '+56 9 5571 2299', status = 'pendiente'
WHERE name = 'Cristián Bravo';

UPDATE residents SET
  rut = '14.222.341-0', contact = '+56 9 7790 1102', status = 'activo'
WHERE name = 'María Fernández';

UPDATE residents SET
  rut = '16.901.554-5', contact = '+56 9 4471 0083', status = 'activo'
WHERE name = 'Diego Mella';

-- Más residentes
INSERT INTO residents (building_id, unit_code, name, household, tags, rut, contact, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'A · 0307', 'Tomás Acuña',    'Acuña / Salinas', ARRAY['estacionamiento 18'], '13.118.778-1', '+56 9 6612 4490', 'activo'),
  ('00000000-0000-0000-0000-000000000001', 'B · 0610', 'Renata Beltrán', 'Beltrán',         ARRAY[]::text[],            '21.001.443-3', '+56 9 8123 5582', 'activo'),
  ('00000000-0000-0000-0000-000000000001', 'C · 0501', 'Joaquín Ulloa',  'Ulloa / Mora',    ARRAY['mascota','estacionamiento 71'], '9.776.231-6', '+56 9 5440 7711', 'pendiente'),
  ('00000000-0000-0000-0000-000000000001', 'A · 2003', 'Valentina Ríos', 'Ríos',            ARRAY[]::text[],            '19.508.221-4', '+56 9 7708 9920', 'activo');

-- Personal
INSERT INTO staff (id, building_id, name, rut, role, contact, hourly_rate) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Rodrigo Espinoza', '14.321.987-5', 'conserje',  '+56 9 8812 3344', 4500),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'María Carrasco',   '16.554.231-K', 'conserje',  '+56 9 7723 4455', 4500),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Patricio Rojas',   '12.998.443-2', 'conserje',  '+56 9 6634 5566', 4500),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Sandra Olmos',     '19.112.887-8', 'conserje',  '+56 9 5545 6677', 4500)
ON CONFLICT (id) DO NOTHING;

-- Turnos de hoy (usar fecha dinámica cuando corras el SQL)
INSERT INTO shifts (building_id, staff_id, date, type, start_time, end_time, location, status) VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', CURRENT_DATE, 'mañana', '06:00', '14:00', 'Lobby B',  'completado'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', CURRENT_DATE, 'tarde',  '14:00', '22:00', 'Lobby A',  'activo'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', CURRENT_DATE, 'tarde',  '14:00', '22:00', 'Lobby C',  'activo'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', CURRENT_DATE, 'tarde',  '14:00', '22:00', 'Ronda',    'activo');

-- Actividad de ejemplo en access_log
INSERT INTO access_log (building_id, type, who, context, unit, recorded_by, recorded_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'in',      'Pedro Ramírez',   'Visita',          'A · 1204', 'R. Espinoza', now() - interval '28 min'),
  ('00000000-0000-0000-0000-000000000001', 'in',      'Jorge Mendieta',  'Jardinero',       'Áreas comunes', 'R. Espinoza', now() - interval '32 min'),
  ('00000000-0000-0000-0000-000000000001', 'vehicle', 'Cabify',          'Recoge A. Pinto', 'B · 0802', 'R. Espinoza', now() - interval '45 min'),
  ('00000000-0000-0000-0000-000000000001', 'parcel',  'Mercado Libre',   '2 cajas',         'A · 1503', 'R. Espinoza', now() - interval '58 min'),
  ('00000000-0000-0000-0000-000000000001', 'out',     'Camila Soto',     'Residente · sale','A · 1204', 'M. Carrasco', now() - interval '70 min'),
  ('00000000-0000-0000-0000-000000000001', 'in',      'Uber Eats',       'Delivery · sushi','B · 1106', 'M. Carrasco', now() - interval '76 min'),
  ('00000000-0000-0000-0000-000000000001', 'in',      'Luis Vega',       'Mant. piscina',   'Áreas comunes', 'M. Carrasco', now() - interval '90 min'),
  ('00000000-0000-0000-0000-000000000001', 'vehicle', 'Visita',          'M. Fernández',    'C · 0304', 'M. Carrasco', now() - interval '108 min'),
  ('00000000-0000-0000-0000-000000000001', 'parcel',  'Falabella',       '1 sobre',         'B · 1402', 'M. Carrasco', now() - interval '122 min'),
  ('00000000-0000-0000-0000-000000000001', 'in',      'Sofía Ortiz',     'Pareja · pernocta','C · 1809', 'M. Carrasco', now() - interval '140 min');
