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


/**
 * Cómo escribe **este** edificio sus códigos de unidad.
 *
 * No hay un formato único: el padrón del demo guarda "A · 0307", el importador
 * de Excel arma "A-101", y un edificio de una sola torre usa "1204" pelado. Si
 * el administrador crea un residente a mano y le sale un formato distinto al
 * del resto, queda un departamento duplicado que nadie nota hasta que el
 * conserje busca por unidad y no encuentra nada.
 *
 * Así que en vez de imponer un formato, se lee el que ya usa el edificio.
 */
export interface FormatoUnidad {
  /** Lo que va entre la torre y el número: " · ", "-", o nada. */
  separador: string;
  /** A cuántos dígitos se rellena el número, 0 si no se rellena. */
  digitos: number;
  /** Las torres que ya existen, para ofrecerlas. */
  torres: string[];
}

export function formatoDeUnidad(codigos: string[]): FormatoUnidad {
  const separadores = new Map<string, number>();
  const torres = new Set<string>();
  const anchos: number[] = [];
  let conCeroAdelante = 0;

  for (const codigo of codigos) {
    // El separador es lo que haya entre la parte de torre y la numérica.
    const m = codigo.match(/^(.*?)([\s·.\-_]+)(\d+)$/);
    if (m) {
      separadores.set(m[2], (separadores.get(m[2]) ?? 0) + 1);
      torres.add(m[1].trim());
      anchos.push(m[3].length);
      if (m[3].length > 1 && m[3].startsWith("0")) conCeroAdelante++;
    } else {
      const soloNumero = codigo.match(/^(\d+)$/);
      if (soloNumero) {
        separadores.set("", (separadores.get("") ?? 0) + 1);
        anchos.push(soloNumero[1].length);
        if (soloNumero[1].length > 1 && soloNumero[1].startsWith("0")) conCeroAdelante++;
      }
    }
  }

  const separador = [...separadores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

  // Solo se rellena con ceros si el edificio **ya** lo hace y lo hace parejo:
  // adivinarlo cuando no hay evidencia crea el duplicado que se quiere evitar.
  const parejo = anchos.length > 0 && anchos.every((a) => a === anchos[0]);
  const digitos = conCeroAdelante > 0 && parejo ? anchos[0] : 0;

  return {
    separador,
    digitos,
    torres: [...torres].filter(Boolean).sort(),
  };
}

/** Arma el código con el formato del edificio. Devuelve "" si falta el número. */
export function construirUnidad(torre: string, depto: string, formato: FormatoUnidad): string {
  const numero = depto.trim().toUpperCase();
  if (!numero) return "";

  // Se rellena solo si es un número puro: "4B" o "PH-1" se dejan como están.
  const relleno =
    formato.digitos > 0 && /^\d+$/.test(numero)
      ? numero.padStart(formato.digitos, "0")
      : numero;

  const t = torre.trim();
  if (!t) return relleno;

  // Si esa torre ya existe, se escribe **como está escrita en el padrón**.
  // Sin esto, teclear "norte" en un edificio que guarda "Norte" creaba
  // "NORTE-404" al lado de "Norte-201": dos torres donde hay una.
  const conocida = formato.torres.find(
    (existente) => existente.toLowerCase() === t.toLowerCase()
  );

  return `${conocida ?? t.toUpperCase()}${formato.separador || "-"}${relleno}`;
}
