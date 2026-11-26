"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/user-context";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import { fallo } from "@/lib/errores-servidor";

/**
 * La configuración que antes solo se podía mirar.
 *
 * El nombre del edificio, cuántas unidades tiene y el nombre del propio
 * administrador se escribían una vez en el onboarding y quedaban ahí para
 * siempre: si el condominio cambiaba de nombre o alguien se equivocaba
 * tecleando, no había forma de arreglarlo desde la app.
 */

type Resultado = { ok: boolean; error?: string };

const SOLO_ADMIN = "Solo el administrador puede cambiar esto";

export async function guardarEdificio(input: {
  name: string;
  unitsTotal?: number;
  orgName?: string;
}): Promise<Resultado> {
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "admin") return { ok: false, error: SOLO_ADMIN };
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  const nombre = input.name.trim();
  if (nombre.length < 2) return { ok: false, error: "El edificio necesita un nombre" };

  // Las unidades salen en el panel y en el padrón: un cero o un número
  // absurdo se nota en todas partes.
  if (input.unitsTotal != null && (input.unitsTotal < 1 || input.unitsTotal > 100_000)) {
    return { ok: false, error: "Revisa el número de unidades" };
  }

  const db = createServiceClient();
  const { error } = await db
    .from("buildings")
    .update({
      name: nombre,
      ...(input.unitsTotal != null ? { units_total: input.unitsTotal } : {}),
    })
    .eq("id", ctx.buildingId);

  if (error) return { ok: false, error: await fallo("guardarEdificio", error) };

  const org = input.orgName?.trim();
  if (org && ctx.orgId && org !== ctx.orgName) {
    const { error: orgError } = await db
      .from("organizations")
      .update({ name: org })
      .eq("id", ctx.orgId);
    if (orgError) return { ok: false, error: await fallo("guardarEdificio", orgError) };
  }

  revalidatePath("/admin/config");
  revalidatePath("/admin");
  return { ok: true };
}

export async function guardarMiCuenta(input: { name: string }): Promise<Resultado> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, error: "Sesión expirada" };

  const nombre = input.name.trim();
  if (nombre.length < 2) return { ok: false, error: "Escribe tu nombre" };

  const db = createServiceClient();
  const { error } = await db
    .from("profiles")
    .update({ full_name: nombre })
    .eq("id", ctx.userId);

  if (error) return { ok: false, error: await fallo("guardarMiCuenta", error) };

  revalidatePath("/admin/config");
  revalidatePath("/admin");
  return { ok: true };
}
