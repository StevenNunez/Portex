-- ================================================================
-- PORTEX · Migration v16 — Nadie puede darse rol ni organización
-- Correr en: Supabase Dashboard → SQL Editor (una sola vez)
-- ================================================================
--
-- Había tres caminos para que cualquier persona con una cuenta quedara
-- como administrador de un condominio ajeno:
--
--   1. La política "users_update_own_profile" dejaba hacer UPDATE de su
--      propio perfil desde el navegador, incluidas las columnas `role` y
--      `organization_id`.
--   2. El trigger `handle_new_user` copiaba el rol y la organización desde
--      `raw_user_meta_data`, que es lo que manda el navegador en el `data`
--      del `signUp`.
--   3. `syncInvitedProfile` leía la invitación desde `user_metadata`, que
--      el usuario reescribe con `supabase.auth.updateUser({ data })`.
--
-- El 3 se cerró en el código: la invitación ahora vive en `app_metadata`,
-- que solo escribe la clave de servicio. Esta migración cierra el 1 y el 2,
-- y copia a `app_metadata` las invitaciones que ya estaban mandadas.

-- ── 1. Sin UPDATE de perfiles desde el navegador ─────────────────
-- Ninguna pantalla lo usa: el nombre se guarda con la clave de servicio
-- (`guardarMiCuenta`) y el perfil del invitado también (`syncInvitedProfile`).
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;

-- ── 2. El trigger ya no cree lo que manda el navegador ───────────
-- Toda cuenta nace sin organización y como "admin" (el valor por defecto de
-- la columna): así es quien se registra para dar de alta su condominio, y el
-- onboarding le crea la organización. Al invitado lo completa el servidor
-- (`grabarInvitacion`, en `lib/auth-admin.ts`) justo después de crear la
-- cuenta. El nombre sí se copia: es solo de presentación.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 3. Las invitaciones que ya estaban mandadas ──────────────────
-- Antes de este cambio la invitación quedaba en `raw_user_meta_data`. Para
-- que esos enlaces sigan sirviendo, se copia a `raw_app_meta_data`, pero
-- solo cuando hay constancia de que el condominio invitó a ese correo:
-- una ficha de personal con ese correo (conserje) o una unidad del padrón
-- invitada a ese correo (residente). Lo que alguien haya escrito en su
-- propio `user_metadata` sin invitación no pasa.

UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('invitacion', jsonb_strip_nulls(jsonb_build_object(
       'role',            u.raw_user_meta_data ->> 'role',
       'organization_id', u.raw_user_meta_data ->> 'organization_id',
       'full_name',       u.raw_user_meta_data ->> 'full_name',
       'resident_id',     u.raw_user_meta_data ->> 'resident_id'
     )))
WHERE NOT (COALESCE(u.raw_app_meta_data, '{}'::jsonb) ? 'invitacion')
  AND u.raw_user_meta_data ->> 'organization_id' IS NOT NULL
  AND (
    -- Conserje: el administrador lo agregó en Personal con este correo.
    (
      u.raw_user_meta_data ->> 'role' IN ('conserje', 'admin')
      AND EXISTS (
        SELECT 1
        FROM staff s
        JOIN buildings b ON b.id = s.building_id
        WHERE lower(s.email) = lower(u.email)
          AND b.organization_id::text = u.raw_user_meta_data ->> 'organization_id'
      )
    )
    OR
    -- Residente: esa unidad del padrón se invitó a este correo.
    (
      u.raw_user_meta_data ->> 'role' = 'residente'
      AND EXISTS (
        SELECT 1
        FROM residents r
        JOIN buildings b ON b.id = r.building_id
        WHERE r.id::text = u.raw_user_meta_data ->> 'resident_id'
          AND lower(r.invite_email) = lower(u.email)
          AND b.organization_id::text = u.raw_user_meta_data ->> 'organization_id'
      )
    )
  );

-- ── 4. Verificación ──────────────────────────────────────────────
-- a) No debe aparecer "users_update_own_profile", solo la de lectura:
--
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';
--
-- b) Quién es admin o conserje de cada organización. Revisar que no haya
--    nadie que no corresponda (una cuenta pudo aprovechar el agujero antes
--    de este cambio):
--
-- SELECT o.name AS organizacion, p.role, u.email, p.full_name, u.created_at
-- FROM profiles p
-- JOIN auth.users u ON u.id = p.id
-- LEFT JOIN organizations o ON o.id = p.organization_id
-- WHERE p.role IN ('admin', 'conserje')
-- ORDER BY o.name, p.role, u.created_at;
