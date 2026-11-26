"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import {
  avisarPorteriaDeSolicitud,
  contarSolicitudesPendientes,
  edificioPorCodigo,
  obtenerOCrearCodigo,
  regenerarCodigo,
} from "@/lib/autoregistro";
import { invitarResidente, organizacionDelUsuario } from "@/lib/invitaciones";
import { unidadCanonica } from "@/lib/residentes";
import { cerrarPrestamosVencidos } from "@/lib/parking";
import type { Database } from "@/lib/database.types";
import { fallo } from "@/lib/errores-servidor";

/**
 * El autorregistro: el vecino pide, la portería decide.
 *
 * La acción de pedir **no tiene sesión** — es la única de todo Portex que
 * cualquiera puede llamar—, así que no crea nada que sirva: escribe una
 * solicitud en estado pendiente y se acabó. No hay cuenta, no hay correo, no
 * hay vínculo con la unidad hasta que un conserje la mira y aprueba.
 */

// ── Sesión ────────────────────────────────────────────────────────

async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Quién revisa: conserje o administrador del edificio. Nadie más. */
async function getRevisor() {
  const user = await getSessionUser();
  if (!user) return null;

  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("organization_id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.organization_id) return null;
  if (profile.role !== "conserje" && profile.role !== "admin") return null;

  const { data: building } = await db
    .from("buildings")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .limit(1)
    .maybeSingle();

  if (!building) return null;

  return {
    userId: user.id,
    nombre: profile.full_name ?? user.email ?? "Portería",
    organizationId: profile.organization_id,
    buildingId: building.id,
  };
}

// ── Lo que hace el vecino (sin sesión) ────────────────────────────

/** Cuántas solicitudes pendientes aguanta un edificio antes de cerrar la puerta. */
const TOPE_PENDIENTES = 60;

export async function pedirAcceso(input: {
  codigo: string;
  unitCode: string;
  name: string;
  email: string;
  phone?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const edificio = await edificioPorCodigo(input.codigo);
  if (!edificio) {
    return { ok: false, error: "Ese código no corresponde a ningún edificio. Revisa el cartel." };
  }

  // Si el departamento ya está en el padrón, se guarda **con el formato del
  // padrón**, no con el que tecleó el vecino: el demo tiene "A · 0307" y la
  // gente escribe "A-0307". Sin esto, aprobar crearía un duplicado.
  const escrita = input.unitCode.trim().toUpperCase();
  const unitCode = unidadCanonica(escrita, edificio.unidades) ?? escrita;
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;

  if (!unitCode)      return { ok: false, error: "Falta tu departamento" };
  if (name.length < 3) return { ok: false, error: "Escribe tu nombre completo" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Ese correo no parece válido" };
  }

  const db = createServiceClient();

  // Si ya hay alguien de esa unidad con cuenta y este mismo correo, no tiene
  // nada que pedir: que entre.
  const { data: yaInvitado } = await db
    .from("residents")
    .select("id")
    .eq("building_id", edificio.id)
    .eq("unit_code", unitCode)
    .eq("invite_email", email)
    .maybeSingle();

  if (yaInvitado) {
    return {
      ok: false,
      error: "Ese correo ya tiene acceso a este departamento. Inicia sesión, o recupera tu contraseña si la olvidaste.",
    };
  }

  // El cartel está pegado en un ascensor: cualquiera que pase puede pedir.
  // Un tope por edificio evita que un aburrido le deje 4.000 solicitudes al
  // conserje; con la cola llena, deja de aceptarse hasta que se revise.
  const { count } = await db
    .from("resident_signups")
    .select("id", { count: "exact", head: true })
    .eq("building_id", edificio.id)
    .eq("status", "pendiente");

  if ((count ?? 0) >= TOPE_PENDIENTES) {
    return {
      ok: false,
      error: "La portería tiene muchas solicitudes por revisar. Intenta más tarde o habla con el conserje.",
    };
  }

  const { error } = await db.from("resident_signups").insert({
    building_id: edificio.id,
    unit_code: unitCode,
    name,
    email,
    phone,
  });

  if (error) {
    // 23505 = ya hay una pendiente con ese correo. No es un error para la
    // persona: es exactamente lo que quería.
    if (error.code === "23505") return { ok: true };
    return { ok: false, error: "No se pudo enviar tu solicitud. Intenta de nuevo." };
  }

  await avisarPorteriaDeSolicitud(edificio.id, { name, unitCode });

  revalidatePath("/conserje");
  return { ok: true };
}

/**
 * El pulso del kiosco de portería, cada 30 segundos.
 *
 * Devuelve cuántas solicitudes esperan —con eso la pantalla decide si vale la
 * pena recargarse— y de paso **cierra los préstamos de estacionamiento
 * vencidos**, avisándole al departamento. La portería es lo más parecido a un
 * reloj que tiene el edificio: queda abierta todo el turno, así que es el único
 * lugar donde "ya pasó la fecha" se puede notar sin montar un cron.
 *
 * El barrido va en try/catch aparte: si falla, el conserje igual tiene que ver
 * sus solicitudes.
 */
export async function pulsoDePorteria(): Promise<number> {
  const ctx = await getRevisor();
  if (!ctx) return 0;

  try {
    await cerrarPrestamosVencidos(ctx.buildingId);
  } catch {
    /* se reintenta en el próximo pulso */
  }

  return contarSolicitudesPendientes(ctx.buildingId);
}

// ── Lo que hace la portería ───────────────────────────────────────

export async function aprobarSolicitud(input: {
  id: string;
}): Promise<{ ok: boolean; unidadCreada?: boolean; error?: string }> {
  const ctx = await getRevisor();
  if (!ctx) return { ok: false, error: "Solo la portería puede aprobar solicitudes" };

  const db = createServiceClient();

  const { data: solicitud } = await db
    .from("resident_signups")
    .select("id, unit_code, name, email, phone, status, building_id")
    .eq("id", input.id)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();

  if (!solicitud) return { ok: false, error: "Esa solicitud no es de tu edificio" };
  if (solicitud.status !== "pendiente") return { ok: false, error: "Esa solicitud ya fue revisada" };

  // ¿Existe el departamento en el padrón? En un edificio recién configurado
  // no existe ninguno, y es justo ahí donde este flujo más sirve: el padrón
  // se va llenando con los vecinos que piden acceso.
  const { data: existente } = await db
    .from("residents")
    .select("id")
    .eq("building_id", ctx.buildingId)
    .eq("unit_code", solicitud.unit_code)
    .maybeSingle();

  let residentId = existente?.id ?? null;
  let unidadCreada = false;

  if (!residentId) {
    const { data: creado, error } = await db
      .from("residents")
      .insert({
        building_id: ctx.buildingId,
        unit_code: solicitud.unit_code,
        name: solicitud.name,
        contact: solicitud.phone,
        status: "activo",
        tags: [],
      })
      .select("id")
      .single();

    if (error || !creado) {
      return { ok: false, error: error?.message ?? "No se pudo crear el departamento" };
    }
    residentId = creado.id;
    unidadCreada = true;
  }

  const invitacion = await invitarResidente(
    ctx.buildingId,
    ctx.organizationId,
    residentId,
    solicitud.email,
    solicitud.name
  );

  if (!invitacion.ok) return { ok: false, error: invitacion.error };

  await db
    .from("resident_signups")
    .update({
      status: "aprobada",
      resident_id: residentId,
      reviewed_by: ctx.nombre,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", solicitud.id);

  revalidatePath("/conserje");
  revalidatePath("/admin/residentes");
  return { ok: true, unidadCreada };
}

export async function rechazarSolicitud(input: {
  id: string;
  motivo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getRevisor();
  if (!ctx) return { ok: false, error: "Solo la portería puede revisar solicitudes" };

  const db = createServiceClient();
  const { error } = await db
    .from("resident_signups")
    .update({
      status: "rechazada",
      reviewed_by: ctx.nombre,
      reviewed_at: new Date().toISOString(),
      note: input.motivo?.trim() || null,
    })
    .eq("id", input.id)
    .eq("building_id", ctx.buildingId)
    .eq("status", "pendiente");

  if (error) return { ok: false, error: await fallo("rechazarSolicitud", error) };

  revalidatePath("/conserje");
  return { ok: true };
}

// ── El código del edificio (lo maneja el administrador) ───────────

export async function verCodigoEdificio(): Promise<{ codigo: string | null }> {
  const ctx = await getRevisor();
  if (!ctx) return { codigo: null };
  return { codigo: await obtenerOCrearCodigo(ctx.buildingId) };
}

export async function cambiarCodigoEdificio(): Promise<{ ok: boolean; codigo?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .maybeSingle();

  // Regenerar invalida todos los carteles impresos del edificio: eso lo
  // decide quien administra, no quien está de turno.
  if (profile?.role !== "admin" || !profile.organization_id) {
    return { ok: false, error: "Solo el administrador puede cambiar el código" };
  }

  const { data: building } = await db
    .from("buildings")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .limit(1)
    .maybeSingle();

  if (!building) return { ok: false, error: "Edificio no encontrado" };

  const codigo = await regenerarCodigo(building.id);
  if (!codigo) return { ok: false, error: "No se pudo generar un código nuevo" };

  revalidatePath("/admin/config");
  return { ok: true, codigo };
}

export async function organizacionDeSesion(): Promise<string | null> {
  const user = await getSessionUser();
  return user ? organizacionDelUsuario(user.id) : null;
}
