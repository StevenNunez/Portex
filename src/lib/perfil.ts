import "server-only";

import { createServerClient } from "./supabase-server";
import type { PetSpecies, Tenancy } from "./database.types";

/**
 * El perfil del departamento.
 *
 * No es información que Portex necesite para dejar entrar a nadie: es lo que
 * el administrador termina persiguiendo por WhatsApp cada vez que cambia algo
 * —quién arrienda, cuánta gente vive, si tienen perro— y que hoy vive en un
 * Excel que nace desactualizado.
 *
 * Lo mantiene el residente desde su teléfono, porque es el único que sabe
 * cuándo cambia. `profile_updated_at` guarda cuándo lo revisó por última vez:
 * sin esa fecha, "sin mascotas" y "nunca llenó la ficha" se ven igual.
 */

export interface PerfilUnidad {
  residentId: string;
  unitCode: string;
  name: string;
  contact: string | null;
  rut: string | null;
  tenancy: Tenancy | null;
  actualizadoEn: string | null;
  integrantes: Integrante[];
  mascotas: Mascota[];
}

export interface Integrante {
  id: string;
  name: string;
  relationship: string | null;
}

export interface Mascota {
  id: string;
  species: PetSpecies;
  name: string | null;
  notes: string | null;
}

function db() {
  return createServerClient();
}

export async function getPerfil(residentId: string): Promise<PerfilUnidad | null> {
  const [residenteRes, integrantesRes, mascotasRes] = await Promise.all([
    db()
      .from("residents")
      .select("id, unit_code, name, contact, rut, tenancy, profile_updated_at")
      .eq("id", residentId)
      .maybeSingle(),
    db()
      .from("household_members")
      .select("id, name, relationship")
      .eq("resident_id", residentId)
      .order("created_at"),
    db()
      .from("pets")
      .select("id, species, name, notes")
      .eq("resident_id", residentId)
      .order("created_at"),
  ]);

  const r = residenteRes.data;
  if (!r) return null;

  return {
    residentId: r.id,
    unitCode: r.unit_code,
    name: r.name,
    contact: r.contact,
    rut: r.rut,
    tenancy: r.tenancy,
    actualizadoEn: r.profile_updated_at,
    integrantes: (integrantesRes.data ?? []) as Integrante[],
    mascotas: (mascotasRes.data ?? []) as Mascota[],
  };
}

/** Los perfiles de todo el edificio, para el padrón del administrador. */
export interface PerfilResumen {
  residentId: string;
  integrantes: number;
  mascotas: Mascota[];
}

export async function getPerfilesResumen(buildingId: string): Promise<Map<string, PerfilResumen>> {
  const [integrantesRes, mascotasRes] = await Promise.all([
    db().from("household_members").select("resident_id").eq("building_id", buildingId),
    db().from("pets").select("id, resident_id, species, name, notes").eq("building_id", buildingId),
  ]);

  const mapa = new Map<string, PerfilResumen>();

  const asegurar = (id: string) => {
    let fila = mapa.get(id);
    if (!fila) {
      fila = { residentId: id, integrantes: 0, mascotas: [] };
      mapa.set(id, fila);
    }
    return fila;
  };

  for (const i of integrantesRes.data ?? []) asegurar(i.resident_id).integrantes += 1;
  for (const m of (mascotasRes.data ?? []) as (Mascota & { resident_id: string })[]) {
    asegurar(m.resident_id).mascotas.push({
      id: m.id,
      species: m.species,
      name: m.name,
      notes: m.notes,
    });
  }

  return mapa;
}

/** Cómo se lee cada tipo de tenencia. */
export const TENANCY_LABEL: Record<Tenancy, string> = {
  propietario: "Propietario",
  arrendatario: "Arrendatario",
  otro: "Otro",
};

export const PET_LABEL: Record<PetSpecies, string> = {
  perro: "Perro",
  gato: "Gato",
  otro: "Otro",
};
