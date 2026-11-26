import "server-only";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import { invitarPorCorreo } from "@/lib/invitacion-correo";

/**
 * Invitar a un residente al portal.
 *
 * Vive acá y no dentro de un archivo `"use server"` porque lo llaman tres
 * caminos distintos: el botón de una fila del padrón, la invitación masiva y
 * la aprobación del conserje cuando alguien se registró con el código del
 * edificio. En un archivo de acciones cada export tiene que ser una acción;
 * esto es lógica compartida, no un endpoint.
 */

/** La organización a la que pertenece un perfil. */
export async function organizacionDelUsuario(userId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.organization_id ?? null;
}

export async function invitarResidente(
  buildingId: string,
  organizationId: string | null,
  residentId: string,
  emailCrudo: string,
  /** El nombre de la persona, cuando se sabe y difiere del titular del padrón. */
  nombre?: string
): Promise<{ ok: boolean; yaTenia?: boolean; error?: string }> {
  const email = emailCrudo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Ese correo no parece válido" };
  }

  const db = createServiceClient();

  const { data: resident } = await db
    .from("residents")
    .select("id, name, unit_code, building_id")
    .eq("id", residentId)
    .eq("building_id", buildingId)
    .maybeSingle();

  if (!resident) return { ok: false, error: "Ese residente no es de tu edificio" };
  if (!organizationId) return { ok: false, error: "Tu cuenta no tiene una organización asociada" };

  const invitacion = {
    role: "residente" as const,
    organization_id: organizationId,
    full_name: nombre?.trim() || resident.name,
    resident_id: resident.id,
  };

  const res = await invitarPorCorreo({
    email,
    nombre: nombre?.trim() || resident.name,
    invitacion,
  });

  if (res.estado === "error") return { ok: false, error: res.error };

  // Ya usa Portex —por ejemplo, porque arrienda en otra unidad del mismo
  // condominio—. No se le manda nada, pero sí se lo liga al departamento:
  // entra con la contraseña que ya tiene.
  if (res.estado === "ya-tiene-cuenta") {
    await ligarResidenteAPerfil(resident.id, res.usuarioId, resident.building_id);
    await marcarInvitado(resident.id, email);
    return { ok: true, yaTenia: true };
  }

  // Ojo: acá **no** se liga la cuenta al departamento. Invitar solo manda un
  // correo; la cuenta todavía no tiene contraseña y nadie puede entrar con
  // ella. El vínculo lo escribe `syncInvitedProfile` cuando la persona crea
  // su contraseña, que es cuando de verdad puede autorizar visitas.
  //
  // Ligarlo antes hacía dos daños: el padrón mostraba "con cuenta" a quien
  // nunca abrió el correo, y la portería creía que esa unidad podía responder
  // el citófono cuando no había a quién avisarle.
  await marcarInvitado(resident.id, email);

  return { ok: true };
}

/** Deja constancia de a quién y cuándo se invitó, para que la lista lo muestre. */
export async function marcarInvitado(residentId: string, email: string) {
  const db = createServiceClient();
  await db
    .from("residents")
    .update({ invite_email: email, invited_at: new Date().toISOString() })
    .eq("id", residentId);
}

/** El vínculo entre una cuenta y un departamento: significa "puede responder". */
export async function ligarResidenteAPerfil(
  residentId: string,
  profileId: string,
  buildingId: string
) {
  const db = createServiceClient();
  await db
    .from("resident_members")
    .upsert(
      { resident_id: residentId, profile_id: profileId, building_id: buildingId },
      { onConflict: "resident_id,profile_id" }
    );
}
