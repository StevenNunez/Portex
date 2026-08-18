import "server-only";

import { createServerClient } from "./supabase-server";
import { normalizeRut } from "./rut";
import { QR_PREFIJO } from "./qr";

// ── Types ─────────────────────────────────────────────────────────

export type RequestStatus =
  | "pendiente"
  | "aprobada"
  | "rechazada"
  | "vencida"
  | "sin_respuesta";

export interface AccessRequestRow {
  id: string;
  building_id: string;
  resident_id: string | null;
  unit_code: string | null;
  visitor_name: string;
  visitor_rut: string | null;
  plate: string | null;
  kind: "visita" | "delivery" | "proveedor";
  status: RequestStatus;
  requested_by: string | null;
  expires_at: string;
  responded_at: string | null;
  responded_by_name: string | null;
  /** Ingreso en la bitácora que respalda esta solicitud, cuando ya entró. */
  access_log_id: string | null;
  created_at: string;
}

export interface VisitPassRow {
  id: string;
  resident_id: string;
  visitor_name: string;
  visitor_rut: string | null;
  plate: string | null;
  note: string | null;
  valid_from: string;
  valid_until: string;
  single_use: boolean;
  used_at: string | null;
  used_count: number;
  status: "activo" | "usado" | "revocado" | "vencido";
  created_by_name: string | null;
  /** Secreto que viaja dentro del QR. */
  token: string | null;
  /** Los 6 dígitos que la visita dice en portería. */
  code: string | null;
  created_at: string;
}


/** Cuánto espera el conserje una respuesta antes de poder decidir él. */
export const REQUEST_TIMEOUT_SECONDS = 90;

// ── Unidades con cuenta ───────────────────────────────────────────

/**
 * Unidades del edificio que tienen al menos un residente con cuenta.
 * Solo a esas se les puede pedir autorización; al resto el conserje
 * las registra como siempre.
 */
export async function getUnitsWithAccounts(buildingId: string): Promise<string[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("resident_members")
    .select("residents!inner(unit_code)")
    .eq("building_id", buildingId);

  if (error) throw error;
  const units = (data ?? [])
    .map((r) => (r as unknown as { residents: { unit_code: string } }).residents?.unit_code)
    .filter(Boolean);
  return Array.from(new Set(units));
}

// ── Pases anticipados ─────────────────────────────────────────────

/**
 * Busca un pase vigente para ese visitante en esa unidad. El match es
 * por nombre (sin tildes ni mayúsculas, coincidencia parcial) porque el
 * residente escribe "Juan" y el conserje "Juan Pérez Soto".
 */
