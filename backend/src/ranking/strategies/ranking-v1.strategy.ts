import { Injectable } from '@nestjs/common';
import { PadronAcademico } from '@prisma/client';
import { RankingStrategy, PuntajeDesglose } from './ranking.strategy';

/**
 * Implementación V1 de la fórmula oficial de ranking:
 *
 * Factor = promedio
 *        + (aprobadas × 0.1)
 *        + ((cursando × 3) / total_materias_plan)
 *        + (2 / (1 + aplazos))
 *        + antecedentes  ← PENDIENTE: se deja en 0 hasta confirmar fuente del dato
 *
 * Penalización de aplazos es NO LINEAL: 2 si aplazos=0, 1 si aplazos=1, etc.
 */
@Injectable()
export class RankingV1Strategy implements RankingStrategy {
  calcularPuntaje(padron: PadronAcademico, totalMateriasPlan = 42): PuntajeDesglose {
    const promedio = Number(padron.promedio) || 0;
    const aprobadas = padron.aprobadas || 0;
    const cursando = padron.cursando || 0;
    const aplazos = padron.aplazos || 0;

    const terminoPromedio = promedio;
    const terminoAprobadas = aprobadas * 0.1;
    const terminoAvance = totalMateriasPlan > 0 ? (cursando * 3) / totalMateriasPlan : 0;
    const terminoAplazos = 2 / (1 + aplazos);
    // PENDIENTE: bonusAntecedentes siempre 0 hasta confirmar fuente
    const bonusAntecedentes = 0;

    const puntajeTotal = terminoPromedio + terminoAprobadas + terminoAvance + terminoAplazos + bonusAntecedentes;

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
