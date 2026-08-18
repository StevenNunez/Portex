-- ================================================================
-- PORTEX · Migración v12 — Perfil del departamento
-- Correr en: Supabase Dashboard → SQL Editor
--
-- Hay datos que a Portex no le hacen falta para dejar entrar a nadie, pero
-- que el administrador necesita todas las semanas: a quién llamar, si el que
-- vive es el dueño o arrienda, cuánta gente hay en el departamento y si tiene
-- perro. Hoy eso vive en un Excel aparte que se desactualiza solo.
--
-- La idea es que lo mantenga el residente desde su teléfono —él es el único
-- que sabe cuándo cambia— y que el administrador lo lea sin tener que pedirlo
-- por WhatsApp.
-- ================================================================

-- ── 1. Propietario o arrendatario ───────────────────────────────
-- Es el dato que más se pregunta: define a quién se le cobran los gastos
-- comunes y con quién se habla cuando hay un problema en la unidad.
ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS tenancy text
    CHECK (tenancy IN ('propietario', 'arrendatario', 'otro')),
  -- Cuándo el residente revisó su ficha por última vez. Sin esto no hay forma
  -- de saber si "sin mascotas" significa que no tiene o que nunca la llenó.
  ADD COLUMN IF NOT EXISTS profile_updated_at timestamptz;

-- ── 2. Quiénes viven ahí ────────────────────────────────────────
-- `residents.household` era texto libre ("Reyes / Soto", "4 integrantes"):
-- servía para mostrarlo y para nada más. Esto se puede contar, buscar y
-- mantener.
CREATE TABLE IF NOT EXISTS household_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id  uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  resident_id  uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  name         text NOT NULL,
  -- Texto libre a propósito: "hijo", "mi mamá", "nana puertas adentro".
  -- Encasillarlo en una lista solo consigue que elijan "otro".
  relationship text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS household_members_resident
  ON household_members (resident_id);

-- ── 3. Mascotas ─────────────────────────────────────────────────
-- Le importa al administrador (reglamento, ascensores, áreas comunes) y a la
-- portería el día que un perro anda suelto en el estacionamiento y hay que
-- saber de qué departamento salió.
CREATE TABLE IF NOT EXISTS pets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id  uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  resident_id  uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  species      text NOT NULL DEFAULT 'perro'
    CHECK (species IN ('perro', 'gato', 'otro')),
  name         text,
  -- Raza, tamaño, color: lo que sirve para reconocerlo.
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pets_resident ON pets (resident_id);

-- ── 4. RLS ──────────────────────────────────────────────────────
-- Deny-all como todo lo demás: pasa por Server Actions que primero preguntan
-- a la base a qué departamento pertenece la sesión.
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets              ENABLE ROW LEVEL SECURITY;

-- ── 5. Verificación ─────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'residents' AND column_name IN ('tenancy', 'profile_updated_at');

SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('household_members', 'pets');
