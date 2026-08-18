-- ================================================================
-- PORTEX · Migración v8 — Asistencia del personal
-- Correr en: Supabase Dashboard → SQL Editor
--
-- El condominio paga jardinero, aseo y mantención por horas, y hoy eso
-- se controla con la memoria del conserje. Acá cada persona marca con su
-- RUT en la tablet de portería: queda la hora real de entrada y salida,
-- el atraso contra su turno programado y las horas del mes.
--
-- Una jornada = una fila. Se abre al marcar entrada y se cierra al
-- marcar salida; mientras `checked_out_at` sea NULL, la persona está
-- adentro.
-- ================================================================

-- ── 1. Jornadas ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id     uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  staff_id        uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  -- El día **en Chile** en que empezó la jornada. Se guarda calculado
  -- porque el turno de noche cruza la medianoche y no se puede derivar
  -- de `checked_in_at` sin volver a resolver la zona horaria.
  date            date NOT NULL,

  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  checked_out_at  timestamptz,

  -- Turno programado que esta jornada vino a cubrir, si había uno.
  shift_id        uuid REFERENCES shifts(id) ON DELETE SET NULL,

  -- Se calculan al marcar, no al mirar el reporte: el turno pudo
  -- cambiarse después y el atraso de ese día ya ocurrió.
  late_minutes        int,   -- NULL = no tenía turno con qué comparar
  early_leave_minutes int,

  -- 'tablet'  → la persona marcó con su RUT en portería
  -- 'sesion'  → el conserje inició/cerró turno con su cuenta
  -- 'admin'   → lo cerró el administrador a mano
  source          text NOT NULL DEFAULT 'tablet'
    CHECK (source IN ('tablet', 'sesion', 'admin')),
  closed_source   text CHECK (closed_source IN ('tablet', 'sesion', 'admin')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Nadie puede tener dos jornadas abiertas a la vez. Es la misma
-- protección del índice de estacionamientos: si dos toques llegan
-- juntos, el segundo falla con 23505 en vez de duplicar la jornada.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_una_abierta
  ON attendance (staff_id) WHERE checked_out_at IS NULL;

CREATE INDEX IF NOT EXISTS attendance_building_date
  ON attendance (building_id, date DESC);

CREATE INDEX IF NOT EXISTS attendance_staff_date
  ON attendance (staff_id, date DESC);

-- ── 2. RLS ──────────────────────────────────────────────────────
-- Deny-all como el resto: todo pasa por Server Actions con service
-- role, que filtran por edificio.
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- ── 3. Verificación ─────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'attendance'
ORDER BY ordinal_position;

SELECT indexname FROM pg_indexes
WHERE tablename = 'attendance';
