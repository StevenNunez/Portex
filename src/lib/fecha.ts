/**
 * "Hoy" para un condominio chileno.
 *
 * `new Date().toISOString()` da la fecha en UTC, y eso no es lo que entiende
 * por "hoy" el conserje de turno: desde las 20:00 de Chile, UTC ya está en el
 * día siguiente. Con el cálculo ingenuo, el panel pedía los movimientos de
 * mañana y mostraba cero ingresos justo durante el turno de noche.
 *
 * En Vercel el servidor corre en UTC, así que la zona no se puede dejar
 * implícita: se fija acá. El día lo resuelve `Intl`, que ya sabe cuándo entra
 * y sale el horario de verano.
 *
 * Si algún día Portex se vende fuera de Chile, esto pasa a ser una columna
 * `timezone` en `buildings` y este módulo recibe el edificio.
 */

export const TIMEZONE = "America/Santiago";

/** La fecha de hoy en Chile, como "YYYY-MM-DD". */
export function todayInChile(now: Date = new Date()): string {
  // 'en-CA' formatea como YYYY-MM-DD, que es justo lo que espera Postgres.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Cuántas horas está Chile detrás de UTC en este instante (4 o 3). */
function offsetHours(now: Date): number {
  // Se compara la misma hora leída en Chile contra la leída en UTC.
  const enChile = new Date(now.toLocaleString("en-US", { timeZone: TIMEZONE }));
  const enUtc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((enUtc.getTime() - enChile.getTime()) / 3_600_000);
}

/**
 * El instante UTC en que empezó el día de hoy en Chile, listo para comparar
 * contra `recorded_at` (que es timestamptz).
 */
export function startOfTodayUtc(now: Date = new Date()): string {
  return startOfDayUtc(todayInChile(now), now);
}

/** Lo mismo para una fecha "YYYY-MM-DD" cualquiera. */
export function startOfDayUtc(date: string, now: Date = new Date()): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d, offsetHours(now), 0, 0);
  return new Date(utc).toISOString();
}

/** La hora (0–23) en que ocurrió algo, leída en Chile. */
export function hourInChile(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      hour12: false,
    }).format(new Date(iso))
  );
}

/** La fecha en Chile de hace `days` días, como "YYYY-MM-DD". */
export function daysAgoInChile(days: number, now: Date = new Date()): string {
  return todayInChile(new Date(now.getTime() - days * 86_400_000));
}

/**
 * Minutos transcurridos desde la medianoche en Chile. Es la unidad con la
 * que se compara un marcaje contra la hora de un turno (`start_time` viene
 * de Postgres como "08:00:00"), sin arrastrar la fecha ni la zona.
 */
export function minutesOfDayInChile(when: Date | string = new Date()): number {
  const d = typeof when === "string" ? new Date(when) : when;
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .split(":")
    .map(Number);
  return h * 60 + m;
}

/** "08:30:00" → 510. Las horas de turno vienen así desde Postgres. */
export function minutesFromTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}
