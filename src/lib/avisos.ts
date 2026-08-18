import "server-only";

import { createServerClient } from "./supabase-server";
import { sendPushToProfiles, type PushPayload } from "./push";
import type { NoticeKind } from "./avisos-tipos";

export { NOTICE_LABEL, type NoticeKind } from "./avisos-tipos";

/**
 * A quién le suena el teléfono.
 *
 * Todo lo que pasa en portería le importa a alguien: la encomienda al 1204,
 * el corte de agua a las 312 unidades. Acá se resuelve esa pregunta —de la
 * unidad a las cuentas que la representan— y se manda el aviso.
 *
 * Un aviso que no llega no rompe nada: el paquete igual quedó registrado y
 * el residente lo va a ver cuando abra la app. Por eso todo esto se llama
 * dentro de un `try` y nunca hace fallar la operación que lo disparó.
 */

/** Las cuentas ligadas a una unidad. Vacío si nadie de ese depto tiene app. */
export async function getProfilesForUnit(
  buildingId: string,
  unitCode: string
): Promise<string[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("resident_members")
    .select("profile_id, residents!inner(unit_code)")
    .eq("building_id", buildingId);

  if (error || !data) return [];

  return (data as unknown as { profile_id: string; residents: { unit_code: string } }[])
    .filter((r) => r.residents?.unit_code === unitCode)
    .map((r) => r.profile_id);
}

/** Todas las cuentas de residente del edificio. */
export async function getProfilesForBuilding(buildingId: string): Promise<string[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("resident_members")
    .select("profile_id")
    .eq("building_id", buildingId);

  if (error || !data) return [];
  return Array.from(new Set(data.map((r) => r.profile_id)));
}

export async function notifyUnit(
  buildingId: string,
  unitCode: string,
  payload: PushPayload
): Promise<number> {
  const profiles = await getProfilesForUnit(buildingId, unitCode);
  if (profiles.length === 0) return 0;
  const res = await sendPushToProfiles(profiles, payload);
  return res.sent;
}

export async function notifyBuilding(
  buildingId: string,
  payload: PushPayload
): Promise<number> {
  const profiles = await getProfilesForBuilding(buildingId);
  if (profiles.length === 0) return 0;
  const res = await sendPushToProfiles(profiles, payload);
  return res.sent;
}

// ── Avisos del edificio ───────────────────────────────────────────

export interface NoticeRow {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string | null;
  scope: "edificio" | "unidad";
  unit_code: string | null;
  starts_at: string;
  ends_at: string | null;
  source: "admin" | "porteria";
  created_by_name: string | null;
  cancelled_at: string | null;
  created_at: string;
}

const SELECT_NOTICE =
  "id, kind, title, body, scope, unit_code, starts_at, ends_at, source, created_by_name, cancelled_at, created_at";

/** Un aviso con lo que depende del reloj ya resuelto. */
export type NoticeConEstado = NoticeRow & {
  /** Está pasando ahora mismo. */
  vigente: boolean;
  /** Ya terminó (y no fue cancelado). */
  terminado: boolean;
};

/**
 * Los avisos que todavía tienen algo que decir: los que no han terminado y
 * los que terminaron hace menos de dos horas (para el que llega justo después
 * y se pregunta por qué no hay agua).
 */
export async function getActiveNotices(
  buildingId: string,
  unitCode?: string | null
): Promise<NoticeConEstado[]> {
  const db = createServerClient();
  const desde = new Date(Date.now() - 2 * 3_600_000).toISOString();

  const { data, error } = await db
    .from("notices")
    .select(SELECT_NOTICE)
    .eq("building_id", buildingId)
    .is("cancelled_at", null)
    .or(`ends_at.is.null,ends_at.gte.${desde}`)
    .order("starts_at", { ascending: true });

  if (error) throw error;

  const ahora = Date.now();
  const filas = (data ?? []) as NoticeRow[];
  return filas
    // Un aviso de unidad solo le sirve a esa unidad.
    .filter((n) => n.scope === "edificio" || (unitCode != null && n.unit_code === unitCode))
    .map((n) => conEstado(n, ahora));
}

/** El historial completo para el panel del administrador. */
export async function getNotices(buildingId: string, limit = 60): Promise<NoticeConEstado[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("notices")
    .select(SELECT_NOTICE)
    .eq("building_id", buildingId)
    .order("starts_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  const ahora = Date.now();
  return ((data ?? []) as NoticeRow[]).map((n) => conEstado(n, ahora));
}

function conEstado(n: NoticeRow, ahora: number): NoticeConEstado {
  const desde = new Date(n.starts_at).getTime();
  const hasta = n.ends_at ? new Date(n.ends_at).getTime() : Infinity;
  return {
    ...n,
    vigente: !n.cancelled_at && desde <= ahora && ahora <= hasta,
    terminado: !n.cancelled_at && hasta < ahora,
  };
}
