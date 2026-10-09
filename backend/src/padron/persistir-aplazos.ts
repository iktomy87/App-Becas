/**
 * Escribe en `padron_academico.aplazos` el valor que resolvió la planilla.
 *
 * POR QUÉ HACE FALTA ESTO
 *
 * El maestro no tiene columna de aplazos. Antes se usaba `Cant.` para
 * preencherla, que resultó ser una segunda columna de materias aprobadas (92.8%
 * de coincidencia con `Total Aprobadas`, y nunca menor), así que la columna
 * quedó con números sin sentido: 43 aplazos para el DNI 42732664, cuando el
 * orden de mérito dice 1. Como las pantallas de inscripciones y de ranking leen
 * ese campo, el operador veía un número que además no era con el que se había
 * puntuado.
 *
 * Quitar el mapeo no borra lo ya importado, y `parseRow` ahora emite
 * `aplazos: 0` explícito justamente para que una recarga del padrón no deje el
 * valor viejo congelado. Pero 0 tampoco es el dato: el valor real vive en la
 * planilla de orden de mérito, y hasta ahora no quedaba persistido en ningún
 * lado. Esta función es el único punto donde se guarda.
 *
 * POR QUÉ SÓLO `aplazos` Y NO LOS OTROS CAMPOS
 *
 * `resolverDatosPlanillaVsPadron` saca `aplazos` SIEMPRE de la planilla, así que
 * escribirlo en la fila del padrón no altera ninguna resolución futura: la
 * próxima planilla lo vuelve a sobrescribir. Con `promedio`, `aprobadas`,
 * `cursadas` y `legajo` sería distinto: el padrón gana cuando tiene dato, así
 * que guardar ahí el valor de la planilla lo convertiría en "dato del padrón"
 * para siempre, y la próxima planilla ya no podría corregirlo. Ése es el
 * sentido en el que se aplica la prioridad del padrón, y esta función no lo
 * toca.
 */

import type { PrismaService } from '../prisma/prisma.service';

/** Filas a escribir, tal como salen de la resolución de datos. */
export interface AplazosResuelto {
  padronId: string;
  aplazos: number;
}

/** Tamaño de lote. 176 filas entran de sobra; el corte es sólo una red de seguridad. */
const CHUNK = 500;

/**
 * Actualiza `aplazos` de las filas indicadas.
 *
 * Va en lote con `unnest()` en vez de un `update` por fila por el mismo motivo
 * que `upsertPostulacionesBulk` en `importacion.service.ts`: son ~176 filas y un
 * `update` individual cada una duplica los viajes a la base.
 *
 * OJO CON EL ORDEN DE LAS CARGAS: `cargarMaestro` emite `aplazos: 0` —el maestro
 * no tiene la columna y `parseRow` lo pone explícito para no dejar congelado un
 * valor viejo—, así que recargar el padrón DESPUÉS de una planilla borra el
 * `aplazos` resuelto y las pantallas vuelven a mostrar 0. La secuencia correcta
 * es padrón → planilla.
 *
 * @returns cuántas filas quedaron efectivamente actualizadas.
 */
export async function persistirAplazosDePlanilla(
  prisma: PrismaService,
  filas: AplazosResuelto[],
): Promise<number> {
  if (filas.length === 0) return 0;

  let actualizadas = 0;
  for (let i = 0; i < filas.length; i += CHUNK) {
    const chunk = filas.slice(i, i + CHUNK);
    actualizadas += await prisma.$executeRaw`
      UPDATE padron_academico AS p
      SET aplazos = d.aplazos
      FROM unnest(
        ${chunk.map((f) => f.padronId)}::text[],
        ${chunk.map((f) => f.aplazos)}::int[]
      ) AS d(id, aplazos)
      WHERE p.id = d.id
    `;
  }
  return actualizadas;
}