export async function findActivePass(
  buildingId: string,
  residentId: string,
  visitorName: string,
  visitorRut?: string
): Promise<VisitPassRow | null> {
  const db = createServerClient();
  const nowISO = new Date().toISOString();

  const { data, error } = await db
    .from("visit_passes")
    .select("*")
    .eq("building_id", buildingId)
    .eq("resident_id", residentId)
    .eq("status", "activo")
    .lte("valid_from", nowISO)
    .gte("valid_until", nowISO)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const passes = (data ?? []) as VisitPassRow[];

  // El RUT manda: si el residente lo anotó, es la coincidencia confiable.
  const rut = visitorRut ? normalizeRut(visitorRut) : "";
  if (rut) {
    const byRut = passes.find((p) => p.visitor_rut && normalizeRut(p.visitor_rut) === rut);
    if (byRut) return byRut;
  }

  // Si no hay RUT en el pase, se cae al nombre: el residente escribe
  // "Juan" y el conserje "Juan Pérez Soto".
  const needle = normalize(visitorName);
  if (!needle) return null;

  const byName = passes.find((p) => {
    if (p.visitor_rut && rut) return false; // ya se descartó por RUT distinto
    const pass = normalize(p.visitor_name);
    return pass.includes(needle) || needle.includes(pass);
  });

  return byName ?? null;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export interface PassByRut {
  pass: VisitPassRow;
  residentId: string;
  unitCode: string;
  residentName: string;
}

/**
 * "Su RUT por favor" → 22.333.444-K → "Camila Soto, la anunció Martín
 * Reyes del A · 1204". Encuentra el pase sin que el conserje tenga que
 * escribir nombre ni departamento: el RUT resuelve todo.
 */
export async function findActivePassByRut(
  buildingId: string,
  rut: string
): Promise<PassByRut | null> {
  const clean = normalizeRut(rut);
  if (clean.length < 7) return null;

  const db = createServerClient();
  const nowISO = new Date().toISOString();

  // Se comparan los RUT normalizados en memoria, no en SQL: los pases
  // guardados antes de que se normalizara el campo traen puntos y guion,
  // y un pase vigente no puede perderse por un punto de diferencia.
  const { data, error } = await db
    .from("visit_passes")
    .select("*, residents!inner(id, unit_code, name)")
    .eq("building_id", buildingId)
    .eq("status", "activo")
    .lte("valid_from", nowISO)
    .gte("valid_until", nowISO)
    .not("visitor_rut", "is", null)
    .order("created_at", { ascending: false });

  if (error || !data) return null;

  const rows = data as unknown as (VisitPassRow & {
    residents: { id: string; unit_code: string; name: string };
  })[];

  const row = rows.find((p) => p.visitor_rut && normalizeRut(p.visitor_rut) === clean);
  if (!row) return null;

  return {
    pass: row,
    residentId: row.residents.id,
    unitCode: row.residents.unit_code,
    residentName: row.residents.name,
  };
}

/**
 * El pase detrás de un QR escaneado o de un código dictado.
 *
 * Los dos caminos terminan acá porque son la misma llave: el QR trae el token
 * y el código de 6 dígitos es su versión para decir en voz alta, cuando la
 * cámara de la tablet no da o el visitante trae la pantalla rota.
 */
export async function findPassByCodeOrToken(
  buildingId: string,
  entrada: string
): Promise<PassByRut | null> {
  const limpio = entrada.trim();
  if (!limpio) return null;

  const db = createServerClient();
  const nowISO = new Date().toISOString();

  let query = db
    .from("visit_passes")
    .select("*, residents!inner(id, unit_code, name)")
    .eq("building_id", buildingId)
    .eq("status", "activo")
    .lte("valid_from", nowISO)
    .gte("valid_until", nowISO);

  if (limpio.toUpperCase().startsWith(QR_PREFIJO)) {
    query = query.eq("token", limpio.slice(QR_PREFIJO.length).trim());
  } else {
    // Se dicta hablando: llega con espacios, guiones o puntos de por medio.
    const digitos = limpio.replace(/\D/g, "");
    if (digitos.length !== 6) return null;
    query = query.eq("code", digitos);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as VisitPassRow & {
    residents: { id: string; unit_code: string; name: string };
  };

  return {
    pass: row,
    residentId: row.residents.id,
    unitCode: row.residents.unit_code,
    residentName: row.residents.name,
  };
}

export async function getPassesForResident(
  residentId: string
): Promise<VisitPassRow[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("visit_passes")
    .select("*")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as VisitPassRow[];
}

// ── Solicitudes ───────────────────────────────────────────────────

export async function getRequest(id: string): Promise<AccessRequestRow | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("access_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as AccessRequestRow) ?? null;
}

/**
 * Solicitudes que le tocan responder a este residente. Marca como
 * vencidas las que pasaron su plazo antes de devolverlas, así el
 * residente nunca ve un botón que ya no sirve.
 */
export async function getPendingRequestsForResidents(
  residentIds: string[]
): Promise<AccessRequestRow[]> {
  if (residentIds.length === 0) return [];
  const db = createServerClient();
  const nowISO = new Date().toISOString();

  await db
    .from("access_requests")
    .update({ status: "vencida" })
    .in("resident_id", residentIds)
    .eq("status", "pendiente")
    .lt("expires_at", nowISO);

  const { data, error } = await db
    .from("access_requests")
    .select("*")
    .in("resident_id", residentIds)
    .eq("status", "pendiente")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AccessRequestRow[];
}

/**
 * Visitas que la unidad autorizó pero que todavía no tienen ingreso en
 * la bitácora: pasa cuando el conserje cerró el drawer, se fue a atender
 * otra cosa o se le cayó la conexión mientras esperaba. Quedan a la
 * vista en la pantalla del turno para registrarlas de un toque.
 */
export async function getApprovedAwaitingEntry(
  buildingId: string
): Promise<AccessRequestRow[]> {
  const db = createServerClient();
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("access_requests")
    .select("*")
    .eq("building_id", buildingId)
    .eq("status", "aprobada")
    .is("access_log_id", null)
    .gte("created_at", since)
    .order("responded_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AccessRequestRow[];
}

export async function getRecentRequestsForResidents(
  residentIds: string[],
  limit = 20
): Promise<AccessRequestRow[]> {
  if (residentIds.length === 0) return [];
  const db = createServerClient();
  const { data, error } = await db
    .from("access_requests")
    .select("*")
    .in("resident_id", residentIds)
    .neq("status", "pendiente")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AccessRequestRow[];
}

/** Las unidades del usuario logueado (un residente puede tener más de una). */
export async function getResidentIdsForProfile(
  profileId: string
): Promise<{ residentId: string; unitCode: string; name: string }[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("resident_members")
    .select("resident_id, residents!inner(unit_code, name)")
    .eq("profile_id", profileId);

  if (error) throw error;

  return (data ?? []).map((r) => {
    const row = r as unknown as {
      resident_id: string;
      residents: { unit_code: string; name: string };
    };
    return {
      residentId: row.resident_id,
      unitCode: row.residents.unit_code,
      name: row.residents.name,
    };
  });
}
