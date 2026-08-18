-- ================================================================
-- PORTEX · Migración v7 — El residente y su estacionamiento
-- Correr en: Supabase Dashboard → SQL Editor
-- (después de migration_v6_estacionamientos.sql)
--
-- Dos cosas que el residente puede hacer con su estacionamiento:
--
--   1. Prestarlo. "Me voy 5 días, que lo usen las visitas". Los cupos
--      de visita son siempre pocos; los de los deptos pasan semanas
--      vacíos. Esto conecta las dos cosas.
--   2. Decir qué autos son suyos, para que la portería sepa de quién
--      es el auto mal estacionado sin tener que preguntar puerta por
--      puerta.
-- ================================================================

BEGIN;

-- ── 1. Préstamo del estacionamiento ─────────────────────────────
-- Se guarda en el propio estacionamiento y no en una tabla aparte
-- porque solo hay un préstamo vigente a la vez: prestar de nuevo
-- reemplaza al anterior.
ALTER TABLE parking_spots
  ADD COLUMN IF NOT EXISTS lent_until timestamptz,
  ADD COLUMN IF NOT EXISTS lent_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lent_at    timestamptz;

-- Prestar un cupo que ya es de visita no significa nada.
ALTER TABLE parking_spots
  DROP CONSTRAINT IF EXISTS parking_spots_prestamo_solo_residente;
ALTER TABLE parking_spots
  ADD CONSTRAINT parking_spots_prestamo_solo_residente CHECK (
    lent_until IS NULL OR kind = 'residente'
  );

-- Buscar los prestados vigentes es la consulta caliente: la hace la
-- portería cada vez que llega un auto.
CREATE INDEX IF NOT EXISTS parking_spots_prestados
  ON parking_spots (building_id, lent_until)
  WHERE lent_until IS NOT NULL;

-- ── 2. Los autos de cada departamento ───────────────────────────
CREATE TABLE IF NOT EXISTS resident_vehicles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id)  ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES residents(id)  ON DELETE CASCADE,
  plate       text NOT NULL,          -- normalizada: sin puntos ni guiones
  model       text,                   -- "Toyota Yaris gris"
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Una patente pertenece a un solo departamento dentro del edificio.
  -- Sin esto, dos vecinos podrían reclamar el mismo auto y la portería
  -- no sabría a quién llamar.
  CONSTRAINT resident_vehicles_plate_unique UNIQUE (building_id, plate)
);

CREATE INDEX IF NOT EXISTS resident_vehicles_resident
  ON resident_vehicles (resident_id);

-- ── 3. RLS: deny-all, igual que el resto ────────────────────────
-- Todo pasa por Server Actions con service role, que verifican que el
-- departamento sea del residente que pide el cambio.
ALTER TABLE resident_vehicles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── Verificación ────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'parking_spots' AND column_name LIKE 'lent%';
--
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE tablename = 'resident_vehicles';
