import "server-only";
import { buscarUsuarioPorEmail, generarEnlaceDeAcceso, grabarInvitacion } from "@/lib/auth-admin";
import type { DatosInvitacion } from "@/lib/invitacion-datos";
import { anotarError, esLimiteDeEnvio, LIMITE_DE_ENVIO, mensajeDe } from "@/lib/errores-servidor";
import { enviarInvitacion } from "@/lib/email";

/**
 * Invitar a alguien a Portex: emitir el enlace y mandar el correo.
 *
 * Lo llaman los tres caminos que dan acceso —el residente del padrón, el
 * conserje que se agrega en Personal y el que se invita desde el onboarding—,
 * así que vive acá y no dentro de un archivo `"use server"`: ahí cada export
 * tiene que ser una acción, y esto es lógica compartida.
 *
 * Antes esto era una línea (`auth.admin.inviteUserByEmail`) que creaba la
 * cuenta y mandaba el correo de una sola vez, con la plantilla pegada a mano en
 * el dashboard de Supabase. Ahora son dos pasos separados —token acá, sobre
 * nuestro— y eso permite distinguir los tres casos que antes se confundían en
 * un solo error de "already been registered".
 */
export type ResultadoInvitacion =
  | { estado: "invitado"; usuarioId: string | null }
  | { estado: "reenviado"; usuarioId: string }
  | { estado: "ya-tiene-cuenta"; usuarioId: string }
  | { estado: "error"; error: string };

export async function invitarPorCorreo(datos: {
  email: string;
  nombre?: string | null;
  /** Organización, rol y unidad. Se graban en `app_metadata`, no en `user_metadata`. */
  invitacion: DatosInvitacion;
}): Promise<ResultadoInvitacion> {
  const email = datos.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { estado: "error", error: "Ese correo no parece válido" };
  }

  const cuenta = await buscarUsuarioPorEmail(email);

  // Ya usa Portex —por ejemplo, porque también arrienda en otra unidad del
  // mismo condominio—. No se le manda nada: entra con la contraseña que tiene.
  if (cuenta?.entroAlgunaVez) {
    return { estado: "ya-tiene-cuenta", usuarioId: cuenta.id };
  }

  // Fue invitado y nunca entró. `invite` acá responde "already been
  // registered" y no manda nada: era el agujero por el que el botón de
  // reenviar no reenviaba nada y el administrador creía que sí. Un magic link
  // deja a la persona en la misma pantalla —crear su contraseña— y confirma
  // el correo al usarse, que es lo que necesita quien todavía no lo confirmó.
  if (cuenta) {
    const grabada = await grabarInvitacion(cuenta.id, datos.invitacion, { soloSiFalta: true });
    if (!grabada.ok) return { estado: "error", error: grabada.error };

    const enlace = await generarEnlaceDeAcceso({ tipo: "magiclink", email });
    if (!enlace.ok) return { estado: "error", error: enlace.error };

    const envio = await mandar(email, enlace.url, datos.nombre, true);
    if (envio) return { estado: "error", error: envio };

    return { estado: "reenviado", usuarioId: cuenta.id };
  }

  const enlace = await generarEnlaceDeAcceso({
    tipo: "invite",
    email,
    nombre: datos.invitacion.full_name ?? datos.nombre,
  });

  if (!enlace.ok) {
    // Alguien creó la cuenta entre la búsqueda y esta línea (dos invitaciones
    // apretadas a la vez, o un registro simultáneo). Se resuelve mirando de
    // nuevo, no reintentando a ciegas.
    if (enlace.yaTieneCuenta) {
      const reciente = await buscarUsuarioPorEmail(email);
      if (reciente) return { estado: "ya-tiene-cuenta", usuarioId: reciente.id };
    }
    return { estado: "error", error: enlace.error };
  }

  // Sin esto la cuenta queda creada pero sin organización ni rol, y el enlace
  // no serviría para entrar al condominio. Se graba antes de mandar el correo.
  if (!enlace.usuarioId) {
    await anotarError({ origen: "servidor", donde: "invitarPorCorreo", error: new Error("Supabase no devolvió la cuenta invitada") });
    return { estado: "error", error: "No pudimos crear la invitación. Prueba de nuevo en unos minutos." };
  }
  const grabada = await grabarInvitacion(enlace.usuarioId, datos.invitacion);
  if (!grabada.ok) return { estado: "error", error: grabada.error };

  // Si el correo no sale, la cuenta ya quedó creada. No se deshace: el
  // siguiente intento entra por la rama del reenvío de arriba y esta vez sí
  // llega. Lo que no puede pasar es decirle "invitado" a quien no recibió nada.
  const envio = await mandar(email, enlace.url, datos.nombre, false);
  if (envio) return { estado: "error", error: envio };

  return { estado: "invitado", usuarioId: enlace.usuarioId };
}

/** Manda el sobre. Devuelve el motivo si falló, o `null` si salió. */
async function mandar(
  email: string,
  url: string,
  nombre: string | null | undefined,
  reenvio: boolean
): Promise<string | null> {
  try {
    await enviarInvitacion({ to: email, url, nombre, reenvio });
    return null;
  } catch (e) {
    // Un tope del proveedor no es un error del código: se avisa tal cual para
    // que la invitación masiva se detenga (ver `esLimiteDeEnvio`).
    if (esLimiteDeEnvio(mensajeDe(e))) return LIMITE_DE_ENVIO;
    // El motivo técnico (SMTP, en inglés) queda en el registro de errores.
    await anotarError({ origen: "servidor", donde: "correo invitacion", error: e });
    return "No pudimos enviar el correo de invitación. Prueba de nuevo en unos minutos.";
  }
}
