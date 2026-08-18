/**
 * Generador de códigos QR, sin dependencias.
 *
 * Portex no tiene librerías de UI y no vale la pena traer uno solo para
 * dibujar un cuadrado: lo que el pase necesita es corto (un token de 32
 * caracteres) y eso cabe en las versiones chicas del estándar.
 *
 * Alcance a propósito acotado a **versiones 1 a 6, modo byte, corrección M**:
 * hasta 106 bytes. Con eso no hacen falta las tablas de información de versión
 * (aparecen recién en la 7) y cada versión tiene un único patrón de
 * alineación, en el centro. Si algún día hay que codificar algo más largo,
 * `encode` avisa en vez de generar un QR malo.
 *
 * Referencia: ISO/IEC 18004. La disposición de módulos sigue la
 * implementación clásica de Kazuhiko Arase, que es la que todos los lectores
 * dan por buena.
 */

/**
 * Lo que lleva escrito el QR de un pase: este prefijo y el token.
 *
 * Vive acá, y no junto al resto del citófono, porque tanto la pantalla del
 * residente (que dibuja el QR) como la de portería (que lo lee) son
 * componentes de navegador, y `lib/citofono` es solo de servidor.
 */
export const QR_PREFIJO = "PORTEX:";

/** Lo que lleva escrito el QR de una encomienda. */
export const QR_ENCOMIENDA = "PORTEX-ENC:";

/** Corrección de errores M: aguanta ~15% del código dañado o tapado. */
const ECC_LEVEL_BITS = 0b00;

interface VersionSpec {
  /** Bytes de datos que caben (ya descontada la cabecera). */
  capacidad: number;
  /** Codewords de datos por bloque. */
  datosPorBloque: number;
  /** Codewords de corrección por bloque. */
  eccPorBloque: number;
  bloques: number;
  /** Centro del patrón de alineación; null en la versión 1, que no tiene. */
  alineacion: number | null;
}

// Versiones 1–6 con corrección M. En este rango todos los bloques de una
// misma versión son del mismo tamaño, lo que hace que la intercalación sea
// un simple zip.
const VERSIONES: Record<number, VersionSpec> = {
  1: { capacidad: 14,  datosPorBloque: 16, eccPorBloque: 10, bloques: 1, alineacion: null },
  2: { capacidad: 26,  datosPorBloque: 28, eccPorBloque: 16, bloques: 1, alineacion: 18 },
  3: { capacidad: 42,  datosPorBloque: 44, eccPorBloque: 26, bloques: 1, alineacion: 22 },
  4: { capacidad: 62,  datosPorBloque: 32, eccPorBloque: 18, bloques: 2, alineacion: 26 },
  5: { capacidad: 84,  datosPorBloque: 43, eccPorBloque: 24, bloques: 2, alineacion: 30 },
  6: { capacidad: 106, datosPorBloque: 27, eccPorBloque: 16, bloques: 4, alineacion: 34 },
};

// ── Aritmética en GF(256) ─────────────────────────────────────────
// La corrección Reed-Solomon vive en este cuerpo finito: multiplicar es
// sumar logaritmos, y por eso conviene tener las dos tablas listas.

const EXP = new Uint8Array(256);
const LOG = new Uint8Array(256);

{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // polinomio primitivo del estándar
  }
  EXP[255] = EXP[0];
}

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] + LOG[b]) % 255];
}

