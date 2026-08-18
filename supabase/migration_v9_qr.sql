-- ================================================================
-- PORTEX · Migración v9 — Pase con QR y código
-- Correr en: Supabase Dashboard → SQL Editor
--
-- El pase anticipado ya existía (el residente avisa "hoy viene Juan" y el
-- conserje lo encuentra por RUT). Esto le agrega dos formas de presentarlo
-- sin depender de que la visita ande con el carnet a mano:
--
--   · QR    → el conserje lo escanea con la cámara de la tablet
--   · Código de 6 dígitos → la visita lo dice y el conserje lo digita
--
-- Los dos apuntan al mismo pase. El código existe porque la cámara falla:
-- tablet vieja, permiso denegado, poca luz, pantalla rota del visitante.
-- ================================================================

ALTER TABLE visit_passes
  -- Secreto que viaja dentro del QR. Es opaco a propósito: quien lo lea con
  -- otra app no ve el nombre del residente ni el departamento.
  ADD COLUMN IF NOT EXISTS token text,
  -- Los 6 dígitos que se dicen en voz alta.
  ADD COLUMN IF NOT EXISTS code  text;

-- El código se dicta y se digita: tiene que ser único entre los pases
-- vigentes del edificio, no para siempre. Los usados se reciclan.
CREATE UNIQUE INDEX IF NOT EXISTS visit_passes_code_activo
  ON visit_passes (building_id, code)
  WHERE status = 'activo' AND code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS visit_passes_token_unico
  ON visit_passes (token)
  WHERE token IS NOT NULL;

-- Los pases creados antes de esta migración siguen funcionando por RUT:
-- se quedan sin QR y sin código, y el residente puede crear uno nuevo.

-- ── Verificación ────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'visit_passes' AND column_name IN ('token', 'code');

SELECT indexname FROM pg_indexes
WHERE tablename = 'visit_passes' AND indexname LIKE '%code%' OR indexname LIKE '%token%';
