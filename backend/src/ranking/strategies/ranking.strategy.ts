import { PadronAcademico } from '@prisma/client';

export interface PuntajeDesglose {
  terminoPromedio: number;
  terminoAprobadas: number;
  terminoAvance: number;
  terminoAplazos: number;
  // bonusAntecedentes: PENDIENTE — se registra pero siempre 0 hasta confirmar fuente
  bonusAntecedentes: number;
  puntajeTotal: number;
}

export interface RankingStrategy {
  calcularPuntaje(padron: PadronAcademico, totalMateriasPlan?: number): PuntajeDesglose;
  verificarHabilitacion(padron: PadronAcademico, config: { minMateriasCursando: number; minRegularizadas: number }): { habilitado: boolean; motivo?: string };
}
