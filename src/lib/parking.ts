import "server-only";

import { createServerClient } from "./supabase-server";
import type {
  MySpot,
  OccupiedSpot,
  ParkingAvailability,
  ParkingSpotRow,
  ParkingSuggestion,
  ResidentVehicle,
} from "./parking-types";

export type * from "./parking-types";

/**
 * Estacionamientos.
 *
 * La regla del edificio, tal cual la dice el conserje: si el estacionamiento
 * del departamento está libre, la visita va ahí; si está ocupado, se le da uno
 * de visita; si no queda ninguno, el auto se queda fuera. Lo importante es que
 * eso se sepa **antes** de abrir el portón, no después de que el auto entró.
 */

function db() {
  return createServerClient();
}

/** ¿El préstamo de este estacionamiento sigue vigente? */
function estaPrestado(lentUntil: string | null, ahora: number): boolean {
  return lentUntil != null && new Date(lentUntil).getTime() > ahora;
}

/** Ids de los estacionamientos con un auto adentro ahora mismo. */
async function occupiedSpotIds(buildingId: string): Promise<Set<string>> {
  const { data, error } = await db()
    .from("parking_sessions")
    .select("spot_id")
    .eq("building_id", buildingId)
    .is("ended_at", null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.spot_id));
}

export async function getSpots(buildingId: string): Promise<ParkingSpotRow[]> {
  const { data, error } = await db()
    .from("parking_spots")
    .select("id, code, kind, unit_code, active, notes, lent_until")
    .eq("building_id", buildingId)
    .order("kind")
    .order("code");
  if (error) throw error;
  return (data ?? []) as ParkingSpotRow[];
}

/** El mapa completo para el panel: cada estacionamiento con su ocupante. */
export async function getParkingMap(buildingId: string): Promise<OccupiedSpot[]> {
  const [spots, sessionsRes] = await Promise.all([
    getSpots(buildingId),
    db()
      .from("parking_sessions")
      .select("id, spot_id, plate, driver_name, unit_code, started_at")
      .eq("building_id", buildingId)
      .is("ended_at", null),
  ]);
  if (sessionsRes.error) throw sessionsRes.error;

  const bySpot = new Map(
    (sessionsRes.data ?? []).map((s) => [
      s.spot_id,
      {
        id: s.id,
        plate: s.plate,
        driver_name: s.driver_name,
        unit_code: s.unit_code,
        started_at: s.started_at,
      },
    ])
  );

  const ahora = Date.now();
  return spots.map((spot) => ({
    ...spot,
    lent: estaPrestado(spot.lent_until, ahora),
    session: bySpot.get(spot.id) ?? null,
  }));
}

/**
 * Qué estacionamiento ofrecerle a una visita que va a la unidad `unitCode`.
 *
 * Devuelve además el estado del estacionamiento del departamento aunque esté
 * ocupado: al conserje le sirve poder decir "el del 1204 está ocupado, le doy
 * uno de visita" en vez de solo mostrar un número distinto sin explicación.
 */
export async function getAvailability(
  buildingId: string,
  unitCode?: string | null
): Promise<ParkingAvailability> {
  const [spots, occupied] = await Promise.all([
    getSpots(buildingId),
    occupiedSpotIds(buildingId),
  ]);

  const activos = spots.filter((s) => s.active);
  const visitorSpots = activos.filter((s) => s.kind === "visita");
  const freeVisitorSpots = visitorSpots.filter((s) => !occupied.has(s.id));

  const unit = unitCode?.trim();
  const spotDeLaUnidad = unit
    ? activos.find((s) => s.kind === "residente" && s.unit_code === unit)
    : undefined;

  // Cupos que otros residentes prestaron y siguen vigentes. El del propio
  // depto no entra acá: para sus visitas es suyo aunque lo haya prestado.
  const ahora = Date.now();
  const prestadosLibres = activos.filter(
    (s) =>
      s.kind === "residente" &&
      s.id !== spotDeLaUnidad?.id &&
      estaPrestado(s.lent_until, ahora) &&
      !occupied.has(s.id)
  );

  let suggestion: ParkingSuggestion | null = null;
  if (spotDeLaUnidad && !occupied.has(spotDeLaUnidad.id)) {
    suggestion = { spot: spotDeLaUnidad, reason: "unidad" };
  } else if (freeVisitorSpots.length > 0) {
    suggestion = { spot: freeVisitorSpots[0], reason: "visita" };
  } else if (prestadosLibres.length > 0) {
    // Último recurso: el auto igual entra, en el cupo que un vecino dejó
    // disponible mientras no está.
    suggestion = { spot: prestadosLibres[0], reason: "prestado" };
  }

  return {
    suggestion,
    unitSpot: spotDeLaUnidad
      ? { code: spotDeLaUnidad.code, occupied: occupied.has(spotDeLaUnidad.id) }
      : null,
    freeVisitorSpots: freeVisitorSpots.length,
    totalVisitorSpots: visitorSpots.length,
    freeLentSpots: prestadosLibres.length,
  };
}

