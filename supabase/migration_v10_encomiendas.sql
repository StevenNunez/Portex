-- ================================================================
-- PORTEX · Migración v10 — Encomiendas con dueño y retiro verificado
-- Correr en: Supabase Dashboard → SQL Editor
--
-- Hasta ahora la encomienda era una línea en la bitácora y "pendiente"
-- se calculaba comparando textos ("Encomienda retirada · {id}"). Eso
-- alcanzaba para contar, pero no para lo que el edificio necesita de
-- verdad:
--
--   · que al departamento le avisen que llegó su paquete
--   · que quien lo retira demuestre que le corresponde
--   · que quede escrito quién se lo llevó y con qué autorización
--
-- `access_log` sigue siendo la bitácora del movimiento (igual que con
-- los estacionamientos); esta tabla es el estado de la encomienda.
-- ================================================================

CREATE TABLE IF NOT EXISTS parcels (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id    uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,

  -- A quién le llegó. `unit_code` se guarda además del id porque la
  -- encomienda es del departamento: si el residente se muda, el paquete
  -- que quedó en portería sigue siendo del 1204.
  resident_id    uuid REFERENCES residents(id) ON DELETE SET NULL,
  unit_code      text,

  courier        text,          -- Chilexpress, Amazon, Rappi…
  description    text,          -- lo que anotó el conserje

  -- Las dos formas de retirarla. El código se dicta, el token va en el QR.
  code           text NOT NULL,
  token          text NOT NULL,

  status         text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'retirada')),

  received_at    timestamptz NOT NULL DEFAULT now(),
  received_by    text,
  access_log_id  uuid REFERENCES access_log(id) ON DELETE SET NULL,
  notified_at    timestamptz,   -- cuándo se le avisó a la unidad

  picked_up_at   timestamptz,
  picked_up_by   text,          -- nombre de quien se la llevó
  picked_up_rut  text,
  -- 'codigo'/'qr' = la persona demostró que le correspondía.
  -- 'manual'      = el conserje la entregó igual y quedó dicho.
  pickup_method  text CHECK (pickup_method IN ('codigo', 'qr', 'manual')),
  pickup_log_id  uuid REFERENCES access_log(id) ON DELETE SET NULL,

  created_at     timestamptz NOT NULL DEFAULT now()
);

-- El código se dicta en voz alta: tiene que ser único entre las que
-- están esperando, no para siempre. Las retiradas lo liberan.
CREATE UNIQUE INDEX IF NOT EXISTS parcels_code_pendiente
  ON parcels (building_id, code) WHERE status = 'pendiente';

CREATE UNIQUE INDEX IF NOT EXISTS parcels_token_unico ON parcels (token);

CREATE INDEX IF NOT EXISTS parcels_building_status
  ON parcels (building_id, status, received_at DESC);

CREATE INDEX IF NOT EXISTS parcels_unidad
  ON parcels (building_id, unit_code, status);

-- ── Traer las que ya estaban esperando ──────────────────────────
-- Las encomiendas pendientes de hoy viven en la bitácora. Se copian acá
-- para que nadie pierda su paquete con el cambio. Los códigos migrados
-- van numerados (200001, 200002…) para que no choquen entre ellos; los
-- nuevos se sortean al azar.
INSERT INTO parcels (
  building_id, resident_id, unit_code, courier, description,
  code, token, status, received_at, received_by, access_log_id
)
SELECT
  p.building_id,
  r.id,
  p.unit,
  NULLIF(regexp_replace(coalesce(p.context, ''), '^Encomienda\s*·?\s*', ''), ''),
  p.context,
  lpad((200000 + row_number() OVER (ORDER BY p.recorded_at))::text, 6, '0'),
  replace(gen_random_uuid()::text, '-', ''),
  'pendiente',
  p.recorded_at,
  p.recorded_by,
  p.id
FROM access_log p
LEFT JOIN residents r
  ON r.building_id = p.building_id AND r.unit_code = p.unit
WHERE p.type = 'parcel'
  AND p.recorded_at > now() - interval '30 days'
  -- las que ya se retiraron no se migran
  AND NOT EXISTS (
    SELECT 1 FROM access_log o
    WHERE o.building_id = p.building_id
      AND o.type = 'out'
      AND o.context = 'Encomienda retirada · ' || p.id::text
  )
  -- y no duplicar si esta migración ya se corrió
  AND NOT EXISTS (
    SELECT 1 FROM parcels x WHERE x.access_log_id = p.id
  );

ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;

-- ── Verificación ────────────────────────────────────────────────
SELECT status, count(*) FROM parcels GROUP BY status;
SELECT unit_code, courier, code, received_at FROM parcels
WHERE status = 'pendiente' ORDER BY received_at DESC LIMIT 10;
