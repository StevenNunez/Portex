-- ================================================================
-- PORTEX · Migración v5 — El RUT como identidad
-- Correr en: Supabase Dashboard → SQL Editor
--
-- "Buenos días, su RUT por favor" → 26.011.410-7 → el sistema ya sabe
-- que es Juan Pérez y que va al 932.
--
-- Hasta ahora el RUT viajaba adentro del texto de `context`
-- ("Visita · 26.011.410-7"), o sea no se podía buscar. Acá pasa a ser
-- una columna propia, normalizada (sin puntos ni guion, K mayúscula).
-- ================================================================

BEGIN;

-- ── 1. El RUT sale del texto y pasa a ser dato ──────────────────
ALTER TABLE access_log
  ADD COLUMN IF NOT EXISTS rut text;

-- Rescatar los RUT que ya están escritos dentro del contexto
UPDATE access_log
SET rut = upper(regexp_replace(
      substring(context FROM '[0-9]{1,2}[.]?[0-9]{3}[.]?[0-9]{3}[-]?[0-9kK]'),
      '[^0-9kK]', '', 'g'
    ))
WHERE rut IS NULL
  AND context ~ '[0-9]{1,2}[.]?[0-9]{3}[.]?[0-9]{3}[-]?[0-9kK]';

CREATE INDEX IF NOT EXISTS access_log_building_rut
  ON access_log (building_id, rut);

-- ── 2. Visitantes frecuentes: identificados por RUT ─────────────
-- El padrón de recurrentes deja de depender del nombre escrito a mano.
ALTER TABLE frequent_visitors
  ADD COLUMN IF NOT EXISTS visit_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_unit   text,
  ADD COLUMN IF NOT EXISTS kind        text;

-- Normalizar los RUT que ya existen (venían con puntos y guion)
UPDATE frequent_visitors
SET rut = upper(regexp_replace(rut, '[^0-9kK]', '', 'g'))
WHERE rut IS NOT NULL;

-- Si quedaron dos filas con el mismo RUT, conservar la más antigua
DELETE FROM frequent_visitors f
USING frequent_visitors keep
WHERE f.building_id = keep.building_id
  AND f.rut = keep.rut
  AND f.rut IS NOT NULL
  AND (keep.created_at, keep.id) < (f.created_at, f.id);

-- Un RUT, una persona por edificio: esto es lo que hace confiable el
-- reconocimiento y permite el upsert en cada registro.
CREATE UNIQUE INDEX IF NOT EXISTS frequent_visitors_building_rut_unique
  ON frequent_visitors (building_id, rut)
  WHERE rut IS NOT NULL;

-- ── 3. Los pases del residente también se validan por RUT ───────
UPDATE visit_passes
SET visitor_rut = upper(regexp_replace(visitor_rut, '[^0-9kK]', '', 'g'))
WHERE visitor_rut IS NOT NULL;

CREATE INDEX IF NOT EXISTS visit_passes_rut
  ON visit_passes (building_id, visitor_rut);

UPDATE access_requests
SET visitor_rut = upper(regexp_replace(visitor_rut, '[^0-9kK]', '', 'g'))
WHERE visitor_rut IS NOT NULL;

COMMIT;

-- ── 4. Verificación ─────────────────────────────────────────────
SELECT count(*) FILTER (WHERE rut IS NOT NULL) AS registros_con_rut,
       count(*)                                AS registros_totales
FROM access_log;

SELECT name, rut, default_unit, visit_count
FROM frequent_visitors
WHERE building_id = '00000000-0000-0000-0000-000000000001'
ORDER BY name;
