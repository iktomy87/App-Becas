import { Injectable } from '@nestjs/common';
import { PadronAcademico } from '@prisma/client';
import {
  RankingStrategy,
  PuntajeDesglose,
  DatosPuntaje,
} from './ranking.strategy';

export {
  MATERIAS_PLAN_POR_DEFECTO,
  materiasDelPlanPorCodigo,
} from '../../especialidades/especialidades';

/**
 * Implementación V1 de la fórmula oficial de ranking:
 *
 * Factor = promedio
 *        + (aprobadas × 0.1)
 *        + ((cursadas × 3) / total_materias_plan)
 *        + (2 / (1 + aplazos))
 *        + antecedentes
 *
 * `cursadas` es la columna `Cursadas` del archivo de orden de mérito, NO
 * `PadronAcademico.regularizadas`.
 *
 * Penalización de aplazos es NO LINEAL: 2 si aplazos=0, 1 si aplazos=1, etc.
 */
@Injectable()
export class RankingV1Strategy implements RankingStrategy {
  calcularPuntaje(datos: DatosPuntaje): PuntajeDesglose {
    const promedio = Number(datos.promedio) || 0;
    const aprobadas = Number(datos.aprobadas) || 0;
    const cursadas = Number(datos.cursadas) || 0;
    const aplazos = Number(datos.aplazos) || 0;
    const totalMateriasPlan = Number(datos.totalMateriasPlan) || 0;
    const bonusAntecedentes = Number(datos.bonusAntecedentes) || 0;

    const terminoPromedio = promedio;
    const terminoAprobadas = aprobadas * 0.1;
    const terminoAvance =
      totalMateriasPlan > 0 ? (cursadas * 3) / totalMateriasPlan : 0;
    const terminoAplazos = 2 / (1 + aplazos);

    // El bonus de antecedentes se suma UNA sola vez, acá.
    const puntajeTotal =
      terminoPromedio +
      terminoAprobadas +
      terminoAvance +
      terminoAplazos +
      bonusAntecedentes;

    return {
      terminoPromedio,
      terminoAprobadas,
      terminoAvance,
      terminoAplazos,
      bonusAntecedentes,
      puntajeTotal,
    };
  }

  verificarHabilitacion(
    padron: PadronAcademico,
    config: { minMateriasCursando: number; minRegularizadas: number },
  ): { habilitado: boolean; motivo?: string } {
    if (padron.cursando < config.minMateriasCursando) {
      return {
        habilitado: false,
        motivo: `Cursa ${padron.cursando} materias (mínimo requerido: ${config.minMateriasCursando})`,
      };
    }
    if (padron.regularizadas < config.minRegularizadas) {
      return {
        habilitado: false,
        motivo: `Tiene ${padron.regularizadas} regularizadas (mínimo requerido: ${config.minRegularizadas})`,
      };
    }
    return { habilitado: true };
  }
}
