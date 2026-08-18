-- ================================================================
-- PORTEX · Deduplicar residentes + evitar que vuelva a pasar
-- Correr en: Supabase Dashboard → SQL Editor
--
-- Problema detectado en el demo: el edificio quedó con 24 residentes
-- (12 reales duplicados). Los unit_code de los dos lotes no coincidían
-- exactamente — espacios o separador distinto — así que el seed no los
-- reconoció como existentes. La normalización de abajo los junta.
-- ================================================================

BEGIN;

-- ── 1. Normalizar unit_code ─────────────────────────────────────
-- Espacios duros (NBSP) → espacio normal, colapsar espacios repetidos,
-- recortar puntas y pasar a mayúsculas: "a ·  1204 " → "A · 1204".
UPDATE residents
SET unit_code = upper(
      btrim(
        regexp_replace(
          replace(unit_code, chr(160), ' '),
          '\s+', ' ', 'g'
        )
      )
    );

-- ── 2. Revisar antes de borrar ──────────────────────────────────
-- Descomenta para ver qué se va a eliminar:
-- SELECT unit_code, count(*), array_agg(name) FROM residents
--   GROUP BY building_id, unit_code HAVING count(*) > 1;

-- ── 3. Borrar duplicados, conservando el más antiguo por unidad ──
DELETE FROM residents r
USING residents keep
WHERE r.building_id = keep.building_id
  AND r.unit_code   = keep.unit_code
  AND (keep.created_at, keep.id) < (r.created_at, r.id);

-- ── 4. Índice único: una unidad, un registro por edificio ───────
-- Esto además hace segura la importación por Excel: si mañana se
-- cambia el insert por un upsert, este índice es el que lo sostiene.
CREATE UNIQUE INDEX IF NOT EXISTS residents_building_unit_unique
  ON residents (building_id, unit_code);

COMMIT;

-- ── 5. Verificación (debe devolver 12 y ninguna fila duplicada) ──
SELECT count(*) AS residentes FROM residents
  WHERE building_id = '00000000-0000-0000-0000-000000000001';

SELECT unit_code, count(*) AS veces FROM residents
  WHERE building_id = '00000000-0000-0000-0000-000000000001'
  GROUP BY unit_code HAVING count(*) > 1;
