import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { createServerClient } from "./supabase-server";
import { QR_ENCOMIENDA } from "./qr";
import { fallo } from "@/lib/errores-servidor";

/**
 * Encomiendas.
 *
 * Una encomienda tiene dueño (el departamento), una llave para retirarla y
 * un final: quién se la llevó. Antes era una línea en la bitácora y el
 * conserje escribía a mano el nombre de quien pasaba a buscarla; ahora la
 * persona demuestra que le corresponde con el código o el QR que le llegó
 * al departamento.
 *
 * El conserje puede entregarla igual sin código —la vecina de toda la vida
 * que viene por el paquete del 302—, pero eso queda escrito como entrega
 * manual. La diferencia importa cuando alguien reclama.
 */

export { QR_ENCOMIENDA };

/**
 * Los códigos de encomienda viven en 500000–999999 y los de los pases de
 * visita en 100000–499999. Así el conserje digita seis dígitos y el sistema
 * sabe de inmediato qué le están mostrando, sin preguntar.
 */
export const RANGO_ENCOMIENDA = { min: 500_000, max: 1_000_000 };

export interface ParcelRow {
  id: string;
  resident_id: string | null;
  unit_code: string | null;
  courier: string | null;
  description: string | null;
  code: string;
  token: string;
  status: "pendiente" | "retirada";
  received_at: string;
  received_by: string | null;
  notified_at: string | null;
  picked_up_at: string | null;
  picked_up_by: string | null;
  picked_up_rut: string | null;
  pickup_method: "codigo" | "qr" | "manual" | null;
}

const SELECT_ROW =
  "id, resident_id, unit_code, courier, description, code, token, status, received_at, received_by, notified_at, picked_up_at, picked_up_by, picked_up_rut, pickup_method";

function db() {
  return createServerClient();
}

// ── Consultas ─────────────────────────────────────────────────────

/** Las que están esperando a que alguien las venga a buscar. */
export async function getPendingParcels(buildingId: string): Promise<ParcelRow[]> {
  const { data, error } = await db()
    .from("parcels")
    .select(SELECT_ROW)
    .eq("building_id", buildingId)
    .eq("status", "pendiente")
    .order("received_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ParcelRow[];
}

/** Una encomienda con los días de espera ya contados. */
export type ParcelConEspera = ParcelRow & { diasEnPorteria: number };

/** Todas las del edificio, para el panel del administrador. */
export async function getParcels(buildingId: string, limit = 200): Promise<ParcelConEspera[]> {
  const { data, error } = await db()
    .from("parcels")
    .select(SELECT_ROW)
    .eq("building_id", buildingId)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  const ahora = Date.now();
  return ((data ?? []) as ParcelRow[]).map((p) => ({
    ...p,
    diasEnPorteria: diasEsperando(p.received_at, ahora),
  }));
}

/** Las de un departamento: es lo que ve el residente en su teléfono. */
export async function getParcelsForUnit(
  buildingId: string,
  unitCode: string,
  limit = 20
): Promise<ParcelRow[]> {
  const { data, error } = await db()
    .from("parcels")
    .select(SELECT_ROW)
    .eq("building_id", buildingId)
    .eq("unit_code", unitCode)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ParcelRow[];
}

/** El paquete detrás de un QR escaneado o de un código dictado. */
export async function findParcelByCodeOrToken(
  buildingId: string,
  entrada: string
): Promise<ParcelRow | null> {
  const limpio = entrada.trim();
  if (!limpio) return null;

  let query = db()
    .from("parcels")
    .select(SELECT_ROW)
    .eq("building_id", buildingId)
    .eq("status", "pendiente");

  if (limpio.toUpperCase().startsWith(QR_ENCOMIENDA)) {
    query = query.eq("token", limpio.slice(QR_ENCOMIENDA.length).trim());
  } else {
    const digitos = limpio.replace(/\D/g, "");
    if (digitos.length !== 6) return null;
    query = query.eq("code", digitos);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data) return null;
  return data as ParcelRow;
}

// ── Recepción ─────────────────────────────────────────────────────

export interface NuevaEncomienda {
  buildingId: string;
  unitCode: string | null;
  residentId?: string | null;
  courier?: string | null;
  description?: string | null;
  receivedBy: string;
  accessLogId?: string | null;
}

/**
 * Guarda el paquete y le pone su llave de retiro.
 *
 * El código se sortea y se reintenta ante un choque: el índice único es
 * parcial (solo entre las pendientes del edificio), así que los códigos de
 * las ya retiradas vuelven a la baraja.
 */
export async function registrarEncomienda(
  input: NuevaEncomienda
): Promise<{ ok: boolean; parcel?: ParcelRow; error?: string }> {
  const base = {
    building_id: input.buildingId,
    resident_id: input.residentId ?? null,
    unit_code: input.unitCode,
    courier: input.courier ?? null,
    description: input.description ?? null,
    received_by: input.receivedBy,
    access_log_id: input.accessLogId ?? null,
    token: randomUUID().replace(/-/g, ""),
  };

  for (let intento = 0; intento < 5; intento++) {
    const { data, error } = await db()
      .from("parcels")
      .insert({
        ...base,
        code: String(randomInt(RANGO_ENCOMIENDA.min, RANGO_ENCOMIENDA.max)),
      })
      .select(SELECT_ROW)
      .single();

    if (!error && data) return { ok: true, parcel: data as ParcelRow };
    if (error?.code !== "23505") {
      return { ok: false, error: error?.message ?? "No se pudo registrar la encomienda" };
    }
  }

  return { ok: false, error: "No se pudo generar un código libre" };
}

export async function marcarAvisada(parcelId: string): Promise<void> {
  await db()
    .from("parcels")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", parcelId);
}

// ── Retiro ────────────────────────────────────────────────────────

export interface RetiroInput {
  buildingId: string;
  parcelId: string;
  pickedUpBy: string;
  pickedUpRut?: string | null;
  method: "codigo" | "qr" | "manual";
  pickupLogId?: string | null;
}

export async function marcarRetirada(
  input: RetiroInput
): Promise<{ ok: boolean; error?: string }> {
  const { error, data } = await db()
    .from("parcels")
    .update({
      status: "retirada",
      picked_up_at: new Date().toISOString(),
      picked_up_by: input.pickedUpBy,
      picked_up_rut: input.pickedUpRut ?? null,
      pickup_method: input.method,
      pickup_log_id: input.pickupLogId ?? null,
    })
    .eq("id", input.parcelId)
    .eq("building_id", input.buildingId)
    // Solo se puede retirar una vez: si dos conserjes la entregan a la vez,
    // el segundo no encuentra fila que actualizar.
    .eq("status", "pendiente")
    .select("id");

  if (error) return { ok: false, error: await fallo("marcarRetirada", error) };
  if (!data || data.length === 0) {
    return { ok: false, error: "Esa encomienda ya había sido retirada" };
  }
  return { ok: true };
}

/** Cuántos días lleva esperando. El conserje necesita el espacio. */
export function diasEsperando(recibida: string, ahora: number): number {
  return Math.floor((ahora - new Date(recibida).getTime()) / 86_400_000);
}