/** Resumen para la pantalla de portería: "3 de 8 libres". */
/**
 * Lo que la portería ve de un vistazo.
 *
 * Cuenta **los cupos que se le pueden ofrecer a alguien que llega**: los de
 * visita más los que algún residente prestó. Antes contaba todos los del
 * edificio, incluidos los de los departamentos, así que el chip podía decir
 * "8/8" con los tres de visita ocupados — y el conserje se enteraba recién
 * cuando el auto ya estaba en la puerta.
 */
export async function getParkingSummary(
  buildingId: string
): Promise<{ free: number; total: number } | null> {
  const [spots, occupied] = await Promise.all([
    getSpots(buildingId),
    occupiedSpotIds(buildingId),
  ]);
  const activos = spots.filter((s) => s.active);
  // Sin estacionamientos cargados el módulo no aplica a este edificio: se
  // devuelve null para que la portería no muestre un "0 de 0" desconcertante.
  if (activos.length === 0) return null;

  const ahora = Date.now();
  const paraVisitas = activos.filter(
    (s) => s.kind === "visita" || estaPrestado(s.lent_until, ahora)
  );

  return {
    free: paraVisitas.filter((s) => !occupied.has(s.id)).length,
    total: paraVisitas.length,
  };
}

export interface OccupyInput {
  buildingId: string;
  spotId: string;
  plate: string;
  driverName?: string | null;
  rut?: string | null;
  unitCode?: string | null;
  accessLogId?: string | null;
  createdBy?: string | null;
}

/**
 * Marca un estacionamiento como ocupado.
 *
 * El índice único parcial de la base (`parking_sessions_una_activa`) es el que
 * garantiza que no queden dos autos en el mismo lugar: si dos conserjes
 * confirman a la vez, el segundo insert falla con 23505 y acá se traduce a un
 * mensaje que se entiende en portería.
 */
export async function occupySpot(input: OccupyInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db()
    .from("parking_sessions")
    .insert({
      building_id: input.buildingId,
      spot_id: input.spotId,
      plate: input.plate.toUpperCase().replace(/\s+/g, ""),
      driver_name: input.driverName ?? null,
      rut: input.rut ?? null,
      unit_code: input.unitCode ?? null,
      access_log_id: input.accessLogId ?? null,
      created_by: input.createdBy ?? null,
    });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ese estacionamiento se acaba de ocupar." };
    }
    return { ok: false, error: "No se pudo asignar el estacionamiento." };
  }
  return { ok: true };
}

/**
 * Libera el estacionamiento de una patente.
 *
 * Se llama al registrar la salida: el auto se va, el lugar queda libre. Si la
 * patente no tenía estacionamiento asignado no pasa nada — mucha gente entra
 * caminando.
 */
export async function releaseByPlate(
  buildingId: string,
  plate: string,
  releasedBy?: string | null
): Promise<boolean> {
  const normalized = plate.toUpperCase().replace(/\s+/g, "");
  const { data, error } = await db()
    .from("parking_sessions")
    .update({ ended_at: new Date().toISOString(), released_by: releasedBy ?? null })
    .eq("building_id", buildingId)
    .eq("plate", normalized)
    .is("ended_at", null)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Liberar a mano desde el panel, cuando el auto se fue sin marcar salida. */
export async function releaseSession(
  buildingId: string,
  sessionId: string,
  releasedBy?: string | null
): Promise<void> {
  const { error } = await db()
    .from("parking_sessions")
    .update({ ended_at: new Date().toISOString(), released_by: releasedBy ?? null })
    .eq("building_id", buildingId)
    .eq("id", sessionId)
    .is("ended_at", null);
  if (error) throw error;
}

// ── El estacionamiento visto desde el departamento ─────────────────

/**
 * Los estacionamientos de una unidad, con quién los ocupa y hasta cuándo
 * están prestados. Es lo que el residente ve en su portal.
 */
export async function getSpotsForUnit(
  buildingId: string,
  unitCode: string
): Promise<MySpot[]> {
  const [spots, sessionsRes] = await Promise.all([
    getSpots(buildingId),
    db()
      .from("parking_sessions")
      .select("spot_id, plate, driver_name, started_at")
      .eq("building_id", buildingId)
      .is("ended_at", null),
  ]);
  if (sessionsRes.error) throw sessionsRes.error;

  const bySpot = new Map((sessionsRes.data ?? []).map((s) => [s.spot_id, s]));

  const ahora = Date.now();
  return spots
    .filter((s) => s.kind === "residente" && s.unit_code === unitCode && s.active)
    .map((s) => {
      const sesion = bySpot.get(s.id);
      return {
        id: s.id,
        code: s.code,
        unitCode: s.unit_code,
        notes: s.notes,
        lentUntil: s.lent_until,
        isLent: estaPrestado(s.lent_until, ahora),
        occupiedBy: sesion
          ? {
              plate: sesion.plate,
              driverName: sesion.driver_name,
              startedAt: sesion.started_at,
            }
          : null,
      };
    });
}

/**
 * Presta el estacionamiento hasta una fecha.
 *
 * Verifica que el estacionamiento sea de la unidad que lo presta: el id viaja
 * desde el navegador y no se puede confiar en él.
 */
export async function lendSpot(
  buildingId: string,
  spotId: string,
  unitCodes: string[],
  until: string,
  profileId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: spot, error: findError } = await db()
    .from("parking_spots")
    .select("id, unit_code, kind")
    .eq("id", spotId)
    .eq("building_id", buildingId)
    .maybeSingle();

  if (findError) return { ok: false, error: "No se pudo leer el estacionamiento" };
  if (!spot || spot.kind !== "residente" || !spot.unit_code || !unitCodes.includes(spot.unit_code)) {
    return { ok: false, error: "Ese estacionamiento no es de tu departamento" };
  }

  const { error } = await db()
    .from("parking_spots")
    .update({ lent_until: until, lent_by: profileId, lent_at: new Date().toISOString() })
    .eq("id", spotId)
    .eq("building_id", buildingId);

  if (error) return { ok: false, error: "No se pudo prestar el estacionamiento" };
  return { ok: true };
}

