import { leerNumero, leerEntero, leerDni } from './numero';

/**
 * Los tres parsers que había (`padron`, `importacion`, `ranking`) usaban
 * `.replace(',', '.')` **sin la g**, así que cambiaban sólo la primera coma.
 * Estos tests fijan el comportamiento correcto y, sobre todo, los casos que
 * antes devolvían un número equivocado en silencio.
 */

describe('leerNumero — formato argentino (el de estos archivos)', () => {
  it('interpreta la coma decimal', () => {
    expect(leerNumero('7,88')).toBe(7.88);
    expect(leerNumero('0,50')).toBe(0.5);
    expect(leerNumero('8,03')).toBe(8.03);
  });

  it('interpreta coma decimal con punto de miles', () => {
    // Éste es el caso que los tres parsers viejos rompían.
    expect(leerNumero('1.234,56')).toBe(1234.56);
    expect(leerNumero('1.234.567,89')).toBe(1234567.89);
    expect(leerNumero('12.345,00')).toBe(12345);
  });

  it('el valor real de la planilla de 2026 sigue leyéndose igual', () => {
    // Regresión contra el archivo real: promedios de 7 a 8 con coma.
    expect(leerNumero('8,03')).toBe(8.03);
    expect(leerNumero('7,88')).toBe(7.88);
    expect(leerNumero('8,3')).toBe(8.3);
    expect(leerNumero('8')).toBe(8);
  });
});

describe('leerNumero — formato con punto decimal', () => {
  it('deja el punto como decimal', () => {
    expect(leerNumero('7.88')).toBe(7.88);
    expect(leerNumero('0.5')).toBe(0.5);
  });

  it('trata un punto solo con miles como entero', () => {
    // "1.234" es ambiguo. Los promedios van de 0 a 10, así que 1.234 como
    // promedio es imposible y 1234 es la lectura correcta.
    expect(leerNumero('12.345')).toBe(12345);
    expect(leerNumero('2.024')).toBe(2024);
  });
});

describe('leerNumero — entradas que no son números', () => {
  it('devuelve 0 en vez de NaN, para no arrastrar el error al puntaje', () => {
    // `ranking.service.ts` devolvía NaN con texto no numérico, y un NaN se
    // propaga a toda la operación en vez de ubicar el dato faltante.
    expect(leerNumero('N/A')).toBe(0);
    expect(leerNumero('sin datos')).toBe(0);
    expect(leerNumero('Activo')).toBe(0);
    expect(leerNumero('')).toBe(0);
    expect(leerNumero('   ')).toBe(0);
    expect(leerNumero(null)).toBe(0);
    expect(leerNumero(undefined)).toBe(0);
    expect(leerNumero(NaN)).toBe(0);
    expect(leerNumero(Infinity)).toBe(0);
  });

  it('nunca devuelve NaN, pase lo que pase', () => {
    for (const v of [
      'abc',
      '',
      '  ',
      ',',
      '.',
      '..',
      ',,',
      '1,2,3',
      null,
      undefined,
    ]) {
      expect(Number.isNaN(leerNumero(v))).toBe(false);
    }
  });
});

describe('leerNumero — formatos tolerados', () => {
  it('acepta negativos y paréntesis contables', () => {
    expect(leerNumero('-3,5')).toBe(-3.5);
    expect(leerNumero('(1.234)')).toBe(-1234);
  });

  it('ignora porcentaje y moneda', () => {
    expect(leerNumero('8,3%')).toBe(8.3);
    expect(leerNumero('$ 1.500,50')).toBe(1500.5);
  });

  it('pasa los números sin tocarlos', () => {
    expect(leerNumero(42)).toBe(42);
    expect(leerNumero(7.88)).toBe(7.88);
    expect(leerNumero(0)).toBe(0);
    expect(leerNumero(-2.5)).toBe(-2.5);
  });

  it('tolera espacios alrededor', () => {
    expect(leerNumero('  7,88  ')).toBe(7.88);
  });
});

