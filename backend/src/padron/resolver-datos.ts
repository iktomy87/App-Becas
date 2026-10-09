import { PadronAcademico } from '@prisma/client';

/**
 * Resolución de datos entre el padrón académico y la planilla de orden de mérito.
 *
 * Regla institucional: **el padrón es la fuente autorizada**. Cuando un dato
 * aparece en el maestro y en la planilla con valores distintos, manda el maestro.
 *
 * La regla tiene tres límites, y cada uno está justificado por una diferencia
 * concreta entre los dos archivos, no por criterio:
 *
 *  1. `Cursadas` nunca se sobreescribe. El maestro no tiene esa columna: tiene
 *     `Cursando año actual`, que es la materia que se cursa *este año*, no el
 *     histórico de materias cursadas. Son magnitudes distintas: en el orden de
 *     mérito de 2026 difieren en el 96,6% de los estudiantes (Correa: 46
 *     cursadas contra 0 cursando). Confundirlas rompe el término de avance de
 *     la fórmula, porque `Cursadas` es su numerador.
 *
 *  2. `Aplazos` nunca se sobreescribe, porque el maestro no tiene columna de
 *     aplazos. Antes se usaba `Cant.` —que no es un campo de domicilio, como
 *     se vio después: es una segunda columna de materias aprobadas, véase la
 *     nota en `COL_MAP`—, y ese mapeo se eliminó de `padron.service.ts`, con lo
 *     cual `PadronAcademico.aplazos` queda en 0 para todo el mundo recién
 *     importado. Las filas ya importadas antes del arreglo conservan el valor
 *     viejo (43 para el DNI 42732664), y por eso `importarRanking` deja el
 *     `aplazos` resuelto de la planilla en la fila del padrón: es el valor que
 *     además entra al puntaje, así que la lista y el ranking no pueden
 *     discrepar.
 *
 *  3. Si el padrón trae el dato en cero o vacío, se conserva el de la planilla y
 *     queda registrado en `conservados`. Hay filas del maestro que no
 *     corresponden al estudiante de la planilla y llegan con todo en cero: el
 *     DNI 35450612 figura en el padrón como "Fernandez Alvarez Hayes, Fernando
 *     David", legajo 31.842, Esp. 85, promedio 0,00 y 0 aprobadas, mientras que
 *     en la planilla es "Alvarez hayes, Fernando", legajo 17.891, ISI,
 *     promedio 7,8 y 43 aprobadas. Sin este salvaguarda ese estudiante se
 *     puntúa casi en cero.
 */

/** Campos en los que el padrón puede llegar a sobreescribir a la planilla. */
export type CampoResoluble = 'legajo' | 'promedio' | 'aprobadas';

/** Lo que un archivo de planilla puede aportar para un estudiante. */
export interface DatosPlanilla {
  legajo?: string;
  promedio?: number;
  aprobadas?: number;
  cursadas?: number;
  aplazos?: number;
}

export interface CambioDeFuente {
  campo: CampoResoluble;
  valorPlanilla: string | number | undefined;
  valorPadron: string | number | undefined;
}

export interface ResolucionPlanilla {
  legajo: string;
  promedio: number;
  aprobadas: number;
  cursadas: number;
  aplazos: number;
  /** El padrón traía el dato y su valor ganó sobre el de la planilla. */
  reemplazados: CambioDeFuente[];
  /** El padrón no traía el dato, así que quedó el de la planilla. */
  conservados: CambioDeFuente[];
}

/**
 * El legajo viene con separador de miles en el maestro (`29.366`) y sin él en la
 * planilla (`29366`). Compararlos crudo marca como discrepancia al 100% de los
 * estudiantes, que es sólo ruido y tapa las diferencias reales.
 */
export function normalizarLegajo(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '');
}

/** Un valor del padrón sirve sólo si es un número > 0. */
function tieneDatoPadron(valor: number): boolean {
  return Number.isFinite(valor) && valor > 0;
}

function tieneDatoPlanilla(valor: number | undefined): valor is number {
  return valor !== undefined && Number.isFinite(valor);
}

export function resolverDatosPlanillaVsPadron(
  padron: PadronAcademico,
  planilla: DatosPlanilla,
): ResolucionPlanilla {
  const reemplazados: CambioDeFuente[] = [];
  const conservados: CambioDeFuente[] = [];

  // --- legajo: el padrón manda, salvo que venga vacío ---
  const legajoPadron = String(padron.legajo ?? '').trim();
  const legajoPlanilla = String(planilla.legajo ?? '').trim();
  let legajo = legajoPlanilla;
  if (legajoPadron !== '') {
    legajo = legajoPadron;
    if (
      legajoPlanilla !== '' &&
      normalizarLegajo(legajoPlanilla) !== normalizarLegajo(legajoPadron)
    ) {
      reemplazados.push({
        campo: 'legajo',
        valorPlanilla: legajoPlanilla,
        valorPadron: legajoPadron,
      });
    }
  } else if (legajoPlanilla !== '') {
    conservados.push({
      campo: 'legajo',
      valorPlanilla: legajoPlanilla,
      valorPadron: undefined,
    });
  }

  // --- promedio y aprobadas: gana el padrón si trae dato ---
  const resolverNumerico = (
    campo: 'promedio' | 'aprobadas',
    valorPadron: number,
    valorPlanilla: number | undefined,
  ): number => {
    if (tieneDatoPadron(valorPadron)) {
      if (tieneDatoPlanilla(valorPlanilla) && valorPlanilla !== valorPadron) {
        reemplazados.push({ campo, valorPlanilla, valorPadron });
      }
      return valorPadron;
    }
    if (tieneDatoPlanilla(valorPlanilla)) {
      if (valorPlanilla !== valorPadron) {
        conservados.push({
          campo,
          valorPlanilla,
          // Se informa como ausente, no como 0: el 0 del padrón significa
          // "el maestro no trae el dato", no "el alumno tiene promedio cero".
          valorPadron: undefined,
        });
      }
      return valorPlanilla;
    }
    return 0;
  };

  const promedio = resolverNumerico(
    'promedio',
    Number(padron.promedio),
    planilla.promedio,
  );
  const aprobadas = resolverNumerico(
    'aprobadas',
    Number(padron.aprobadas),
    planilla.aprobadas,
  );

  return {
    legajo,
    promedio,
    aprobadas,
    // Sin columna equivalente en el maestro: van siempre desde la planilla.
    cursadas: planilla.cursadas ?? 0,
    aplazos: planilla.aplazos ?? 0,
    reemplazados,
    conservados,
  };
}

/** Redacta un cambio de fuente como una línea de reporte legible. */
export function describirCambio(cambio: CambioDeFuente): string {
  const { campo, valorPlanilla, valorPadron } = cambio;
  const planillaTxt =
    valorPlanilla === undefined ? '(vacío)' : `"${valorPlanilla}"`;
  const padronTxt =
    valorPadron === undefined ? '(sin dato)' : `"${valorPadron}"`;
  return `${campo}: planilla ${planillaTxt} → padrón ${padronTxt}`;
}
