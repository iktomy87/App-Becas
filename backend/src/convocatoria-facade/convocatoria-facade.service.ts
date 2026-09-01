import { Injectable } from '@nestjs/common';
import { RankingService } from '../ranking/ranking.service';
import { AsignacionEngineService } from '../asignacion/asignacion-engine.service';
import { ConvocatoriasService } from '../convocatorias/convocatorias.service';

/**
 * Facade que orquesta el cierre completo de una convocatoria:
 * 1. Cierra la convocatoria (estado → CERRADA)
 * 2. Calcula el ranking (estado → EN_RANKING)
 * 3. Ejecuta el motor de asignación (estado → ASIGNADA)
 */
@Injectable()
export class ConvocatoriaFacadeService {
  constructor(
    private readonly convService: ConvocatoriasService,
    private readonly rankingService: RankingService,
    private readonly asignacionEngine: AsignacionEngineService,
  ) {}

  async cerrarYAsignar(convocatoriaId: string) {
    // 1. Cerrar
    await this.convService.cerrar(convocatoriaId);

    // 2. Calcular ranking
    const rankingResult = await this.rankingService.calcularRanking(convocatoriaId);

    // 3. Asignar
    const asignacionResult = await this.asignacionEngine.ejecutar(convocatoriaId);

    return {
      mensaje: 'Proceso completado exitosamente',
      ranking: rankingResult,
      asignacion: asignacionResult,
    };
  }
}
