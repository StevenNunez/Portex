import "server-only";

/**
 * URL pública desde la que se sirve la app.
 *
 * Se usa para armar los enlaces que salen del servidor y vuelven a entrar: la
 * invitación al conserje, el correo de recuperación de clave, el link de la
 * notificación push, el canonical y la imagen que muestra WhatsApp. Si queda
 * mal, el correo igual llega — pero el enlace no lleva a ninguna parte.
 *
 * Ya pasó una vez, el día del primer deploy: `NEXT_PUBLIC_APP_URL` no estaba
 * cargada en Vercel y el sitio en vivo publicó `http://localhost:3000` como su
 * propia dirección: WhatsApp no mostraba la imagen al compartir el link, y las
 * invitaciones habrían llegado con un enlace muerto. Por eso ahora hay tres
 * redes antes de localhost, y localhost ya no se alcanza en producción.
 *
 * Orden de preferencia:
 *  1. NEXT_PUBLIC_APP_URL — el dominio real. Es lo que hay que configurar.
 *  2. VERCEL_PROJECT_PRODUCTION_URL — el dominio de producción del proyecto,
 *     que Vercel expone solo y no cambia entre deploys. Es la red correcta:
 *     un correo enviado desde producción no debería apuntar al hash de un
 *     deploy puntual.
 *  3. VERCEL_URL — el host de *este* deploy. Sirve para los previews.
 *  4. El dominio de abajo, si estamos en producción.
 *  5. localhost:3000 — desarrollo.
 */

/**
 * El dominio de verdad, escrito acá como último recurso.
 *
 * No es configuración disfrazada de código: es la red final para que una
 * invitación jamás salga apuntando a localhost si alguien despliega sin las
 * variables puestas. Si el dominio cambia, se cambia acá y en Vercel.
 */
const DOMINIO_PRODUCCION = "https://portex.teolabs.app";

export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return normalizar(explicit);

  const produccion = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (produccion) return normalizar(`https://${produccion}`);

  const deploy = process.env.VERCEL_URL?.trim();
  if (deploy) return normalizar(`https://${deploy}`);

  // Caer a localhost fuera de desarrollo no es un detalle: son invitaciones
  // que no abren y una tarjeta de WhatsApp que no carga, porque el servidor
  // de WhatsApp se pone a buscar la imagen en su propio localhost. Antes que
  // eso, el dominio conocido — mal configurado sigue siendo mejor que
  // imposible.
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[portex] NEXT_PUBLIC_APP_URL no está configurada: se usa " +
        `${DOMINIO_PRODUCCION} por defecto. Configúrala en Vercel → Settings → ` +
        "Environment Variables si el dominio cambió."
    );
    return DOMINIO_PRODUCCION;
  }

  return "http://localhost:3000";
}

/** Sin barra final: todo lo que se concatena después empieza con "/". */
function normalizar(url: string): string {
  return url.replace(/\/+$/, "");
}
