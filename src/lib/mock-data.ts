// Tipos de dominio que usan los componentes de UI.
// Los datos vienen todos de Supabase — no hay constantes hardcoded aquí.

import type { AccessType } from "./database.types";

export type { AccessType };

export interface ActivityItem {
  id?: string;
  t: string;
  dir: AccessType;
  who: string;
  ctx: string;
  unit: string;
  plate: string | null;
  by: string;
}

export interface Resident {
  id: string;
  unit: string;
  name: string;
  household: string | null;
  tags: string[];
}

export interface PendingParcel {
  /** Id de la encomienda (tabla `parcels`), no de la línea de bitácora. */
  id: string;
  /** Quién la trajo: Chilexpress, Amazon… */
  who: string;
  unit: string | null;
  context: string | null;
  recorded_at: string;
  residentName: string | null;
}

export interface FrequentVisitor {
  id: string;
  name: string;
  rut: string | null;
  reason: string | null;
  unit: string | null;
  last: string | null;
}
