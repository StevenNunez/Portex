-- ================================================================
-- PORTEX · Migración v4 — Citófono digital
-- Correr en: Supabase Dashboard → SQL Editor
--
-- Resuelve el dolor central: hoy le tocan el timbre al residente y no
-- sabe quién es. Con esto nadie entra sin que la unidad lo sepa, y la
-- bitácora guarda QUIÉN autorizó cada ingreso.
--
-- Dos caminos hacia el mismo registro:
--   A) Pase anticipado  → el residente avisa antes ("hoy viene Juan")
--   B) Aprobación viva  → el visitante llega y la unidad decide al momento
-- ================================================================

-- ── 1. Cuentas de residente ligadas a su unidad ─────────────────
-- `residents` es el padrón (nombres del administrador). Esta tabla es
-- la que dice qué usuario de verdad puede aprobar por esa unidad.
-- Es N:N a propósito: en un departamento aprueban los dos.
CREATE TABLE IF NOT EXISTS resident_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resident_members_unique UNIQUE (resident_id, profile_id)
);

CREATE INDEX IF NOT EXISTS resident_members_profile ON resident_members (profile_id);
CREATE INDEX IF NOT EXISTS resident_members_resident ON resident_members (resident_id);

-- ── 2. Pases anticipados ────────────────────────────────────────
-- "Hoy viene Juan a buscarme": el conserje solo confirma identidad.
CREATE TABLE IF NOT EXISTS visit_passes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id       uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  resident_id       uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by_name   text,
  visitor_name      text NOT NULL,
  visitor_rut       text,
  plate             text,
  note              text,
  valid_from        timestamptz NOT NULL DEFAULT now(),
  valid_until       timestamptz NOT NULL,
  single_use        boolean NOT NULL DEFAULT true,
  used_at           timestamptz,
  used_count        int NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'activo'
    CHECK (status IN ('activo', 'usado', 'revocado', 'vencido')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visit_passes_lookup
  ON visit_passes (building_id, resident_id, status, valid_until);

-- ── 3. Solicitudes de ingreso (la aprobación en vivo) ───────────
CREATE TABLE IF NOT EXISTS access_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id        uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  resident_id        uuid REFERENCES residents(id) ON DELETE SET NULL,
  unit_code          text,
  visitor_name       text NOT NULL,
  visitor_rut        text,
  plate              text,
  kind               text NOT NULL DEFAULT 'visita'
    CHECK (kind IN ('visita', 'delivery', 'proveedor')),
  status             text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'aprobada', 'rechazada', 'vencida', 'sin_respuesta')),
  requested_by       text,               -- nombre del conserje de turno
  expires_at         timestamptz NOT NULL,
  responded_at       timestamptz,
  responded_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  responded_by_name  text,
  pass_id            uuid REFERENCES visit_passes(id) ON DELETE SET NULL,
  access_log_id      uuid REFERENCES access_log(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- El conserje consulta su solicitud viva cada pocos segundos y el
-- residente consulta las suyas: los dos índices son ese camino.
CREATE INDEX IF NOT EXISTS access_requests_building_status
  ON access_requests (building_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS access_requests_resident_status
  ON access_requests (resident_id, status, created_at DESC);

-- ── 4. Suscripciones de notificación push ───────────────────────
-- Una por navegador/dispositivo del residente.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_profile ON push_subscriptions (profile_id);

-- ── 5. La bitácora ahora guarda quién autorizó ──────────────────
ALTER TABLE access_log
  ADD COLUMN IF NOT EXISTS request_id    uuid REFERENCES access_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS authorized_by text;   -- "Carla Mena · app", "Pase previo", "Sin respuesta"

-- ── 6. RLS ──────────────────────────────────────────────────────
-- Igual que el resto: deny-all. Todo pasa por Server Actions con
-- service role, que filtran por edificio y por unidad del usuario.
ALTER TABLE resident_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_passes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions  ENABLE ROW LEVEL SECURITY;

-- ── 7. Verificación ─────────────────────────────────────────────
SELECT tablename,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = t.tablename) AS politicas
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('resident_members','visit_passes','access_requests','push_subscriptions')
ORDER BY tablename;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'access_log' AND column_name IN ('request_id','authorized_by');
