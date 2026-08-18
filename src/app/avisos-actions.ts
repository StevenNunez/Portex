"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/user-context";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import {
  NOTICE_LABEL,
  notifyBuilding,
  notifyUnit,
  type NoticeKind,
} from "@/lib/avisos";

/**
 * Avisos del edificio.
 *
 * "Mañana de 14:00 a 17:00 cortan el agua" no es un ingreso ni una visita:
 * es información que 312 departamentos necesitan antes de que pase, no
 * después. El administrador la programa; la portería la genera sola cuando
 * registra al que viene a hacer el trabajo.
 */

function rango(startsAt?: string, endsAt?: string | null): string {
  if (!startsAt) return "";
  const inicio = new Date(startsAt);
  const fin = endsAt ? new Date(endsAt) : null;

  const dia = inicio.toLocaleDateString("es-CL", { timeZone: "America/Santiago", weekday: "long", day: "numeric", month: "long" });
  const hi = inicio.toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false });
  if (!fin) return `${dia}, desde las ${hi}`;

  const hf = fin.toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false });
  const mismoDia = inicio.toDateString() === fin.toDateString();
  return mismoDia ? `${dia}, de ${hi} a ${hf}` : `desde el ${dia} ${hi}`;
}

export async function crearAviso(input: {
  kind: NoticeKind;
  title: string;
  body?: string;
  scope: "edificio" | "unidad";
  unitCode?: string;
  /** ISO local del navegador. Vacío = ahora. */
  startsAt?: string;
  endsAt?: string;
  /** Mandar la notificación al teléfono, además de dejarlo publicado. */
  notificar?: boolean;
}): Promise<{ ok: boolean; error?: string; avisados?: number }> {
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "admin") {
    return { ok: false, error: "Solo el administrador puede publicar avisos" };
  }
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  const titulo = input.title.trim();
  if (titulo.length < 3) return { ok: false, error: "Escribe de qué se trata el aviso" };
  if (input.scope === "unidad" && !input.unitCode?.trim()) {
    return { ok: false, error: "Elige el departamento al que le toca" };
  }

  const startsAt = input.startsAt ? new Date(input.startsAt).toISOString() : new Date().toISOString();
  const endsAt = input.endsAt ? new Date(input.endsAt).toISOString() : null;
  if (endsAt && endsAt <= startsAt) {
    return { ok: false, error: "El término tiene que ser posterior al inicio" };
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("notices")
    .insert({
      building_id: ctx.buildingId,
      kind: input.kind,
      title: titulo,
      body: input.body?.trim() || null,
      scope: input.scope,
      unit_code: input.scope === "unidad" ? input.unitCode!.trim() : null,
      starts_at: startsAt,
      ends_at: endsAt,
      source: "admin",
      created_by: ctx.userId,
      created_by_name: ctx.staffName,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo publicar el aviso" };

  let avisados = 0;
  if (input.notificar !== false) {
    const cuerpo = [input.body?.trim(), rango(startsAt, endsAt)].filter(Boolean).join(" · ");
    const payload = {
      title: `${NOTICE_LABEL[input.kind]} · ${titulo}`,
      body: cuerpo || "Toca para ver el detalle.",
      url: "/residente",
      tag: `notice-${data.id}`,
    };

    avisados =
      input.scope === "edificio"
        ? await notifyBuilding(ctx.buildingId, payload)
        : await notifyUnit(ctx.buildingId, input.unitCode!.trim(), payload);

    if (avisados > 0) {
      await db.from("notices").update({ notified_at: new Date().toISOString() }).eq("id", data.id);
    }
  }

  revalidatePath("/admin/avisos");
  revalidatePath("/residente");
  revalidatePath("/conserje");
  return { ok: true, avisados };
}

/** Se suspendió el corte, o el aviso se publicó con un error. */
export async function cancelarAviso(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "admin") {
    return { ok: false, error: "Solo el administrador puede cancelar avisos" };
  }
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  const db = createServiceClient();
  const { error } = await db
    .from("notices")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/avisos");
  revalidatePath("/residente");
  revalidatePath("/conserje");
  return { ok: true };
}
