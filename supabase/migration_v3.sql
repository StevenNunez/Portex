-- ================================================================
-- PORTEX · Migration v3 — Auth / Multitenancy
-- Correr en: Supabase Dashboard → SQL Editor
-- ================================================================

-- ── 1. Organizations (SaaS tenants) ──────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL,
  plan        TEXT        NOT NULL DEFAULT 'trial',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organizations_slug_unique UNIQUE (slug),
  CONSTRAINT organizations_plan_check  CHECK (plan IN ('trial', 'starter', 'pro', 'enterprise'))
);

-- ── 2. Profiles (1:1 with auth.users) ────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID  REFERENCES organizations(id) ON DELETE SET NULL,
  role            TEXT  NOT NULL DEFAULT 'admin',
  full_name       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'conserje', 'residente'))
);

-- ── 3. Link buildings → organizations ────────────────────────────
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- ── 4. Auth trigger: auto-create profile on signup ───────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- El rol y la organización NO salen de raw_user_meta_data: eso lo manda
  -- el navegador. Ver migration_v16_seguridad_perfiles.sql.
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 5. RLS ───────────────────────────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;

-- Organizations: users can read their own org
DROP POLICY IF EXISTS "users_read_own_org" ON organizations;
CREATE POLICY "users_read_own_org" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Profiles: users can read their own profile
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Sin política de UPDATE: dejaba que cada usuario se cambiara su propio
-- `role` y `organization_id`. Los perfiles los escribe solo el servidor
-- (ver migration_v16_seguridad_perfiles.sql).
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