/** Deja de prestarlo. No echa al auto que ya está adentro. */
export async function cancelLoan(
  buildingId: string,
  spotId: string,
  unitCodes: string[]
): Promise<{ ok: boolean; error?: string }> {
  const { data: spot } = await db()
    .from("parking_spots")
    .select("id, unit_code")
    .eq("id", spotId)
    .eq("building_id", buildingId)
    .maybeSingle();

  if (!spot || !spot.unit_code || !unitCodes.includes(spot.unit_code)) {
    return { ok: false, error: "Ese estacionamiento no es de tu departamento" };
  }

  const { error } = await db()
    .from("parking_spots")
    .update({ lent_until: null, lent_by: null, lent_at: null })
    .eq("id", spotId)
    .eq("building_id", buildingId);

  if (error) return { ok: false, error: "No se pudo cancelar el préstamo" };
  return { ok: true };
}

// ── Autos del departamento ─────────────────────────────────────────

export async function getVehiclesForResidents(
  buildingId: string,
  residentIds: string[]
): Promise<ResidentVehicle[]> {
  if (residentIds.length === 0) return [];
  const { data, error } = await db()
    .from("resident_vehicles")
    .select("id, plate, model, resident_id")
    .eq("building_id", buildingId)
    .in("resident_id", residentIds)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((v) => ({
    id: v.id,
    plate: v.plate,
    model: v.model,
    residentId: v.resident_id,
  }));
}

/** ¿De quién es este auto? Lo pregunta la portería al tipear una patente. */
export async function findVehicleByPlate(
  buildingId: string,
  plate: string
): Promise<{ plate: string; model: string | null; unitCode: string; residentName: string } | null> {
  const normalized = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length < 4) return null;

  // Dos consultas en vez de un join: los tipos generados no describen las
  // relaciones, y un join sin tipar se vuelve `any` sin que nadie avise.
  const { data: vehiculo } = await db()
    .from("resident_vehicles")
    .select("plate, model, resident_id")
    .eq("building_id", buildingId)
    .eq("plate", normalized)
    .maybeSingle();

  if (!vehiculo) return null;

  const { data: residente } = await db()
    .from("residents")
    .select("unit_code, name")
    .eq("id", vehiculo.resident_id)
    .maybeSingle();

  if (!residente) return null;

  return {
    plate: vehiculo.plate,
    model: vehiculo.model,
    unitCode: residente.unit_code,
    residentName: residente.name,
  };
}

export async function addVehicle(
  buildingId: string,
  residentId: string,
  plate: string,
  model: string | null,
  profileId: string
): Promise<{ ok: boolean; error?: string }> {
  const normalized = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length < 4) return { ok: false, error: "Esa patente es muy corta" };

  const { error } = await db().from("resident_vehicles").insert({
    building_id: buildingId,
    resident_id: residentId,
    plate: normalized,
    model: model?.trim() || null,
    created_by: profileId,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Esa patente ya está registrada en el edificio" };
    }
    return { ok: false, error: "No se pudo guardar el auto" };
  }
  return { ok: true };
}

export async function removeVehicle(
  buildingId: string,
  vehicleId: string,
  residentIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await db()
    .from("resident_vehicles")
    .delete()
    .eq("id", vehicleId)
    .eq("building_id", buildingId)
    .in("resident_id", residentIds)
    .select("id");

  if (error) return { ok: false, error: "No se pudo borrar el auto" };
  if ((data ?? []).length === 0) return { ok: false, error: "Ese auto no es de tu departamento" };
  return { ok: true };
}
