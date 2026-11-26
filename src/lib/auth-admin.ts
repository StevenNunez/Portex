import "server-only";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import { appUrl } from "@/lib/app-url";
import { leerInvitacion, type DatosInvitacion } from "@/lib/invitacion-datos";
import { fallo } from "@/lib/errores-servidor";

/** Lo que hace falta saber de una cuenta que ya existe. */
export type CuentaExistente = {
  id: string;
  email: string;
  /**
   * Si alguna vez inició sesión. Distingue a quien ya usa Portex —y por lo
   * tanto tiene contraseña— de quien fue invitado y nunca abrió el correo:
   * al primero no se le manda nada, al segundo hay que reenviarle.
   */
  entroAlgunaVez: boolean;
};

/**
 * Buscar una cuenta por su correo.
 *
 * `supabase.auth.admin` no expone esto: `listUsers` solo pagina, así que
 * encontrar a alguien obligaba a recorrer todos los usuarios del proyecto.
 * El endpoint de GoTrue sí acepta `?filter=`, y es lo que se usa acá.
 *
 * Hace falta cuando el administrador invita a alguien que **ya tiene cuenta**
 * (por ejemplo, porque también arrienda en otra unidad): hay que ligar la
 * cuenta existente a la unidad. Antes eso se resolvía buscando el perfil por
 * `full_name`, lo que en un edificio con dos "Juan Pérez" ligaba el
 * departamento a la persona equivocada.
 */
export async function buscarUsuarioPorEmail(
  email: string
): Promise<CuentaExistente | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
  );

  if (!res.ok) return null;

  const datos = (await res.json()) as {
    users?: { id: string; email?: string; last_sign_in_at?: string | null }[];
  };
  const objetivo = email.trim().toLowerCase();

  // El filtro es una búsqueda parcial: "ana@mail.com" también trae
  // "mariana@mail.com". La coincidencia exacta la hacemos acá.
  const exacto = (datos.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === objetivo
  );

  if (!exacto) return null;

  return {
    id: exacto.id,
    email: exacto.email ?? objetivo,
    entroAlgunaVez: Boolean(exacto.last_sign_in_at),
  };
}

/** Los tres enlaces de un solo uso que sabe canjear `/invitacion`. */
export type TipoDeEnlace = "invite" | "magiclink" | "recovery";

/**
 * Generar el enlace de acceso **sin que Supabase mande el correo**.
 *
 * `inviteUserByEmail` y `resetPasswordForEmail` hacen dos cosas a la vez: crean
 * el token y despachan el sobre. Eso ataba tres cosas al dashboard de Supabase:
 * el texto del correo (había que pegar el HTML a mano cada vez que se tocaba),
 * el límite de correos por hora de Auth —que revienta con una invitación masiva
 * de 300 departamentos— y la entrega, que no podíamos ni mirar.
 *
 * `generate_link` solo emite el token. El correo lo manda la app con su propio
 * SMTP (`lib/email.ts`), con la plantilla versionada en el repo.
 *
 * El enlace apunta a `/invitacion?token_hash=…`, **nunca** al `action_link` que
 * devuelve Supabase: ese gasta el token en el primer GET, y Gmail, Outlook Safe
 * Links y los antivirus corporativos abren los enlaces del correo para
 * revisarlos antes de que la persona los toque.
 */
export async function generarEnlaceDeAcceso(opciones: {
  tipo: TipoDeEnlace;
  email: string;
  /**
   * El nombre que se muestra mientras la persona termina de crear su cuenta.
   * Va a `user_metadata`, que es solo de presentación: el rol y la
   * organización van aparte, con `grabarInvitacion`.
   */
  nombre?: string | null;
}): Promise<
  | { ok: true; url: string; usuarioId: string | null }
  | { ok: false; error: string; yaTieneCuenta?: boolean }
> {
  const db = createServiceClient();
  const email = opciones.email.trim().toLowerCase();
  const redirectTo = `${appUrl()}/update-password`;

  const respuesta =
    opciones.tipo === "invite"
      ? await db.auth.admin.generateLink({
          type: "invite",
          email,
          options: {
            data: opciones.nombre ? { full_name: opciones.nombre } : undefined,
            redirectTo,
          },
        })
      : await db.auth.admin.generateLink({
          type: opciones.tipo,
          email,
          options: { redirectTo },
        });

  if (respuesta.error) {
    const mensaje = respuesta.error.message;
    const yaTieneCuenta = /already been registered|already registered|email_exists/i.test(mensaje);
    return {
      ok: false,
      // "Ya tiene cuenta" lo resuelve quien llama; lo demás se anota y a la
      // pantalla va en castellano.
      error: yaTieneCuenta ? "Ese correo ya tiene una cuenta en Portex" : await fallo("generarEnlaceDeAcceso", respuesta.error),
      yaTieneCuenta,
    };
  }

  const hash = respuesta.data.properties?.hashed_token;
  if (!hash) {
    return { ok: false, error: await fallo("generarEnlaceDeAcceso", new Error("Supabase no devolvió el token del enlace")) };
  }

  const url =
    `${appUrl()}/invitacion?token_hash=${encodeURIComponent(hash)}` +
    `&type=${opciones.tipo}&email=${encodeURIComponent(email)}`;

  return { ok: true, url, usuarioId: respuesta.data.user?.id ?? null };
}

/**
 * Dejar escrito, donde el usuario no lo puede tocar, a qué organización y con
 * qué rol se lo invitó.
 *
 * Va a `app_metadata` (solo lo escribe la clave de servicio) y no a
 * `user_metadata`, que el propio usuario puede reescribir desde el navegador;
 * ver `lib/invitacion-datos.ts`. También deja el perfil con ese rol y esa
 * organización, que es lo que antes hacía el trigger `handle_new_user`
 * leyendo `user_metadata` —y por eso se podía falsear—.
 *
 * `soloSiFalta` es para el reenvío: una invitación pendiente ya tiene sus
 * datos y reenviar el correo no los cambia. Si faltan (una invitación de
 * antes de este cambio, o un primer intento que se cortó), se graban.
 */
export async function grabarInvitacion(
  usuarioId: string,
  datos: DatosInvitacion,
  opciones: { soloSiFalta?: boolean } = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createServiceClient();

  if (opciones.soloSiFalta) {
    const { data } = await db.auth.admin.getUserById(usuarioId);
    if (leerInvitacion(data.user)) return { ok: true };
  }

  // GoTrue mezcla `app_metadata` con lo que ya tenía (provider, providers):
  // solo se agrega la llave `invitacion`.
  const { error } = await db.auth.admin.updateUserById(usuarioId, {
    app_metadata: { invitacion: datos },
  });
  if (error) return { ok: false, error: await fallo("grabarInvitacion", error) };

  const { error: errorPerfil } = await db
    .from("profiles")
    .update({ role: datos.role, organization_id: datos.organization_id })
    .eq("id", usuarioId);
  if (errorPerfil) return { ok: false, error: errorPerfil.message };

  return { ok: true };
}
