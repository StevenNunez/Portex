import type { ResidentRow } from "@/lib/db";

/**
 * Cosas del padrón que necesitan saber tanto el servidor como el navegador.
 * Van acá y no en `db.ts` porque ese módulo abre conexión a Supabase y no
 * puede viajar a un componente de cliente.
 */

/**
 * El correo con el que se puede invitar a este residente al portal.
 *
 * Primero el de una invitación anterior —es el que ya está asociado a su
 * cuenta—; si no hubo, sirve `contact`, pero solo cuando trae un correo:
 * en la mayoría de los padrones ese campo es un teléfono.
 */
export function correoDeResidente(r: ResidentRow): string {
  if (r.invite_email) return r.invite_email.trim();
  const c = r.contact?.trim() ?? "";
  return c.includes("@") ? c : "";
}

/** A quiénes tiene sentido mandarles invitación: no tienen cuenta y hay correo. */
export function invitables(rows: ResidentRow[]): { id: string; email: string; unidad: string; nombre: string }[] {
  return rows
    .filter((r) => !r.tieneCuenta && correoDeResidente(r))
    .map((r) => ({ id: r.id, email: correoDeResidente(r), unidad: r.unit_code, nombre: r.name }));
}

/** Los que quedan fuera de una invitación masiva porque nadie anotó su correo. */
export function sinCorreo(rows: ResidentRow[]): ResidentRow[] {
  return rows.filter((r) => !r.tieneCuenta && !correoDeResidente(r));
}

/** Tienen correo y nunca se les mandó nada. */
export function nuncaInvitados(rows: ResidentRow[]): ResidentRow[] {
  return rows.filter((r) => !r.tieneCuenta && !r.invited_at && correoDeResidente(r));
}

/**
 * Ya recibieron el correo pero nunca crearon su contraseña. Volver a
 * invitarlos es legítimo —el correo se pierde, se va a spam— pero el
 * administrador tiene que saber que está reenviando, no invitando.
 */
export function invitadosSinEntrar(rows: ResidentRow[]): ResidentRow[] {
  return rows.filter((r) => !r.tieneCuenta && r.invited_at && correoDeResidente(r));
}


/**
 * Un código de unidad reducido a lo que de verdad lo identifica.
 *
 * Los padrones guardan el mismo departamento de mil formas: "A · 0307",
 * "A-0307", "a0307". El vecino que teclea su unidad en el cartel del ascensor
 * escribe la que él usa, no la que quedó en el Excel del administrador. Sin
 * esto, aprobarlo crearía un departamento **duplicado** al lado del que ya
 * existía — justo lo que la aprobación del conserje debería evitar.
 *
 * Se dejan solo letras y números: separadores, espacios y puntos medios se
 * caen. Los ceros a la izquierda **no** se tocan a propósito: "010" y "10"
 * pueden ser dos departamentos distintos y adivinar ahí sería peor.
 */
export function normalizarUnidad(codigo: string): string {
  return codigo
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Encuentra en el padrón la unidad que el vecino quiso escribir y devuelve el
 * código **tal como está guardado**, para que todo lo que venga después
 * apunte a la misma fila.
 */
export function unidadCanonica(escrita: string, delPadron: string[]): string | null {
  const objetivo = normalizarUnidad(escrita);
  if (!objetivo) return null;
  return delPadron.find((u) => normalizarUnidad(u) === objetivo) ?? null;
}
