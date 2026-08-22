/**
 * Los tipos del autorregistro, aparte de `lib/autoregistro`.
 *
 * Ese módulo es `server-only` —abre conexión con la llave de servicio— y esta
 * forma la necesita también la pantalla de portería, que corre en el
 * navegador. Mismo motivo por el que existen `avisos-tipos` y `parking-types`.
 */

export interface SolicitudPendiente {
  id: string;
  unitCode: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  /** Si ese departamento ya existe en el padrón. */
  unidadConocida: boolean;
  /** Nombre del titular que figura en el padrón para esa unidad, si hay. */
  titularEnPadron: string | null;
}
