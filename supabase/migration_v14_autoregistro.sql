-- ================================================================
-- PORTEX · Migración v14 — El código del edificio
-- Correr en: Supabase Dashboard → SQL Editor
--
-- El problema que resuelve: ningún administrador tiene los 312 correos de su
-- edificio. Mientras el acceso dependa de que alguien los junte en un Excel,
-- la app no se llena nunca.
--
-- Con esto, el conserje pega un cartel con un QR en el ascensor. El vecino lo
-- escanea, dice quién es y en qué departamento vive, y **el conserje aprueba**
-- desde la pantalla de portería — que es quien de verdad sabe quién vive en el
-- 1204. Recién ahí sale la invitación.
--
-- La aprobación no es un trámite: es la única barrera. El código va pegado en
-- un ascensor, así que cualquiera que pase por ahí puede pedir acceso. Lo que
-- hace que eso sea seguro es que un humano que conoce a los vecinos mira la
-- solicitud antes de que exista cuenta alguna.
-- ================================================================

-- ── 1. El código que va en el cartel ────────────────────────────
ALTER TABLE buildings
  -- Ocho caracteres de un alfabeto sin letras que se confundan (nada de
  -- O/0, I/1/L): el código también se dicta por teléfono y se tipea a mano
  -- cuando la cámara no coopera.
  ADD COLUMN IF NOT EXISTS join_code text,
  -- Cuándo se generó el actual. Regenerarlo invalida los carteles viejos, y
  -- hay que poder decir desde cuándo.
  ADD COLUMN IF NOT EXISTS join_code_updated_at timestamptz;

-- Dos edificios no pueden compartir código: es lo único que identifica al
-- edificio en una URL pública.
CREATE UNIQUE INDEX IF NOT EXISTS buildings_join_code_key
  ON buildings (join_code)
  WHERE join_code IS NOT NULL;

-- ── 2. Las solicitudes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resident_signups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id  uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,

  -- Lo que escribió el vecino. `unit_code` es texto libre a propósito: hay
  -- edificios recién creados cuyo padrón está vacío, y justamente ahí es
  -- donde este flujo más sirve. Si al aprobar la unidad no existe, se crea.
  unit_code    text NOT NULL,
  name         text NOT NULL,
  email        text NOT NULL,
  phone        text,

  status       text NOT NULL DEFAULT 'pendiente'
                 CHECK (status IN ('pendiente', 'aprobada', 'rechazada')),

  -- Con qué fila del padrón terminó ligada, una vez aprobada.
  resident_id  uuid REFERENCES residents(id) ON DELETE SET NULL,

  -- Quién la revisó. Se guarda el nombre y no el id porque esto se lee como
  -- bitácora: importa "la aprobó Rodrigo", no a qué perfil apuntaba.
  reviewed_by  text,
  reviewed_at  timestamptz,
  -- Por qué se rechazó, cuando el conserje quiere dejarlo dicho.
  note         text,

  created_at   timestamptz NOT NULL DEFAULT now()
);

-- La consulta de la portería: las pendientes de este edificio, las más
-- nuevas arriba.
CREATE INDEX IF NOT EXISTS resident_signups_pendientes_idx
  ON resident_signups (building_id, created_at DESC)
  WHERE status = 'pendiente';

-- Un mismo correo no puede tener dos solicitudes esperando en el mismo
-- edificio. Sin esto, apretar dos veces el botón le deja al conserje la
-- misma persona repetida, y recargar la página es una forma de inundarlo.
CREATE UNIQUE INDEX IF NOT EXISTS resident_signups_pendiente_unica_idx
  ON resident_signups (building_id, lower(email))
  WHERE status = 'pendiente';

-- ── 3. Permisos ─────────────────────────────────────────────────
-- Igual que el resto de las tablas: nadie entra por PostgREST. Todo pasa por
-- las acciones del servidor, que usan la llave de servicio y revisan quién
-- pide qué. Una tabla que recibe escrituras de gente sin sesión no puede
-- quedar abierta al cliente.
ALTER TABLE resident_signups ENABLE ROW LEVEL SECURITY;

-- ── Comprobación ────────────────────────────────────────────────
-- 1) Debe devolver join_code y join_code_updated_at.
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'buildings'
   AND column_name IN ('join_code', 'join_code_updated_at')
 ORDER BY column_name;

-- 2) Debe devolver una fila con rowsecurity = true.
SELECT tablename, rowsecurity
  FROM pg_tables
 WHERE tablename = 'resident_signups';
