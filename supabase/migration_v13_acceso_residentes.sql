-- ================================================================
-- PORTEX · Migración v13 — Acceso de los residentes
-- Correr en: Supabase Dashboard → SQL Editor
--
-- El administrador ya podía invitar a un residente al portal, pero después
-- no había forma de saber a quién había invitado. Con 312 departamentos eso
-- significa no saber nunca si el edificio está usando la app o no: la lista
-- se ve igual el primer día que el último.
--
-- Estas dos columnas son la memoria de esa invitación. El "ya entró" no se
-- guarda acá: eso se sabe mirando `resident_members`, que es donde queda el
-- vínculo real entre la cuenta y el departamento cuando la persona crea su
-- contraseña.
-- ================================================================

ALTER TABLE residents
  -- A qué correo se le mandó. Va aparte de `contact` a propósito: `contact`
  -- es texto libre —a veces un teléfono, a veces dos cosas separadas por
  -- coma— y acá necesitamos el correo exacto con el que se creó la cuenta,
  -- porque es la llave para reconocerla si vuelve a invitarse.
  ADD COLUMN IF NOT EXISTS invite_email text,
  -- Cuándo se mandó la última invitación. Sirve para dos cosas: mostrar
  -- "invitado hace 3 días" y no volver a mandarle a quien ya tiene cuenta.
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;

-- La pantalla de residentes pregunta siempre por edificio y ordena por
-- unidad; el índice parcial es para la consulta de "a quiénes les falta
-- acceso", que es la que corre el botón de invitación masiva.
CREATE INDEX IF NOT EXISTS residents_sin_invitar_idx
  ON residents (building_id)
  WHERE invited_at IS NULL;

-- ── Comprobación ────────────────────────────────────────────────
-- Debe devolver dos filas: invite_email (text) e invited_at (timestamptz).
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'residents'
   AND column_name IN ('invite_email', 'invited_at')
 ORDER BY column_name;
