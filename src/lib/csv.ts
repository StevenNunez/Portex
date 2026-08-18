/**
 * Lectura de CSV.
 *
 * Se escribe a mano en vez de traer una dependencia porque son treinta líneas
 * y el formato que hay que aguantar es acotado: lo que exporta Excel. Eso sí,
 * hay dos cosas que no se pueden ignorar y que rompen los parsers ingenuos:
 * los campos entre comillas que traen el separador adentro ("Pérez, Juan") y
 * las comillas escapadas duplicándolas ("").
 */

/** El BOM que Excel escribe al principio del archivo, si viene. */
const BOM = String.fromCharCode(0xfeff);

/** Deja cualquier celda (fecha, número, null) como el texto que se ve. */
export function toText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleDateString("es-CL");
  return String(value).trim();
}

export function parseCsv(input: string): string[][] {
  // Sin sacarlo, el BOM se pega al primer encabezado y la columna deja de
  // reconocerse.
  const text = input.startsWith(BOM) ? input.slice(1) : input;

  // Excel chileno exporta con `;`, el resto del mundo con `,`. Gana el que más
  // aparezca en la primera línea.
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const semis = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const sep = semis >= commas ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }  // comilla escapada
        else inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') { inQuotes = true; }
    else if (char === sep) { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") { field += char; }
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  return rows;
}

/** Arma un CSV que Excel abre bien en Chile: separador `;` y comillas. */
export function buildCsv(rows: string[][]): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return rows.map((row) => row.map(cell).join(";")).join("\r\n");
}

/** El mismo CSV, con el BOM que Excel necesita para las tildes. */
export function csvWithBom(rows: string[][]): string {
  return BOM + buildCsv(rows);
}
