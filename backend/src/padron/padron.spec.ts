import { parseRow } from './padron.service';

/**
 * El maestro exportado por Excel trae los headers con padding: 8 de las 16
 * columnas terminan en espacio. Estos tests usan los headers **literales** del
 * archivo, padding incluido.
 *
 * Antes, en #8: `COL_MAP` tenía claves `'Plan '` y `'Legajo '`, que existen para
 * "acomodar" ese padding. Son inalcanzables: la clave de búsqueda es
 * `header.trim()`, y un `trim()` nunca devuelve una cadena terminada en
 * espacio. El padding lo resuelve el `trim()`, siempre lo resolvió. Estos
 * tests existen para que esa cobertura sea explícita y comprobada, y para que
 * nadie vuelva a agregar un alias de espacio final creyendo que hace falta.
 */

/** Los 16 headers de `csv/maestro.xlsx - Hoja2.csv`, fila 6, sin recortar. */
const HEADER_REAL = [
  'Esp.',
  'Plan ',
  'Legajo ',
  'Ingr.',
  'N°Documento    ',
  'Apellido y Nombres                      ',
  'Regularizadas',
  'Cursando año actual',
  'Total Aprobadas',
  'Prom.c/Apl',
  'Estado                        ',
  'Domicilio                               ',
  'Número',
  'Depto',
  'LOCALIDAD                                                   ',
  'Cant.  ',
];

const COL = Object.fromEntries(HEADER_REAL.map((h, i) => [h, i]));

/** Fila de ejemplo: Dalle, del archivo real (ranking CSV línea 308). */
const FILA = [
  '84', // Esp.
  '95', // Plan
  '29.366', // Legajo
  '2.019', // Ingr.
  '46.464.433', // N°Documento
  '"Dalke, Katherina Anyelén"', // Apellido y Nombres (con coma, va citado)
  '25', // Regularizadas
  '9', // Cursando año actual
  '23', // Total Aprobadas
  '7,88', // Prom.c/Apl
  'Activo', // Estado
  '', // Domicilio
  '', // Número
  '', // Depto
  'LA PLATA', // LOCALIDAD
  '1.985', // Cant.
];

