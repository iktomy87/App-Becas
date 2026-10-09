import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  ImportacionService,
  ResultadoImportacion,
} from './importacion.service';
import { IMPORTACION_QUEUE } from './importacion.constants';
import { RankingService } from '../ranking/ranking.service';

export interface JobCargarPlanilla {
  convocatoriaId: string;
  filePath: string;
  originalname: string;
}

@Processor(IMPORTACION_QUEUE, {
  concurrency: 1,
  lockDuration: 30 * 60 * 1000,
})
export class ImportacionProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportacionProcessor.name);

  constructor(
    private readonly importacionService: ImportacionService,
    private readonly rankingService: RankingService,
  ) {
    super();
  }

  async process(job: Job<JobCargarPlanilla>): Promise<ResultadoImportacion> {
    const { convocatoriaId, filePath, originalname } = job.data;
    this.logger.log(
      `Iniciando importación job=${job.id} convocatoria=${convocatoriaId} archivo=${originalname}`,
    );

    try {
      const resultado = await this.importacionService.cargarPlanilla(
        convocatoriaId,
        { path: filePath, originalname },
        (rowsProcessed) => {
          job.updateProgress({ rowsProcessed });
        },
      );
      this.logger.log(
        `Importación completada job=${job.id}: ${resultado.filasValidas} filas válidas de ${resultado.filasTotal}`,
      );

      // Auto-calcular ranking tras cargar la planilla
      try {
        this.logger.log(
          `Recalculando ranking automáticamente para convocatoria=${convocatoriaId}...`,
        );
        await this.rankingService.recalcularAutoRanking(convocatoriaId);
        this.logger.log(
          `Ranking recalculado exitosamente para convocatoria=${convocatoriaId}`,
        );
      } catch (rankingErr: any) {
        // El error de ranking no debe hacer fallar el job de importación
        this.logger.warn(
          `Auto-ranking falló (no crítico): ${rankingErr.message}`,
        );
      }

      return resultado;
    } catch (err: any) {
      this.logger.error(
        `Falló importación job=${job.id}: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}
