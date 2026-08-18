-- ================================================================
-- PORTEX · RLS Policies
-- Correr en: Supabase Dashboard → SQL Editor
--
-- Modelo de acceso: el navegador NUNCA lee datos del condominio con
-- la anon key. Toda lectura y escritura pasa por Server Actions con
-- el service role, que sí filtra por building_id / organization_id.
-- Por lo tanto estas tablas van con RLS activo y SIN políticas:
-- deny-all para anon y para cualquier usuario autenticado.
-- (El service role ignora RLS por diseño.)
-- ================================================================

-- ── 1. Borrar las políticas públicas del MVP ────────────────────
-- Dejaban leer residentes, RUTs y la bitácora completa de TODOS los
-- condominios a cualquiera con la anon key (que va en el bundle JS).
DROP POLICY IF EXISTS "public_read_buildings"         ON buildings;
DROP POLICY IF EXISTS "public_read_residents"         ON residents;
DROP POLICY IF EXISTS "public_read_frequent_visitors" ON frequent_visitors;
DROP POLICY IF EXISTS "public_read_access_log"        ON access_log;
DROP POLICY IF EXISTS "public_read_staff"             ON staff;
DROP POLICY IF EXISTS "public_read_shifts"            ON shifts;
DROP POLICY IF EXISTS "public_insert_access_log"      ON access_log;

-- ── 2. RLS activo en todas las tablas de datos ──────────────────
ALTER TABLE buildings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequent_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;

-- ── 3. Lo único que el navegador sí necesita leer ───────────────
-- El login lee su propio perfil (role + organization_id) con la anon
-- key para decidir a dónde redirigir. Estas dos políticas vienen de
-- migration_v3.sql y se mantienen: cada usuario ve solo lo suyo.
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "users_read_own_org" ON organizations;
CREATE POLICY "users_read_own_org" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- ── 4. Verificación ─────────────────────────────────────────────
-- Después de correr esto, estas dos consultas deben devolver:
--   a) rowsecurity = true para las 8 tablas
--   b) políticas SOLO en profiles (2) y organizations (1)
--
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' ORDER BY tablename;
--
-- SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' ORDER BY tablename;
