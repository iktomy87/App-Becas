import { PadronAcademico } from '@prisma/client';

export interface PuntajeDesglose {
  terminoPromedio: number;
  terminoAprobadas: number;
  terminoAvance: number;
  terminoAplazos: number;
  bonusAntecedentes: number;
  puntajeTotal: number;
}

/**
 * Insumo completo para calcular el factor de un postulante.
 *
 * Antes esto viajaba como un `PadronAcademico` (el modelo de Prisma) más un
 * segundo argumento posicional cuyo significado cambiaba entre la interfaz y
 * la implementación: la interfaz lo llamaba `totalMateriasPlan` y la
 * implementación lo usaba como `bonusAntecedentes`. Eso hacía que el total de
 * materias del plan se sumara como si fueran puntos, inflando el puntaje.
 *
 * Por eso ahora es un único objeto con todos los campos obligatorios: no hay
 * forma de pasar un valor donde se espera otro.
 */
export interface DatosPuntaje {
  /** Promedio general del estudiante (`Promedio` del archivo de orden de mérito). */
  promedio: number;
  /** Materias aprobadas (`Aprobadas`). Entra multiplicado por 0,1. */
  aprobadas: number;
  /**
   * Materias cursadas: en la hoja de inscriptos es `Cursadas`
   * (=SUM(Regulares, Aprobadas)) y es el numerador del término de avance. En el
   * maestro ese total ya viene en `Regularizadas`; `Aprobadas` es un
   * subconjunto y no se suma de nuevo. Sin planilla se usa
   * `cursadasDelPadron()`.
   *
   * NO confundir con `PadronAcademico.cursando` (cursando año actual).
   */
  cursadas: number;
  /** Materias del plan de la carrera (`Mat. de la carrera`). Es el denominador. */
  totalMateriasPlan: number;
  /** Aplazos (`Aplazos` / `Numero de Aplazos`). Entra con penalización no lineal. */
  aplazos: number;
  /** Bonus por antecedentes (`Antecedentes`). 0 si la convocatoria no lo define. */
  bonusAntecedentes?: number;
}

export interface RankingStrategy {
  calcularPuntaje(datos: DatosPuntaje): PuntajeDesglose;
  /**
   * `totalMateriasPlan` es el denominador del término de avance y además el
   * total contra el que se mide cuánto le queda por cursar al estudiante:
   * si `totalMateriasPlan - regularizadas < 3` se lo exime del
   * mínimo de `cursando` (ver `ranking-v1.strategy.ts`).
   */
  verificarHabilitacion(
    padron: PadronAcademico,
    config: { minMateriasCursando: number; minRegularizadas: number },
    totalMateriasPlan: number,
  ): { habilitado: boolean; motivo?: string };
}
