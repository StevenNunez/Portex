"use server";

import { buscarUsuarioPorEmail, generarEnlaceDeAcceso } from "@/lib/auth-admin";
import { enviarRecuperacion } from "@/lib/email";

/**
 * "Olvidé mi contraseña", mandado por la app y no por Supabase.
 *
 * Antes esto era `resetPasswordForEmail` desde el navegador: el correo salía
 * del SMTP configurado en el dashboard, con la plantilla pegada a mano ahí.
 * Ahora el token lo emite `generate_link` —sin despachar nada— y el sobre lo
 * manda `lib/email.ts` con la plantilla del repo, igual que la invitación.
 *
 * Es la única acción de la app que puede llamar cualquiera, sin sesión. De ahí
 * las dos precauciones de abajo.
 */

/**
 * Freno mínimo contra el que apriete el botón cien veces (o le llene la
 * bandeja a otro). Vive en memoria del proceso: en Fluid Compute la instancia
 * se reutiliza entre pedidos, así que frena de verdad casi siempre, pero no es
 * una garantía —si esto llega a importar de verdad, el freno va en la base—.
 * Supabase traía el suyo; al mandar nosotros, había que reponerlo.
 */
const ultimoEnvio = new Map<string, number>();
const ESPERA_MS = 60_000;

export async function pedirRecuperacion(input: {
  email: string;
}): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Ese correo no parece válido" };
  }

  const ahora = Date.now();
  for (const [clave, cuando] of ultimoEnvio) {
    if (ahora - cuando > ESPERA_MS) ultimoEnvio.delete(clave);
  }

  // Pidió hace menos de un minuto: se responde que sí igual. Decir "espera"
  // sería contar que ese correo existe.
  const previo = ultimoEnvio.get(email);
  if (previo && ahora - previo < ESPERA_MS) return { ok: true };
  ultimoEnvio.set(email, ahora);

  // Nunca se dice si el correo tiene cuenta o no: eso convierte esta pantalla
  // en un buscador de quién vive en el edificio. La respuesta es siempre la
  // misma, y la pantalla dice "si ese correo tiene cuenta, te llega el enlace".
  const cuenta = await buscarUsuarioPorEmail(email);
  if (!cuenta) return { ok: true };

  const enlace = await generarEnlaceDeAcceso({ tipo: "recovery", email });
  if (!enlace.ok) return { ok: true };

  try {
    await enviarRecuperacion({ to: email, url: enlace.url });
  } catch {
    return {
      ok: false,
      error: "No pudimos enviar el correo. Intenta de nuevo en unos minutos.",
    };
  }

  return { ok: true };
}
