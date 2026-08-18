export const BUILDING_ID = "00000000-0000-0000-0000-000000000001";

export const CURRENT_STAFF = "Conserje";

export type TileId = "visita" | "entrega" | "proveedor" | "salida" | "qr";

export interface Tile {
  id: TileId;
  label: string;
  hint: string;
  primary?: true;
  alert?: true;
  /** Texto chico de arriba. Por defecto, el tile registra un ingreso. */
  kicker?: string;
}

export const TILES: Tile[] = [
  { id: "visita",    label: "Visita",    hint: "Persona, conductor",    primary: true },
  { id: "entrega",   label: "Entrega",   hint: "Delivery, encomienda"                },
  { id: "proveedor", label: "Proveedor", hint: "Mantención, obra"                    },
  { id: "salida",    label: "Salida",    hint: "Marcar salida",         alert: true  },
  // El pase ya viene autorizado por la unidad: escanear es solo confirmar
  // que quien llegó es a quien esperaban.
  { id: "qr",        label: "Escanear",  hint: "Pase con QR o código", kicker: "PASE ANTICIPADO" },
];
