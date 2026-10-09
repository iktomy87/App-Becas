import { PadronAcademico } from '@prisma/client';
import {
  resolverDatosPlanillaVsPadron,
  normalizarLegajo,
  describirCambio,
} from './resolver-datos';

/**
 * El padrón es la fuente autorizada: cuando el maestro y la planilla discrepan,
 * gana el maestro. Estos tests fijan la regla y, sobre todo, sus tres límites,
 * que son los que impiden que la regla destruya datos.
 */

/**
 * Construye un padrón con los valores por defecto del modelo. `promedio` es
 * `Prisma.Decimal` en el modelo, pero el resolver sólo lo lee con `Number()`,
 * así que acá se pasan números y el casteo ocurre en el helper.
 */
function padron(over: Record<string, unknown> = {}): PadronAcademico {
  return {
    id: 'p1',
    dni: '40501524',
    legajo: '29366',
    nombreCompleto: 'Correa Sapiega, Luciano Agustin',
    especialidadCodigo: 8,
    plan: null,
    anioIngreso: 2020,
    regularizadas: 0,
    cursando: 0,
    aprobadas: 0,
    promedio: 0,
    aplazos: 0,
    estado: 'Activo',
    convocatoriaId: 'c1',
    ...over,
  } as unknown as PadronAcademico;
}

describe('normalizarLegajo', () => {
  it('ignora el separador de miles con el que viene el maestro', () => {
    expect(normalizarLegajo('29.366')).toBe('29366');
    expect(normalizarLegajo('29366')).toBe('29366');
    expect(normalizarLegajo(' 29.366 ')).toBe('29366');
  });

  it('deja vacío lo que no tiene dígitos', () => {
    expect(normalizarLegajo('')).toBe('');
    expect(normalizarLegajo(undefined)).toBe('');
    expect(normalizarLegajo('s/d')).toBe('');
  });
});

describe('resolverDatosPlanillaVsPadron — el padrón manda', () => {
  it('usa el promedio del padrón cuando difiere del de la planilla', () => {
    // Caso real: Correa Sapiega tiene 8,03 en la planilla y 8,00 en el maestro.
    const r = resolverDatosPlanillaVsPadron(padron({ promedio: 8.0 }), {
      promedio: 8.03,
      aprobadas: 42,
      cursadas: 46,
      aplazos: 0,
    });
    expect(r.promedio).toBe(8.0);
    expect(r.reemplazados).toEqual([
      { campo: 'promedio', valorPlanilla: 8.03, valorPadron: 8.0 },
    ]);
  });

  it('usa las aprobadas del padrón cuando difieren', () => {
    // Caso real: Honnorat tiene 34 en la planilla y 39 en el maestro.
    const r = resolverDatosPlanillaVsPadron(
      padron({ promedio: 8.36, aprobadas: 39 }),
      { promedio: 8.3, aprobadas: 34, cursadas: 34, aplazos: 0 },
    );
    expect(r.aprobadas).toBe(39);
    expect(r.reemplazados).toContainEqual({
      campo: 'aprobadas',
      valorPlanilla: 34,
      valorPadron: 39,
    });
  });

  it('no registra un cambio cuando los valores coinciden', () => {
    const r = resolverDatosPlanillaVsPadron(
      padron({ promedio: 8, aprobadas: 42 }),
      { promedio: 8, aprobadas: 42, cursadas: 46, aplazos: 1 },
    );
    expect(r.reemplazados).toEqual([]);
    expect(r.conservados).toEqual([]);
  });

  it('no avisa por el legajo cuando sólo cambia el separador de miles', () => {
    // Las 177 filas de la planilla de 2026 tienen el legajo sin puntos y el
    // maestro con puntos. Comparado crudo marcaba el 100% de los estudiantes.
    const r = resolverDatosPlanillaVsPadron(padron({ legajo: '29.366' }), {
      legajo: '29366',
      promedio: 8,
      aprobadas: 42,
    });
    expect(r.legajo).toBe('29.366');
    expect(r.reemplazados).toEqual([]);
  });

  it('avisa por el legajo cuando el número es realmente distinto', () => {
    const r = resolverDatosPlanillaVsPadron(padron({ legajo: '31.842' }), {
      legajo: '17891',
    });
    expect(r.reemplazados).toEqual([
      { campo: 'legajo', valorPlanilla: '17891', valorPadron: '31.842' },
    ]);
  });
});