describe('parseRow — el header del maestro viene con padding de Excel', () => {
  it('el archivo real tiene 8 headers terminados en espacio, de 16', () => {
    // Guarda contra una versión futura del archivo sin padding: los tests
    // seguirían verdes, pero dejarían de estar probando lo que dicen probar.
    expect(HEADER_REAL).toHaveLength(16);
    const conPadding = HEADER_REAL.filter((h) => h !== h.trim());
    expect(conPadding).toHaveLength(8);
  });

  it('lee una fila completa', () => {
    const row = parseRow(HEADER_REAL, FILA);
    expect(row).not.toBeNull();
    expect(row.dni).toBe('46464433');
    expect(row.legajo).toBe('29.366');
    expect(row.nombreCompleto).toBe('"Dalke, Katherina Anyelén"');
    expect(row.especialidadCodigo).toBe(84);
    expect(row.anioIngreso).toBe(2019);
    expect(row.regularizadas).toBe(25);
    expect(row.cursando).toBe(9);
    expect(row.aprobadas).toBe(23);
    expect(row.promedio).toBe(7.88);
    expect(row.estado).toBe('Activo');
  });

  describe('alias con espacio final: el trim() ya lo cubre', () => {
    it('`plan` se puebla aunque el header sea "Plan "', () => {
      // Este es el test que justifies borrar el alias `'Plan '`. Si algún día
      // `plan` deja de poblarse, este test es el que lo avisa.
      expect(FILA[COL['Plan ']]).toBe('95');
      const row = parseRow(HEADER_REAL, FILA)!;
      expect(row.plan).toBe(95);
    });

    it('`legajo` se puebla aunque el header sea "Legajo "', () => {
      expect(FILA[COL['Legajo ']]).toBe('29.366');
      const row = parseRow(HEADER_REAL, FILA)!;
      expect(row.legajo).toBe('29.366');
    });

    it('los otros 4 headers con padding también', () => {
      const row = parseRow(HEADER_REAL, FILA)!;
      expect(row.dni).toBe('46464433'); // 'N°Documento    '
      expect(row.estado).toBe('Activo'); // 'Estado   '
      // 'Apellido y Nombres   ' y 'LOCALIDAD  ' no tienen campo en COL_MAP:
      // el segundo se descarta a propósito (ver `Cant.` más abajo) y el
      // primero sí, a través de su forma recortada.
      expect(row.nombreCompleto).toBe('"Dalke, Katherina Anyelén"');
    });
  });

  it('el mismo archivo con los headers recortados da el mismo resultado', () => {
    // Si el padding se resolviera con un alias y no con el `trim()`, quitarlo
    // rompería algo. Esto fija que quitar los alias fue un no-op.
    const recortado = HEADER_REAL.map((h) => h.trim());
    expect(parseRow(recortado, FILA)).toEqual(parseRow(HEADER_REAL, FILA));
  });

  describe('`plan` es un código de plan, no un total de materias', () => {
    it('el maestro trae 95 para la mayoría, y años para otros', () => {
      // Medido sobre las 26.935 filas del maestro: 95 aparece 13.666 veces,
      // y después 2.003 (1.651), 2.023 (3.587), 2.024 (1.224), 99, 98… o sea
      // la columna mezcla números de plan con años de ingreso. Serviría de
      // denominador para `cursadas × 3 / totalMateriasPlan` sólo si valiera
      // 42 (ISI), 45 (IEM/IQ) o 36 (LAR), y no: vale 95.
      const conPlan95 = parseRow(HEADER_REAL, FILA)!;
      expect(conPlan95.plan).toBe(95);
      expect(conPlan95.plan).not.toBe(42); // ni el total de ISI
    });

    it('un año se lee como año, no como código', () => {
      // El punto es separador de miles: "2.019" → 2019, no 2.019 ni 2019.019.
      const conPlanAnio = [...FILA];
      conPlanAnio[COL['Plan ']] = '2.019';
      expect(parseRow(HEADER_REAL, conPlanAnio)!.plan).toBe(2019);
    });
  });

  describe('columnas que el padrón descarta a propósito', () => {
    it('`Cant.` NO se guarda en `aplazos`, aunque haya dato', () => {
      // FILA trae "1.985" en `Cant.` y `aplazos` sale 0. No es que el campo se
      // omita: `cargarMaestro` hace `update: { ...row }` y Prisma sólo pisa los
      // campos presentes en el objeto, así que omitirlo dejaría congelado el
      // valor viejo de la fila. Ese caso es real, no hipotético: hay filas ya
      // importadas con el `Cant.` de antes, y sin el 0 explícito reimportar el
      // padrón no las corregiría nunca.
      const row = parseRow(HEADER_REAL, FILA)!;
      expect(FILA[COL['Cant.  ']]).toBe('1.985');
      expect(row.aplazos).toBe(0);
      expect(row.aplazos).not.toBe(1985);
    });

    it('`Cant.` es una segunda columna de aprobadas, no un número de domicilio', () => {
      // El motivo real por el que `Cant.` no sirve como aplazos. Medido sobre las
      // 26.936 filas del maestro: `Cant.` coincide con `Total Aprobadas` en el
      // 92.8%, y NUNCA es menor (0 en el 82.2%, de +1 a +11 en el resto). La
      // hipótesis anterior —que era un campo de domicilio, por estar después de
      // `LOCALIDAD`— es falsa: la conclusión era correcta por el motivo
      // equivocado. Para el 42732664 (Brites, Agustín Ezequiel) `Cant.` vale 43
      // y la planilla de orden de mérito dice 1 aplazo; de ahí el "43 aplazos"
      // que se veía en la pantalla de inscripciones.
      const fila = [...FILA];
      fila[COL['Cant.  ']] = '43';
      const row = parseRow(HEADER_REAL, fila)!;
      expect(row.aplazos).toBe(0);
      expect(row.aplazos).not.toBe(43);
    });
  });

  describe('filas que se descartan', () => {
    it('devuelve null si no hay DNI', () => {
      const sinDni = [...FILA];
      sinDni[COL['N°Documento    ']] = '';
      expect(parseRow(HEADER_REAL, sinDni)).toBeNull();
    });

    it('devuelve null si el DNI es 0 o sólo espacios', () => {
      for (const valor of ['0', '   ', '.', '']) {
        const fila = [...FILA];
        fila[COL['N°Documento    ']] = valor;
        expect(parseRow(HEADER_REAL, fila)).toBeNull();
      }
    });

    it('un DNI de ceros como "0.000" NO se descarta (laguna preexistente)', () => {
      // El guard es `dni === '0'`, o sea un literal. `leerDni('0.000')` deja
      // '0000', que no es '0', así que la fila entra al padrón con un DNI de
      // relleno. Preexistente: el código anterior tampoco lo rechazaba. No se
      // corrige en #8 porque el maestro real no tiene ninguna fila así —de
      // 26.936 datos, el único DNI inválido es un '0' literal— y el arreglo
      // pertenece a la revisión de filas basura junto con el resto.
      const fila = [...FILA];
      fila[COL['N°Documento    ']] = '0.000';
      expect(parseRow(HEADER_REAL, fila)!.dni).toBe('0000');
    });
  });
});