/** Polinomio generador para `grado` codewords de corrección. */
function generador(grado: number): number[] {
  let poly = [1];
  for (let i = 0; i < grado; i++) {
    const siguiente = [...poly, 0];
    for (let j = 0; j < poly.length; j++) {
      siguiente[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = siguiente;
  }
  return poly;
}

/** Los codewords de corrección de un bloque de datos. */
function ecc(datos: number[], cantidad: number): number[] {
  const gen = generador(cantidad);
  const resto = new Array<number>(cantidad).fill(0);

  for (const byte of datos) {
    const factor = byte ^ resto[0];
    resto.shift();
    resto.push(0);
    if (factor !== 0) {
      for (let i = 0; i < cantidad; i++) {
        resto[i] ^= mul(gen[i + 1], factor);
      }
    }
  }

  return resto;
}

// ── Máscaras ──────────────────────────────────────────────────────

const MASCARAS: ((i: number, j: number) => boolean)[] = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (_i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => ((((i * j) % 3) + ((i + j) % 2)) % 2) === 0,
];

// ── Construcción ──────────────────────────────────────────────────

type Matriz = (boolean | null)[][];

function versionPara(bytes: number): number {
  for (let v = 1; v <= 6; v++) {
    if (bytes <= VERSIONES[v].capacidad) return v;
  }
  throw new Error(
    `El texto no cabe en un QR de versión 6 (${bytes} bytes, máximo ${VERSIONES[6].capacidad})`
  );
}

/** Cabecera de modo byte + datos + relleno, hasta llenar la capacidad. */
function bitstream(datos: Uint8Array, spec: VersionSpec): number[] {
  const totalDatos = spec.datosPorBloque * spec.bloques;
  const bits: number[] = [];

  const push = (valor: number, largo: number) => {
    for (let i = largo - 1; i >= 0; i--) bits.push((valor >> i) & 1);
  };

  push(0b0100, 4);          // modo byte
  push(datos.length, 8);    // en versiones 1–9 la cuenta ocupa 8 bits
  for (const b of datos) push(b, 8);

  // Terminador y relleno hasta completar el último byte.
  const capacidadBits = totalDatos * 8;
  for (let i = 0; i < 4 && bits.length < capacidadBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    bytes.push(byte);
  }

  // Los dos bytes de relleno que manda el estándar, alternados.
  const RELLENO = [0xec, 0x11];
  let k = 0;
  while (bytes.length < totalDatos) bytes.push(RELLENO[k++ % 2]);

  return bytes;
}

/** Datos + corrección, ya intercalados como los espera el lector. */
function codewords(datos: number[], spec: VersionSpec): number[] {
  const bloquesDatos: number[][] = [];
  const bloquesEcc: number[][] = [];

  for (let b = 0; b < spec.bloques; b++) {
    const bloque = datos.slice(b * spec.datosPorBloque, (b + 1) * spec.datosPorBloque);
    bloquesDatos.push(bloque);
    bloquesEcc.push(ecc(bloque, spec.eccPorBloque));
  }

  const salida: number[] = [];
  for (let i = 0; i < spec.datosPorBloque; i++) {
    for (const bloque of bloquesDatos) salida.push(bloque[i]);
  }
  for (let i = 0; i < spec.eccPorBloque; i++) {
    for (const bloque of bloquesEcc) salida.push(bloque[i]);
  }
  return salida;
}

function matrizVacia(size: number): Matriz {
  return Array.from({ length: size }, () => new Array<boolean | null>(size).fill(null));
}

/** Los tres cuadrados de las esquinas, con su separador blanco. */
function ponerFinders(m: Matriz, size: number) {
  const esquinas = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];

  for (const [fila, col] of esquinas) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const y = fila + r;
        const x = col + c;
        if (y < 0 || y >= size || x < 0 || x >= size) continue;
        const borde = (r === 0 || r === 6) && c >= 0 && c <= 6;
        const lado = (c === 0 || c === 6) && r >= 0 && r <= 6;
        const centro = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m[y][x] = borde || lado || centro;
      }
    }
  }
}

/** El cuadradito de 5×5 que ayuda a corregir la perspectiva. */
function ponerAlineacion(m: Matriz, centro: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const borde = Math.max(Math.abs(r), Math.abs(c));
      m[centro + r][centro + c] = borde !== 1;
    }
  }
}

function ponerTiming(m: Matriz, size: number) {
  for (let i = 8; i < size - 8; i++) {
    // La línea alterna y es oscura en las posiciones pares.
    const oscuro = i % 2 === 0;
    if (m[6][i] === null) m[6][i] = oscuro;
    if (m[i][6] === null) m[i][6] = oscuro;
  }
}

/** Deja en blanco las celdas donde después va la información de formato. */
function reservarFormato(m: Matriz, size: number) {
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = false;
    if (m[i][8] === null) m[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = false;
    if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = false;
  }
  m[size - 8][8] = true; // el módulo siempre oscuro
}

/** Recorrido en zigzag de derecha a izquierda, de a dos columnas. */
function ponerDatos(m: Matriz, size: number, bytes: number[], mascara: number, reservado: boolean[][]) {
  const test = MASCARAS[mascara];
  let inc = -1;
  let fila = size - 1;
  let bit = 7;
  let byte = 0;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1; // la columna de timing no lleva datos
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (reservado[fila][x]) continue;

        let oscuro = false;
        if (byte < bytes.length) oscuro = ((bytes[byte] >>> bit) & 1) === 1;
        if (test(fila, x)) oscuro = !oscuro;
        m[fila][x] = oscuro;

        bit -= 1;
        if (bit === -1) {
          byte += 1;
          bit = 7;
        }
      }

      fila += inc;
      if (fila < 0 || fila >= size) {
        fila -= inc;
        inc = -inc;
        break;
      }
    }
  }
}

