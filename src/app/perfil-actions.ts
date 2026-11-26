"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/user-context";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import { getResidentIdsForProfile } from "@/lib/citofono";
import { normalizeRut } from "@/lib/rut";
import type { PetSpecies, Tenancy } from "@/lib/database.types";
import { fallo } from "@/lib/errores-servidor";

/**
 * El residente mantiene su propia ficha.
 *
 * Igual que con el estacionamiento y los autos: el id del departamento viaja
 * desde el navegador y no autoriza nada. Lo que autoriza es el vínculo entre
 * la sesión y la unidad, que se pregunta a la base en cada acción — un vecino
 * no puede editar la ficha del 1204 aunque adivine el id.
 */

type Resultado = { ok: boolean; error?: string };

const NO_ES_TUYO = "Ese departamento no es tuyo";

/** Las unidades de la sesión, o null si no hay sesión de residente. */
async function misUnidades() {
  const ctx = await getUserContext();
  if (!ctx?.buildingId) return null;

  const unidades = await getResidentIdsForProfile(ctx.userId);
  if (unidades.length === 0) return null;

  return {
    buildingId: ctx.buildingId,
    residentIds: unidades.map((u) => u.residentId),
  };
}

/** Marca que la ficha se revisó recién: es lo que separa "no tiene" de "no llenó". */
async function marcarRevisado(residentId: string) {
  await createServiceClient()
    .from("residents")
    .update({ profile_updated_at: new Date().toISOString() })
    .eq("id", residentId);
}

export async function guardarDatosDelDepartamento(input: {
  residentId: string;
  name: string;
  contact?: string;
  rut?: string;
  tenancy?: Tenancy | null;
}): Promise<Resultado> {
  const mias = await misUnidades();
  if (!mias) return { ok: false, error: "Tu cuenta no está ligada a un departamento" };
  if (!mias.residentIds.includes(input.residentId)) return { ok: false, error: NO_ES_TUYO };

  const nombre = input.name.trim();
  if (nombre.length < 2) return { ok: false, error: "Escribe tu nombre" };

  const { error } = await createServiceClient()
    .from("residents")
    .update({
      name: nombre,
      contact: input.contact?.trim() || null,
      // El RUT se guarda normalizado, igual que en toda la app: es la llave
      // con la que la portería reconoce a las personas.
      rut: input.rut?.trim() ? normalizeRut(input.rut) : null,
      tenancy: input.tenancy ?? null,
      profile_updated_at: new Date().toISOString(),
    })
    .eq("id", input.residentId)
    .eq("building_id", mias.buildingId);

  if (error) return { ok: false, error: await fallo("guardarDatosDelDepartamento", error) };

  revalidatePath("/residente");
  revalidatePath("/admin/residentes");
  return { ok: true };
}

// ── Integrantes del hogar ─────────────────────────────────────────

export async function agregarIntegrante(input: {
  residentId: string;
  name: string;
  relationship?: string;
}): Promise<Resultado> {
  const mias = await misUnidades();
  if (!mias) return { ok: false, error: "Tu cuenta no está ligada a un departamento" };
  if (!mias.residentIds.includes(input.residentId)) return { ok: false, error: NO_ES_TUYO };

  const nombre = input.name.trim();
  if (nombre.length < 2) return { ok: false, error: "Escribe el nombre" };

  const { error } = await createServiceClient().from("household_members").insert({
    building_id: mias.buildingId,
    resident_id: input.residentId,
    name: nombre,
    relationship: input.relationship?.trim() || null,
  });

  if (error) return { ok: false, error: await fallo("agregarIntegrante", error) };

  await marcarRevisado(input.residentId);
  revalidatePath("/residente");
  revalidatePath("/admin/residentes");
  return { ok: true };
}

export async function quitarIntegrante(id: string): Promise<Resultado> {
  const mias = await misUnidades();
  if (!mias) return { ok: false, error: "Tu cuenta no está ligada a un departamento" };

  const { error } = await createServiceClient()
    .from("household_members")
    .delete()
    .eq("id", id)
    // El filtro por unidad es lo que impide borrar a alguien de otro depto.
    .in("resident_id", mias.residentIds);

  if (error) return { ok: false, error: await fallo("quitarIntegrante", error) };

  revalidatePath("/residente");
  revalidatePath("/admin/residentes");
  return { ok: true };
}

// ── Mascotas ──────────────────────────────────────────────────────

export async function agregarMascota(input: {
  residentId: string;
  species: PetSpecies;
  name?: string;
  notes?: string;
}): Promise<Resultado> {
  const mias = await misUnidades();
  if (!mias) return { ok: false, error: "Tu cuenta no está ligada a un departamento" };
  if (!mias.residentIds.includes(input.residentId)) return { ok: false, error: NO_ES_TUYO };

  const { error } = await createServiceClient().from("pets").insert({
    building_id: mias.buildingId,
    resident_id: input.residentId,
    species: input.species,
    name: input.name?.trim() || null,
    notes: input.notes?.trim() || null,
  });

  if (error) return { ok: false, error: await fallo("agregarMascota", error) };

  await marcarRevisado(input.residentId);
  revalidatePath("/residente");
  revalidatePath("/admin/residentes");
  return { ok: true };
}

export async function quitarMascota(id: string): Promise<Resultado> {
  const mias = await misUnidades();
  if (!mias) return { ok: false, error: "Tu cuenta no está ligada a un departamento" };

  const { error } = await createServiceClient()
    .from("pets")
    .delete()
    .eq("id", id)
    .in("resident_id", mias.residentIds);

  if (error) return { ok: false, error: await fallo("quitarMascota", error) };

  revalidatePath("/residente");
  revalidatePath("/admin/residentes");
  return { ok: true };
}

/**
 * "Sí, está todo bien" sin cambiar nada.
 *
 * Le sirve al administrador tanto como una edición: significa que alguien
 * miró la ficha este mes y sigue vigente.
 */
export async function confirmarPerfilAlDia(residentId: string): Promise<Resultado> {
  const mias = await misUnidades();
  if (!mias) return { ok: false, error: "Tu cuenta no está ligada a un departamento" };
  if (!mias.residentIds.includes(residentId)) return { ok: false, error: NO_ES_TUYO };

  await marcarRevisado(residentId);
  revalidatePath("/residente");
  revalidatePath("/admin/residentes");
  return { ok: true };
}
