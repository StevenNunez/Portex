import "server-only";

import { createServerClient } from "./supabase-server";
import { normalizeRut } from "./rut";

export interface KnownVisitor {
  rut: string;
  name: string;
  /** Última unidad a la que fue: es la que el conserje va a confirmar. */
  unit: string | null;
  reason: string | null;
  kind: string | null;
  plate: string | null;
  visitCount: number;
  lastSeenAt: string | null;
}

/**
 * "Su RUT por favor" → esto es lo que contesta el sistema.
 * Primero el padrón de recurrentes; si no está ahí, se reconstruye del
 * último ingreso registrado con ese RUT, así el reconocimiento funciona
 * desde la segunda visita aunque nadie lo haya dado de alta.
 */
export async function findVisitorByRut(
  buildingId: string,
  rut: string
): Promise<KnownVisitor | null> {
  const clean = normalizeRut(rut);
  if (clean.length < 7) return null;

  const db = createServerClient();

  const { data: frequent } = await db
    .from("frequent_visitors")
    .select("name, rut, default_unit, last_unit, reason, kind, visit_count, last_seen_at")
    .eq("building_id", buildingId)
    .eq("rut", clean)
    .maybeSingle();

  if (frequent) {
    return {
      rut: clean,
      name: frequent.name,
      unit: frequent.last_unit ?? frequent.default_unit,
      reason: frequent.reason,
      kind: frequent.kind,
      plate: null,
      visitCount: frequent.visit_count ?? 0,
      lastSeenAt: frequent.last_seen_at,
    };
  }

  const { data: last } = await db
    .from("access_log")
    .select("who, unit, plate, recorded_at")
    .eq("building_id", buildingId)
    .eq("rut", clean)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) return null;

  return {
    rut: clean,
    name: last.who,
    unit: last.unit,
    reason: null,
    kind: null,
    plate: last.plate,
    visitCount: 1,
    lastSeenAt: last.recorded_at,
  };
}

/**
 * Cada ingreso deja al visitante aprendido: la próxima vez basta el RUT.
 * Se llama después de escribir en la bitácora y nunca interrumpe el
 * registro — si falla, el ingreso ya quedó guardado igual.
 */
export async function rememberVisitor(input: {
  buildingId: string;
  rut: string;
  name: string;
  unit?: string | null;
  reason?: string | null;
  kind?: string | null;
}): Promise<void> {
  const clean = normalizeRut(input.rut);
  if (clean.length < 7 || !input.name.trim()) return;

  const db = createServerClient();

  const { data: existing } = await db
    .from("frequent_visitors")
    .select("id, visit_count, reason")
    .eq("building_id", input.buildingId)
    .eq("rut", clean)
    .maybeSingle();

  if (existing) {
    await db
      .from("frequent_visitors")
      .update({
        name: input.name.trim(),
        last_unit: input.unit ?? null,
        last_seen_at: new Date().toISOString(),
        visit_count: (existing.visit_count ?? 0) + 1,
        // El motivo escrito a mano no se pisa con uno vacío
        reason: input.reason ?? existing.reason,
        kind: input.kind ?? null,
      })
      .eq("id", existing.id);
    return;
  }

  await db.from("frequent_visitors").insert({
    building_id: input.buildingId,
    rut: clean,
    name: input.name.trim(),
    default_unit: input.unit ?? null,
    last_unit: input.unit ?? null,
    reason: input.reason ?? null,
    kind: input.kind ?? null,
    visit_count: 1,
    last_seen_at: new Date().toISOString(),
  });
}