/** Información de formato: nivel de corrección + máscara, con su BCH. */
function ponerFormato(m: Matriz, size: number, mascara: number) {
  const datos = (ECC_LEVEL_BITS << 3) | mascara;
  let bch = datos << 10;
  for (let i = 4; i >= 0; i--) {
    if (bch & (1 << (i + 10))) bch ^= 0x537 << i;
  }
  const bits = ((datos << 10) | bch) ^ 0x5412;

  for (let i = 0; i < 15; i++) {
    const oscuro = ((bits >> i) & 1) === 1;

    // Copia vertical, junto al finder de arriba a la izquierda.
    if (i < 6) m[i][8] = oscuro;
    else if (i < 8) m[i + 1][8] = oscuro;
    else m[size - 15 + i][8] = oscuro;

    // Copia horizontal.
    if (i < 8) m[8][size - i - 1] = oscuro;
    else if (i < 9) m[8][15 - i] = oscuro;
    else m[8][14 - i] = oscuro;
  }

  m[size - 8][8] = true;
}

// ── Elección de máscara ───────────────────────────────────────────

/** Penaliza los patrones que confunden a un lector. Gana la más baja. */
function penalizacion(m: Matriz, size: number): number {
  const en = (r: number, c: number) => m[r][c] === true;
  let total = 0;

  // Regla 1: rachas de 5 o más del mismo color.
  for (let i = 0; i < size; i++) {
    for (const horizontal of [true, false]) {
      let racha = 1;
      for (let j = 1; j < size; j++) {
        const actual = horizontal ? en(i, j) : en(j, i);
        const previo = horizontal ? en(i, j - 1) : en(j - 1, i);
        if (actual === previo) {
          racha += 1;
          if (racha === 5) total += 3;
          else if (racha > 5) total += 1;
        } else {
          racha = 1;
        }
      }
    }
  }

  // Regla 2: bloques de 2×2 del mismo color.
  for (let i = 0; i < size - 1; i++) {
    for (let j = 0; j < size - 1; j++) {
      const v = en(i, j);
      if (v === en(i, j + 1) && v === en(i + 1, j) && v === en(i + 1, j + 1)) total += 3;
    }
  }

  // Regla 3: el patrón 1:1:3:1:1 que imita a un finder.
  const patron = [true, false, true, true, true, false, true, false, false, false, false];
  const patronInverso = [...patron].reverse();
  for (let i = 0; i < size; i++) {
    for (let j = 0; j <= size - 11; j++) {
      const filaOk = patron.every((p, k) => en(i, j + k) === p);
      const filaOkInv = patronInverso.every((p, k) => en(i, j + k) === p);
      const colOk = patron.every((p, k) => en(j + k, i) === p);
      const colOkInv = patronInverso.every((p, k) => en(j + k, i) === p);
      if (filaOk || filaOkInv) total += 40;
      if (colOk || colOkInv) total += 40;
    }
  }

  // Regla 4: desbalance entre módulos oscuros y claros.
  let oscuros = 0;
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) if (en(i, j)) oscuros += 1;
  const porcentaje = (oscuros * 100) / (size * size);
  total += Math.floor(Math.abs(porcentaje - 50) / 5) * 10;

  return total;
}

// ── API ───────────────────────────────────────────────────────────

/**
 * La matriz del QR: `true` es módulo oscuro. No incluye el margen blanco —
 * eso lo pone quien dibuja, porque depende del medio.
 */
export function encode(texto: string): boolean[][] {
  const datos = new TextEncoder().encode(texto);
  const version = versionPara(datos.length);
  const spec = VERSIONES[version];
  const size = 17 + version * 4;

  const bytes = codewords(bitstream(datos, spec), spec);

  // Los patrones fijos se calculan una vez; lo único que cambia entre
  // máscaras son los módulos de datos.
  const base = matrizVacia(size);
  ponerFinders(base, size);
  if (spec.alineacion != null) ponerAlineacion(base, spec.alineacion);
  ponerTiming(base, size);
  reservarFormato(base, size);

  const reservado = base.map((fila) => fila.map((celda) => celda !== null));

  let mejor: { matriz: Matriz; puntos: number } | null = null;

  for (let mascara = 0; mascara < 8; mascara++) {
    const m = base.map((fila) => [...fila]);
    ponerDatos(m, size, bytes, mascara, reservado);
    ponerFormato(m, size, mascara);
    const puntos = penalizacion(m, size);
    if (!mejor || puntos < mejor.puntos) mejor = { matriz: m, puntos };
  }

  return mejor!.matriz.map((fila) => fila.map((celda) => celda === true));
}

/**
 * El QR como un `<svg>` listo para incrustar.
 *
 * Se dibuja como un solo `path`: un rectángulo por módulo oscuro. Sale más
 * liviano que cientos de elementos y, sobre todo, se imprime y se escala sin
 * las líneas blancas entre celdas que aparecen al usar `<rect>` separados.
 */
export function toSvgPath(matriz: boolean[][]): string {
  const partes: string[] = [];
  for (let y = 0; y < matriz.length; y++) {
    for (let x = 0; x < matriz[y].length; x++) {
      if (matriz[y][x]) partes.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  return partes.join("");
}
