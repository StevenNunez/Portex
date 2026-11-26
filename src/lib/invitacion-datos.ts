/**
 * Los datos de una invitación: a qué organización entra la persona, con qué
 * rol y, si es residente, a qué unidad.
 *
 * Viven en `app_metadata.invitacion`, **nunca** en `user_metadata`. La
 * diferencia es quién puede escribirlos: `user_metadata` lo cambia el propio
 * usuario desde el navegador (`supabase.auth.updateUser({ data })`, o el
 * `data` del `signUp`), así que leer de ahí el rol o la organización dejaba
 * que cualquiera se declarara administrador del condominio que quisiera.
 * `app_metadata` solo lo escribe la clave de servicio (`lib/auth-admin.ts`).
 *
 * Este archivo no lleva `server-only`: la pantalla de crear contraseña
 * también necesita saber si la cuenta viene de una invitación.
 */

export type RolInvitado = "admin" | "conserje" | "residente";

export type DatosInvitacion = {
  role: RolInvitado;
  organization_id: string;
  full_name?: string;
  /** Solo para residentes: la unidad del padrón a la que se lo invitó. */
  resident_id?: string;
};

const ROLES: readonly RolInvitado[] = ["admin", "conserje", "residente"];

/** Lee la invitación de una cuenta, o `null` si no viene de una. */
export function leerInvitacion(
  usuario: { app_metadata?: Record<string, unknown> | null } | null | undefined
): DatosInvitacion | null {
  const crudo = usuario?.app_metadata?.invitacion;
  if (!crudo || typeof crudo !== "object") return null;

  const datos = crudo as Record<string, unknown>;
  const role = datos.role;
  const organizationId = datos.organization_id;

  if (typeof organizationId !== "string" || !organizationId) return null;
  if (typeof role !== "string" || !ROLES.includes(role as RolInvitado)) return null;

  return {
    role: role as RolInvitado,
    organization_id: organizationId,
    ...(typeof datos.full_name === "string" && datos.full_name
      ? { full_name: datos.full_name }
      : {}),
    ...(typeof datos.resident_id === "string" && datos.resident_id
      ? { resident_id: datos.resident_id }
      : {}),
  };
}
