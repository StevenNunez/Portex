-- ================================================================
-- PORTEX · Migración v15 — La ficha del personal
-- Correr en: Supabase Dashboard → SQL Editor
--
-- Dos cosas que faltaban:
--
-- 1. La ficha del trabajador tenía nombre, RUT, rol y un "contacto" suelto.
--    Cuando el administrador necesita ubicar a alguien un domingo —o avisarle
--    a un familiar porque se accidentó en el turno— eso no alcanza.
--
-- 2. **No había forma de saber qué ficha es de qué cuenta.** El conserje
--    entraba a Portex con su usuario, pero su ficha de personal era una fila
--    suelta sin dueño: no podía ver ni corregir sus propios datos, y el
--    administrador terminaba manteniéndolos a mano.
-- ================================================================

ALTER TABLE staff
  -- El correo con el que entra a Portex. Es además la llave para reconocer su
  -- cuenta cuando acepta la invitación.
  ADD COLUMN IF NOT EXISTS email text,
  -- A quién llamar si algo pasa en el turno. Van separados y no en un texto
  -- libre porque a las tres de la mañana nadie interpreta "Sra. Rosa 9-8765".
  ADD COLUMN IF NOT EXISTS emergency_name text,
  ADD COLUMN IF NOT EXISTS emergency_phone text,
  -- La cuenta de Portex de esta persona, cuando ya entró.
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Una cuenta no puede ser dueña de dos fichas en el mismo edificio.
CREATE UNIQUE INDEX IF NOT EXISTS staff_profile_unico_idx
  ON staff (building_id, profile_id)
  WHERE profile_id IS NOT NULL;

-- Para reconocer la ficha por su correo al momento de aceptar la invitación.
CREATE INDEX IF NOT EXISTS staff_email_idx
  ON staff (building_id, lower(email))
  WHERE email IS NOT NULL;

-- ── Comprobación ────────────────────────────────────────────────
-- Deben salir cuatro filas.
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'staff'
   AND column_name IN ('email', 'emergency_name', 'emergency_phone', 'profile_id')
 ORDER BY column_name;