describe('resolverDatosPlanillaVsPadron — salvaguarda del padrón vacío', () => {
  // Caso real: DNI 35450612. En el padrón figura "Fernandez Alvarez Hayes,
  // Fernando David", legajo 31.842, Esp. 85, promedio 0,00 y 0 aprobadas — es
  // otra persona. En la planilla es "Alvarez hayes, Fernando", legajo 17.891,
  // ISI, promedio 7,8 y 43 aprobadas.
  const planilla: Parameters<typeof resolverDatosPlanillaVsPadron>[1] = {
    legajo: '17891',
    promedio: 7.8,
    aprobadas: 43,
    cursadas: 44,
    aplazos: 0,
  };

  it('conserva el promedio de la planilla cuando el padrón trae 0', () => {
    const r = resolverDatosPlanillaVsPadron(
      padron({ legajo: '31.842', promedio: 0, aprobadas: 0 }),
      planilla,
    );
    expect(r.promedio).toBe(7.8);
  });

  it('conserva las aprobadas de la planilla cuando el padrón trae 0', () => {
    const r = resolverDatosPlanillaVsPadron(
      padron({ promedio: 0, aprobadas: 0 }),
      planilla,
    );
    expect(r.aprobadas).toBe(43);
  });

  it('deja registrado el descarte del padrón, para que el operador lo vea', () => {
    const r = resolverDatosPlanillaVsPadron(
      padron({ legajo: '31.842', promedio: 0, aprobadas: 0 }),
      planilla,
    );
    expect(r.conservados).toContainEqual({
      campo: 'promedio',
      valorPlanilla: 7.8,
      valorPadron: undefined,
    });
    expect(r.conservados).toContainEqual({
      campo: 'aprobadas',
      valorPlanilla: 43,
      valorPadron: undefined,
    });
  });

  it('el puntaje de ese estudiante no se va a cero', () => {
    // Sin la salvaguarda el Factor pasaba de 17,1 a 5,0: una pérdida de 12,1.
    const r = resolverDatosPlanillaVsPadron(
      padron({ promedio: 0, aprobadas: 0 }),
      planilla,
    );
    const factor =
      r.promedio +
      r.aprobadas * 0.1 +
      (r.cursadas * 3) / 44 +
      2 / (1 + r.aplazos);
    expect(factor).toBeCloseTo(17.1, 5);
  });

  it('conserva el legajo de la planilla si el padrón viene vacío', () => {
    const r = resolverDatosPlanillaVsPadron(
      padron({ legajo: '', promedio: 8 }),
      { legajo: '17891' },
    );
    expect(r.legajo).toBe('17891');
    expect(r.conservados).toContainEqual({
      campo: 'legajo',
      valorPlanilla: '17891',
      valorPadron: undefined,
    });
  });
});

describe('resolverDatosPlanillaVsPadron — cursadas y aplazos no se tocan', () => {
  // Correa: 46 cursadas en la planilla y 0 "Cursando año actual" en el maestro.
  // Brites: 45 contra 4. Son magnitudes distintas, no snapshots distintos.
  it('Cursadas sale siempre de la planilla, aunque el padrón tenga "cursando"', () => {
    const r = resolverDatosPlanillaVsPadron(
      padron({ cursando: 0, promedio: 8, aprobadas: 43 }),
      { cursadas: 46, promedio: 8.03, aprobadas: 42, aplazos: 0 },
    );
    expect(r.cursadas).toBe(46);
  });

  it('aplazos sale siempre de la planilla', () => {
    // `padron.aplazos` queda en 0 al quitar el mapeo de `Cant.`. Si se leyera del
    // padrón, el aplazo real se perdería.
    const r = resolverDatosPlanillaVsPadron(
      padron({ aplazos: 0, promedio: 8, aprobadas: 42 }),
      { cursadas: 46, aplazos: 1, promedio: 8, aprobadas: 42 },
    );
    expect(r.aplazos).toBe(1);
  });

  it('aplazos sale de la planilla aunque el padrón traiga el valor viejo', () => {
    // El caso real, no hipotético: quitar el mapeo de `Cant.` no borra lo que ya
    // está en la base. Brites (DNI 42732664) quedó con `aplazos` = 43, que era el
    // `Cant.` de su fila del maestro, cuando el orden de mérito dice 1. Como
    // `importarRanking` deja en la fila del padrón el valor que devuelve este
    // resolver, el 43 se corrige sólo si el resolver no lo arrastra: por eso el
    // test mira el 43 explícitamente en vez de quedarse con el 0.
    //
    // El 43 además no es un dato de aplazos sino una columna de aprobadas, así
    // que conservarlo además inflaría el segundo término del puntaje.
    const r = resolverDatosPlanillaVsPadron(
      padron({ aplazos: 43, promedio: 8.02, aprobadas: 42 }),
      { cursadas: 45, aplazos: 1, promedio: 7.88, aprobadas: 43 },
    );
    expect(r.aplazos).toBe(1);
  });

  it('no reporta cursadas ni aplazos como cambio de fuente', () => {
    const r = resolverDatosPlanillaVsPadron(
      padron({ cursando: 4, aplazos: 0, promedio: 8, aprobadas: 42 }),
      { cursadas: 45, aplazos: 1, promedio: 8, aprobadas: 42 },
    );
    const campos = [...r.reemplazados, ...r.conservados].map((c) => c.campo);
    expect(campos).not.toContain('cursadas');
    expect(campos).not.toContain('aplazos');
  });
});

describe('describirCambio', () => {
  it('nombra las dos fuentes con sus valores', () => {
    expect(
      describirCambio({
        campo: 'promedio',
        valorPlanilla: 8.03,
        valorPadron: 8.0,
      }),
    ).toBe('promedio: planilla "8.03" → padrón "8"');
  });

  it('distingue "vacío" de "sin dato", sin entrecomillar los placeholders', () => {
    expect(
      describirCambio({
        campo: 'aprobadas',
        valorPlanilla: 43,
        valorPadron: undefined,
      }),
    ).toBe('aprobadas: planilla "43" → padrón (sin dato)');
  });
});
