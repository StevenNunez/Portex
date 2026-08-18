-- ================================================================
-- PORTEX · Migración v6 — Estacionamientos
-- Correr en: Supabase Dashboard → SQL Editor
--
-- "¿Dónde dejo el auto?" — la pregunta que hoy se resuelve mirando
-- por la ventana y acordándose de memoria.
--
-- Dos tipos de estacionamiento: los de cada departamento y los de
-- visita. La regla del edificio: si el del depto está libre, ahí va
-- la visita; si está ocupado, uno de visita; si no queda ninguno,
-- el auto se queda fuera y el conserje lo sabe antes de abrir.
-- ================================================================

BEGIN;

-- ── 1. Los estacionamientos que existen ─────────────────────────
-- El estacionamiento es de la UNIDAD, no de la persona: si el 1204 se
-- vende o se arrienda, el E-12 sigue siendo del 1204 y no hay que
-- reasignar nada.
CREATE TABLE IF NOT EXISTS parking_spots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  code        text NOT NULL,                       -- "E-12", "V-3"
  kind        text NOT NULL DEFAULT 'residente'
    CHECK (kind IN ('residente', 'visita')),
  unit_code   text,                                -- solo para kind='residente'
  active      boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT parking_spots_code_unique UNIQUE (building_id, code),

  -- Un estacionamiento de residente sin unidad no le sirve a nadie:
  -- nunca se podría sugerir. Los de visita, al revés, no llevan unidad.
  CONSTRAINT parking_spots_unit_coherente CHECK (
    (kind = 'residente' AND unit_code IS NOT NULL) OR
    (kind = 'visita'    AND unit_code IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS parking_spots_building
  ON parking_spots (building_id, kind, active);

CREATE INDEX IF NOT EXISTS parking_spots_unit
  ON parking_spots (building_id, unit_code)
  WHERE unit_code IS NOT NULL;

-- ── 2. Quién está ocupando qué, ahora ───────────────────────────
-- Una fila por auto estacionado. `ended_at IS NULL` = sigue adentro.
-- Se guarda el histórico completo: sirve para reclamos ("mi visita
-- estuvo dos días en el estacionamiento") y no cuesta nada.
CREATE TABLE IF NOT EXISTS parking_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id   uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  spot_id       uuid NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
  plate         text NOT NULL,
  driver_name   text,
  rut           text,
  unit_code     text,                              -- a qué depto vino
  access_log_id uuid REFERENCES access_log(id) ON DELETE SET NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  created_by    text,                              -- conserje que lo asignó
  released_by   text                               -- quién marcó la salida
);

-- La regla que hace confiable todo el módulo: un estacionamiento no
-- puede tener dos autos al mismo tiempo. Se impone en la base, no en
-- la aplicación — dos conserjes registrando a la vez no la pueden
-- saltar.
CREATE UNIQUE INDEX IF NOT EXISTS parking_sessions_una_activa
  ON parking_sessions (spot_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS parking_sessions_building_activas
  ON parking_sessions (building_id, ended_at);

CREATE INDEX IF NOT EXISTS parking_sessions_plate
  ON parking_sessions (building_id, plate)
  WHERE ended_at IS NULL;

-- ── 3. RLS: deny-all, igual que el resto ────────────────────────
-- Todo pasa por Server Actions con service role, que filtran por
-- building_id. El navegador no lee estas tablas nunca.
ALTER TABLE parking_spots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_sessions ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── Verificación ────────────────────────────────────────────────
-- Debe devolver rowsecurity = true y cero políticas para ambas:
--
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE tablename IN ('parking_spots', 'parking_sessions');
--
-- SELECT tablename, policyname FROM pg_policies
--   WHERE tablename IN ('parking_spots', 'parking_sessions');
