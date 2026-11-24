/**
 * Escribe en `padron_academico` los valores que resolvió la planilla.
 *
 * POR QUÉ HACE FALTA ESTO
 *
 * Las pantallas de inscripciones y ranking leen el padrón, no la resolución en
 * memoria. Si el maestro trae un campo en 0 —que significa "sin dato"— la fila
 * aparece con 0 aunque la planilla tenga el valor con el que se puntuó. El caso
 * real es el DNI 35450612: en el maestro figura como "Fernandez Alvarez Hayes,
 * Fernando David", con promedio 0, 0 aprobadas y 0 regularizadas, mientras que
 * en la planilla es "Alvarez hayes, Fernando", con 7,8 / 43 / 44.
 *
 * POR QUÉ SÓLO CAMPOS VACÍOS
 *
 * `resolverDatosPlanillaVsPadron` decide qué valor gana. Los campos que el
 * maestro trae con valor > 0 son autoridad y no se tocan. Los que trae en 0 se
 * completan con el valor resuelto de la planilla, para que la lista muestre lo
 * mismo que el puntaje. `aplazos` no existe en el maestro, así que siempre se
 * escribe desde la planilla.
 */

import type { PrismaService } from '../prisma/prisma.service';

export interface DatosResueltosParaPadron {
  padronId: string;
  promedio?: number;
  aprobadas?: number;
  regularizadas?: number;
  aplazos?: number;
}

type PadronParaCompletar = {
  id: string;
  promedio: unknown;
  aprobadas: number;
  regularizadas: number;
  aplazos: number;
};

type DatosResueltos = {
  promedio: number;
  aprobadas: number;
  cursadas: number;
  aplazos: number;
};

const CHUNK = 500;

export function datosFaltantesDelPadron(
  padron: PadronParaCompletar,
  datos: DatosResueltos,
): DatosResueltosParaPadron | null {
  const resultado: DatosResueltosParaPadron = { padronId: padron.id };

  if (Number(padron.promedio) === 0 && datos.promedio > 0) {
    resultado.promedio = datos.promedio;
  }
  if (padron.aprobadas === 0 && datos.aprobadas > 0) {
    resultado.aprobadas = datos.aprobadas;
  }
  if (padron.regularizadas === 0 && datos.cursadas > 0) {
    resultado.regularizadas = datos.cursadas;
  }
  if (padron.aplazos !== datos.aplazos) {
    resultado.aplazos = datos.aplazos;
  }

  return Object.keys(resultado).length > 1 ? resultado : null;
}

export async function persistirDatosDePlanilla(
  prisma: PrismaService,
  filas: DatosResueltosParaPadron[],
): Promise<number> {
  if (filas.length === 0) return 0;

  let actualizadas = 0;
  for (let i = 0; i < filas.length; i += CHUNK) {
    const chunk = filas.slice(i, i + CHUNK);
    actualizadas += await prisma.$executeRaw`
      UPDATE padron_academico AS p
      SET
        promedio = COALESCE(d.promedio, p.promedio),
        aprobadas = COALESCE(d.aprobadas, p.aprobadas),
        regularizadas = COALESCE(d.regularizadas, p.regularizadas),
        aplazos = COALESCE(d.aplazos, p.aplazos)
      FROM unnest(
        ${chunk.map((f) => f.padronId)}::text[],
        ${chunk.map((f) => f.promedio ?? null)}::numeric[],
        ${chunk.map((f) => f.aprobadas ?? null)}::int[],
        ${chunk.map((f) => f.regularizadas ?? null)}::int[],
        ${chunk.map((f) => f.aplazos ?? null)}::int[]
      ) AS d(id, promedio, aprobadas, regularizadas, aplazos)
      WHERE p.id = d.id
    `;
  }
  return actualizadas;
}
