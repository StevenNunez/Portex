-- ================================================================
-- PORTEX · Migración v11 — Servicios y avisos del edificio
-- Correr en: Supabase Dashboard → SQL Editor
--
-- Llega VTR a instalar internet en el 1204: eso le importa a una unidad.
-- Llega el de la empresa sanitaria a cortar el agua de 14:00 a 17:00: eso
-- le importa a las 312. Hoy los dos entran igual, como "Proveedor" con un
-- texto libre, y nadie se entera de nada.
--
-- Un aviso es eso: algo que el edificio tiene que saber, con a quién le
-- toca y hasta cuándo dura.
-- ================================================================

CREATE TABLE IF NOT EXISTS notices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id   uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,

  kind          text NOT NULL DEFAULT 'otro'
    CHECK (kind IN ('agua', 'luz', 'gas', 'internet', 'ascensor',
                    'fumigacion', 'obra', 'aseo', 'otro')),

  title         text NOT NULL,
  body          text,

  -- A quién le toca. 'unidad' exige `unit_code`.
  scope         text NOT NULL DEFAULT 'edificio'
    CHECK (scope IN ('edificio', 'unidad')),
  unit_code     text,

  -- Ventana del trabajo. `ends_at` es lo que decide si el aviso sigue
  -- vigente: un corte de agua que ya terminó no tiene por qué seguir
  -- ocupando la pantalla del residente.
  starts_at     timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz,

  -- 'admin'    → lo programó el administrador ("mañana cortan el agua")
  -- 'porteria' → lo generó el conserje al registrar al proveedor que
  --              llegó a hacer el trabajo
  source        text NOT NULL DEFAULT 'admin'
    CHECK (source IN ('admin', 'porteria')),
  access_log_id uuid REFERENCES access_log(id) ON DELETE SET NULL,

  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by_name text,
  notified_at     timestamptz,
  cancelled_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notices_unidad_con_codigo
    CHECK (scope = 'edificio' OR unit_code IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS notices_vigentes
  ON notices (building_id, ends_at DESC NULLS FIRST, starts_at DESC);

CREATE INDEX IF NOT EXISTS notices_unidad
  ON notices (building_id, unit_code);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- ── Verificación ────────────────────────────────────────────────
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'notices' ORDER BY ordinal_position;
