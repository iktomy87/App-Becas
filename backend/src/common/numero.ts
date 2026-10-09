/**
 * Lectura de números que vienen de planillas y padrones.
 *
 * Existían tres parsers distintos, cada uno con su propia versión de un
 * `.replace(',', '.')` de una sola pasada, y los tres fallaban distinto:
 *
 *   - `padron.service.ts`       `parseFloat(String(v).replace(',', '.')) || 0`
 *   - `ranking.service.ts`      `Number(String(v).replace(',', '.'))`, con filtro
 *   - `importacion.service.ts`  `parseFloat(...)` para el promedio, pero
 *                               `Number(v)` **sin filtro** para los conteos
 *
 * Comportamiento medido de cada uno ante las mismas entradas:
 *
 *   | entrada        | padron  | ranking | importación (conteos) | correcto |
 *   |----------------|---------|---------|-----------------------|----------|
 *   | `7,88`         | 7.88    | 7.88    | **NaN**               | 7.88     |
 *   | `8,03`         | 8.03    | 8.03    | **NaN**               | 8.03     |
 *   | `1.234,56`     | 1.234   | 0       | **NaN**               | 1234.56  |
 *   | `46.464.433`   | 46.464  | 0       | **NaN**               | 46464433 |
 *   | `12.345`       | 12.345  | 12.345  | 12.345                | 12345    |
 *
 * El peor era `importacion.service.ts`: `Number('7,88')` es `NaN` y no había
 * ningún filtro, así que un conteo de materias escrito en formato argentino
 * envenenaba el puntaje entero. Un `NaN` no se ubica en el dato que falta: se
 * propaga a la suma, al ordenamiento y a la base.
 *
 * ## Cómo se decide el separador
 *
 * No se adivina: se decide por la estructura del texto, y el orden importa.
 *
 *   1. Si hay punto seguido de exactamente tres dígitos, es separador de miles
 *      (`1.234,56`, `12.345`, `46.464.433`). La coma, si está, es decimal.
 *   2. Si sólo hay coma, es el separador decimal: `7,88`.
 *   3. Si sólo hay punto con otra cantidad de dígitos, es decimal: `7.88`.
 *   4. Cualquier otra cosa no es un número, y se devuelve 0.
 *
 * El orden 1 antes que 3 resuelve la ambigüedad de `"1.234"`, que podría ser
 * `1234` o `1.234`. Se lee como `1234`: los promedios de estos archivos van de
 * 0 a 10, así que un promedio de 1,234 no existe. Para `2.024` (el año de
 * ingreso, con punto de miles) la decisión es la misma y también correcta.
 */

/** Caracteres que se normalizan: coma a punto. */
const COMA = ',';
const PUNTO = '.';

/**
 * Separador de miles, con coma decimal opcional: `1.234,56`, `12.345`, `2.024`,
 * `46.464.433`. El grupo `\.\d{3}` exige grupos de exactamente tres dígitos, que
 * es lo que distingue un separador de miles de un punto decimal.
 */
const MILES = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/;

/** Coma decimal y nada más: `7,88`, `0,50`, `-3,5`. */
const SOLO_COMA = /^[+-]?\d+(?:,\d+)?$/;

/** Punto decimal y nada más: `7.88`, `0.5`. */
const SOLO_PUNTO = /^[+-]?\d+(?:\.\d+)?$/;

/**
 * Convierte a número un valor de planilla, en cualquiera de los formatos que
 * aparecen en los archivos.
 *
 * Acepta `7,88`, `7.88`, `1.234,56`, `12.345`, `-1.234,56`, `8` y también
 * números que ya vengan como número.
 *
 * Lo que **no** acepta, y devuelve 0:
 *   - celdas vacías o sólo con espacios
 *   - `NaN`, `null`, `undefined`
 *   - texto no numérico (`"N/A"`, `"sin datos"`, `"Activo"`)
 *   - el símbolo `%` y los signos de moneda, que se ignoran
 *
 * Devolver 0 y no `NaN` es deliberado: estos valores alimentan el puntaje, y
 * un `NaN` no se queda en el dato que falta, se propaga a la suma, al
 * ordenamiento y a la base.
 */
export function leerNumero(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (valor == null) return 0;

  let texto = String(valor).trim();
  if (texto === '') return 0;

  // Paréntesis como negativo, forma contable habitual: `(1.234)` → -1234.
  let negativo = false;
  if (texto.startsWith('(') && texto.endsWith(')')) {
    negativo = true;
    texto = texto.slice(1, -1).trim();
  }

  // Se ignoran moneda y porcentaje: `8,3%` → 8.3, `$ 1.500` → 1500.
  texto = texto.replace(/[%$\s]/g, '');
  if (texto === '') return 0;

  let normalizado: string;
  if (MILES.test(texto)) {
    // "1.234,56" → los puntos son de miles y la coma es decimal.
    normalizado = texto.replace(/\./g, '').replace(COMA, PUNTO);
  } else if (SOLO_COMA.test(texto)) {
    // "7,88" → la coma es el único separador, entonces es decimal.
    normalizado = texto.replace(COMA, PUNTO);
  } else if (SOLO_PUNTO.test(texto)) {
    // "7.88" → el punto ya es decimal. "1.234" no llega acá: lo agarra MILES.
    normalizado = texto;
  } else {
    // No matchea ningún patrón conocido: texto no numérico. Se devuelve 0 en
    // vez de propagar NaN.
    return 0;
  }

  const n = Number(normalizado);
  if (!Number.isFinite(n)) return 0;
  return negativo ? -n : n;
}

/**
 * Igual que `leerNumero`, pero para campos que son enteros por naturaleza
 * (cantidades de materias, aplazos, años de ingreso).
 *
 * Un conteo nunca tiene decimales, así que `17,7` es 17 y no un error: el
 * archivo podría traer un promedio mal tipeado en la columna de al lado, y
 * truncar es más defendible que inventar.
 */
export function leerEntero(valor: unknown): number {
  return Math.trunc(leerNumero(valor));
}

/**
 * Para un DNI, que en estos archivos viene con puntos de miles
 * (`46.464.433`) o con ceros a la izquierda. Devuelve sólo dígitos.
 *
 * No usa `leerNumero` porque el DNI no es un número: perder un dígito por un
 * redondeo convertiría una persona en otra.
 */
export function leerDni(valor: unknown): string {
  if (valor == null) return '';
  return String(valor).replace(/\D/g, '');
}