describe('leerNumero — comportamiento medido de los parsers que reemplazó', () => {
  // Cada fila es lo que devolvía cada parser viejo ante esa entrada, medido
  // corriendo los parsers viejos, y no lo que se suponía. La columna
  // "correcto" es la que ahora devuelve `leerNumero`. Fijar la tabla evita
  // relajar el parser más adelante suponiendo que el valor raro era el normal.
  //
  // Se anotan los valores medidos en vez de volver a llamar a los parsers viejos
  // para que la tabla sea la referencia y no una función del parser viejo: si
  // alguien reintroduce uno de esos `replace`, la tabla tiene que seguir
  // diciendo qué devolvía.
  const CASOS = [
    // entrada,      padron, ranking, conteo, correcto
    {
      entrada: '7,88',
      padron: 7.88,
      ranking: 7.88,
      conteo: NaN,
      correcto: 7.88,
    },
    {
      entrada: '8,03',
      padron: 8.03,
      ranking: 8.03,
      conteo: NaN,
      correcto: 8.03,
    },
    {
      entrada: '1.234,56',
      padron: 1.234,
      ranking: 0,
      conteo: NaN,
      correcto: 1234.56,
    },
    {
      entrada: '46.464.433',
      padron: 46.464,
      ranking: 0,
      conteo: NaN,
      correcto: 46464433,
    },
    {
      entrada: '12.345',
      padron: 12.345,
      ranking: 12.345,
      conteo: 12.345,
      correcto: 12345,
    },
    {
      entrada: '2.024',
      padron: 2.024,
      ranking: 2.024,
      conteo: 2.024,
      correcto: 2024,
    },
    { entrada: '8', padron: 8, ranking: 8, conteo: 8, correcto: 8 },
  ];

  it.each(CASOS)(
    '"$entrada" → $correcto (medido: algún parser viejo daba otra cosa)',
    ({ entrada, padron, ranking, conteo, correcto }) => {
      // Lo que el parser nuevo devuelve.
      expect(leerNumero(entrada)).toBe(correcto);

      // El de padron fallaba con separador de miles: 1.234 en vez de 1234.56.
      if (correcto >= 1000) expect(padron).not.toBe(correcto);
      // El de importación devolvía NaN sin filtro ante cualquier coma.
      if (entrada.includes(',')) expect(conteo).toBeNaN();
      // ranking.service.ts era el único que blindaba el NaN, pero a costa de
      // devolver 0 y perder el dato.
      if (entrada.includes(',') && correcto >= 1000) expect(ranking).toBe(0);
    },
  );

  it('el conteo viejo devolvía NaN y el nuevo nunca', () => {
    // Así era el parser de los conteos en `importacion.service.ts`: `Number(v)`
    // pelado, sin el filtro de `Number.isFinite` que sí tenía el de ranking.
    const viejoConteo = (v: any) => Number(v);
    expect(viejoConteo('7,88')).toBeNaN();
    expect(Number.isNaN(leerEntero('7,88'))).toBe(false);
    expect(leerEntero('7,88')).toBe(7);
  });
});

describe('leerEntero — conteos por naturaleza', () => {
  it('trunca en vez de devolver un decimal imposible', () => {
    expect(leerEntero('17,7')).toBe(17);
    expect(leerEntero('42.9')).toBe(42);
  });

  it('deja los enteros intactos', () => {
    expect(leerEntero('46')).toBe(46);
    expect(leerEntero('0')).toBe(0);
    expect(leerEntero('12.345')).toBe(12345);
  });

  it('devuelve 0 para vacío, igual que el `Number("")` de antes', () => {
    // Las celdas vacías de `Arpobadas`/`Cursadas` en el CSV de inscripciones
    // tienen que seguir dando 0, no undefined: es el comportamiento previo.
    expect(leerEntero('')).toBe(0);
    expect(leerEntero(null)).toBe(0);
  });
});

describe('leerDni', () => {
  it('quita los puntos de miles', () => {
    expect(leerDni('46.464.433')).toBe('46464433');
    expect(leerDni('46464433')).toBe('46464433');
  });

  it('queda vacío ante lo que no es un DNI, en vez de propagarlo', () => {
    // El código viejo comparaba contra los literales "undefined" y "null";
    // aquí no hace falta porque "undefined" no tiene dígitos.
    expect(leerDni('undefined')).toBe('');
    expect(leerDni('null')).toBe('');
    expect(leerDni('')).toBe('');
    expect(leerDni(null)).toBe('');
  });

  it('no pierde dígitos por un redondeo', () => {
    // Por eso el DNI no pasa por `leerNumero`: son 8 dígitos, no un número.
    expect(leerDni('12345678')).toBe('12345678');
  });
});
