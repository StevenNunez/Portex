/**
 * Los oficios que trabajan en un condominio.
 *
 * Empezó siendo solo portería, pero desde que existe el módulo de asistencia
 * también marca jornada el jardinero, el aseo y el maestro que viene a reparar:
 * gente que no tiene cuenta ni clave y que se identifica con su RUT en la
 * tablet.
 */
export const STAFF_ROLES = [
  "Conserje",
  "Conserje jefe",
  "Recepcionista",
  "Portero",
  "Jardinero",
  "Aseo",
  "Mantención",
  "Piscina",
  "Otro",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
