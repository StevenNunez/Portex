import "server-only";

/**
 * URL pública desde la que se sirve la app.
 *
 * Se usa para armar los enlaces que salen del servidor y vuelven a entrar:
 * la invitación al conserje, el correo de recuperación de clave, el link de
 * la notificación push. Si queda mal, el correo llega igual pero el enlace
 * no lleva a ninguna parte — por eso vale la pena tener un solo lugar donde
 * se decide.
 *
 * Orden de preferencia:
 *  1. NEXT_PUBLIC_APP_URL — el dominio real, es lo que hay que configurar.
 *  2. VERCEL_URL — el host del deploy, sin protocolo. Red de seguridad para
 *     que un preview (o un primer deploy sin la variable puesta) mande
 *     enlaces que al menos funcionan.
 *  3. localhost:3000 — desarrollo.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
