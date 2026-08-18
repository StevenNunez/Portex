import type { ParkingKind } from "./database.types";

/**
 * Tipos del módulo de estacionamientos.
 *
 * Viven separados de `parking.ts` porque ese archivo es `server-only` (usa el
 * service role) y la portería necesita estas formas para pintar la propuesta
 * en pantalla.
 */

export interface ParkingSpotRow {
  id: string;
  code: string;
  kind: ParkingKind;
  unit_code: string | null;
  active: boolean;
  notes: string | null;
  /** Hasta cuándo su dueño lo dejó disponible para visitas. */
  lent_until: string | null;
}

export interface OccupiedSpot extends ParkingSpotRow {
  /** Si el préstamo está vigente ahora. Se resuelve en el servidor: el
   *  render no puede mirar el reloj sin volverse impredecible. */
  lent: boolean;
  session: {
    id: string;
    plate: string;
    driver_name: string | null;
    unit_code: string | null;
    started_at: string;
  } | null;
}

/** Por qué se propone este estacionamiento y no otro. */
export type SuggestionReason = "unidad" | "visita" | "prestado";

export interface ParkingSuggestion {
  spot: ParkingSpotRow;
  reason: SuggestionReason;
}

export interface ParkingAvailability {
  /** Qué se le ofrece a esta visita, o null si no hay dónde ponerla. */
  suggestion: ParkingSuggestion | null;
  /** El del departamento, si existe: para poder decir "ocupado" en vez de callar. */
  unitSpot: { code: string; occupied: boolean } | null;
  freeVisitorSpots: number;
  totalVisitorSpots: number;
  /** Cupos que otros residentes prestaron y están libres ahora. */
  freeLentSpots: number;
}

/** Lo que el residente ve de su propio estacionamiento. */
export interface MySpot {
  id: string;
  code: string;
  unitCode: string | null;
  notes: string | null;
  /** Hasta cuándo lo prestó, si lo prestó. */
  lentUntil: string | null;
  /** Si ese préstamo sigue vigente. */
  isLent: boolean;
  /** Quién lo está ocupando ahora mismo. */
  occupiedBy: { plate: string; driverName: string | null; startedAt: string } | null;
}

export interface ResidentVehicle {
  id: string;
  plate: string;
  model: string | null;
  residentId: string;
}
