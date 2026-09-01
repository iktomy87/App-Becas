import { PadronAcademico } from '@prisma/client';
import { RankingStrategy, PuntajeDesglose } from './ranking.strategy';
export declare class RankingV1Strategy implements RankingStrategy {
    calcularPuntaje(padron: PadronAcademico, totalMateriasPlan?: number): PuntajeDesglose;
    verificarHabilitacion(padron: PadronAcademico, config: {
        minMateriasCursando: number;
        minRegularizadas: number;
    }): {
        habilitado: boolean;
        motivo?: string;
    };
}
