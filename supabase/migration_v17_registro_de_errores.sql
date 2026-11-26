-- ================================================================
-- PORTEX · Migration v17 — Registro de errores
-- Correr en: Supabase Dashboard → SQL Editor (idempotente)
-- ================================================================
--
-- Cuando algo fallaba —una invitación que no salía, una pantalla de la
-- portería que no cargaba— nadie se enteraba salvo que el conserje o el
-- administrador avisaran. Ahora el servidor anota cada error acá (y lo deja
-- en los registros de Vercel), y la primera vez que aparece uno nuevo manda
-- un aviso a Teo Labs.
--
-- UNA FILA POR ERROR, NO POR VEZ. La `huella` agrupa el mismo error (mismo
-- lugar y mismo mensaje, sin números ni identificadores): si la portería
-- falla cien veces se ve una fila con `veces = 100`, y el aviso sale una sola
-- vez. Si un error marcado como resuelto vuelve a aparecer, se reabre y avisa
-- de nuevo.
--
-- QUIÉN LA VE. Nadie desde la API: RLS sin políticas, así que solo la escribe
-- el servidor (clave de servicio) y se revisa en el panel de Supabase.

CREATE TABLE IF NOT EXISTS public.errores (
  huella           text PRIMARY KEY,
  origen           text NOT NULL CHECK (origen IN ('navegador', 'servidor')),
  donde            text NOT NULL,
  mensaje          text NOT NULL,
  detalle          jsonb NOT NULL DEFAULT '{}'::jsonb,
  usuario_id       uuid,
  organizacion_id  uuid,
  veces            integer NOT NULL DEFAULT 1,
  primera_vez      timestamptz NOT NULL DEFAULT now(),
  ultima_vez       timestamptz NOT NULL DEFAULT now(),
  resuelto         boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE public.errores IS
  'Errores de Portex agrupados por huella (lugar + mensaje normalizado). Los escribe el servidor con la clave de servicio. Al arreglar uno, marcar resuelto = true: si vuelve a pasar, se reabre y avisa.';

CREATE INDEX IF NOT EXISTS errores_recientes ON public.errores (resuelto, ultima_vez DESC);

ALTER TABLE public.errores ENABLE ROW LEVEL SECURITY;
-- Sin políticas a propósito.

-- Anota un error y dice si es nuevo (o si vuelve después de resuelto), para
-- que el servidor avise solo esa vez. Una sola sentencia: dos fallos al mismo
-- tiempo no duplican la fila.
CREATE OR REPLACE FUNCTION public.registrar_error(
  p_huella text,
  p_origen text,
  p_donde text,
  p_mensaje text,
  p_detalle jsonb,
  p_usuario_id uuid,
  p_organizacion_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previo boolean;
BEGIN
  SELECT resuelto INTO previo FROM public.errores WHERE huella = p_huella;

  INSERT INTO public.errores (huella, origen, donde, mensaje, detalle, usuario_id, organizacion_id)
  VALUES (p_huella, p_origen, left(p_donde, 300), left(p_mensaje, 2000),
          coalesce(p_detalle, '{}'::jsonb), p_usuario_id, p_organizacion_id)
  ON CONFLICT (huella) DO UPDATE
    SET veces           = public.errores.veces + 1,
        ultima_vez      = now(),
        detalle         = excluded.detalle,
        usuario_id      = coalesce(excluded.usuario_id, public.errores.usuario_id),
        organizacion_id = coalesce(excluded.organizacion_id, public.errores.organizacion_id),
        resuelto        = false;

  -- Nuevo si no existía, o si estaba resuelto y volvió.
  RETURN previo IS NULL OR previo;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_error(text, text, text, text, jsonb, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_error(text, text, text, text, jsonb, uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ── Para revisar ─────────────────────────────────────────────────
-- SELECT donde, mensaje, veces, ultima_vez FROM errores
--   WHERE NOT resuelto ORDER BY ultima_vez DESC;
--
-- Al arreglar uno:  UPDATE errores SET resuelto = true WHERE huella = '…';
