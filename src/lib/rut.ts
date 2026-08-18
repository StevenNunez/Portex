/**
 * El RUT es la identidad en Portex: es lo primero que pide el conserje y
 * la llave con la que el sistema reconoce a quien ya vino antes.
 *
 * Se guarda siempre normalizado (sin puntos ni guion, K mayúscula) para
 * que "26011410-7", "26.011.410-7" y "260114107" sean la misma persona.
 */

/** "26.011.410-7" → "260114107" */
export function normalizeRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}

/** "260114107" → "26.011.410-7" */
export function formatRut(rut: string): string {
  const clean = normalizeRut(rut);
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}

/** Dígito verificador, módulo 11. Evita tipeos en la portería. */
export function isValidRut(rut: string): boolean {
  const clean = normalizeRut(rut);
  if (clean.length < 7 || clean.length > 9) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;

  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const rest = 11 - (sum % 11);
  const expected = rest === 11 ? "0" : rest === 10 ? "K" : String(rest);
  return dv === expected;
}

/**
 * Formatea mientras el conserje escribe, sin pelear con el cursor:
 * se reformatea entero en cada tecla porque siempre se escribe al final.
 */
export function formatRutInput(value: string): string {
  const clean = normalizeRut(value);
  if (clean.length <= 1) return clean;
  return formatRut(clean);
}
