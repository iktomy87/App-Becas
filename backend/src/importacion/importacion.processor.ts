import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import {
  ImportacionService,
  ResultadoImportacion,
} from './importacion.service';
import { IMPORTACION_QUEUE } from './importacion.constants';
import { RankingService } from '../ranking/ranking.service';
import { QueueJob } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';

export interface JobCargarPlanilla {
  convocatoriaId: string;
  filePath: string;
  originalname: string;
}

@Injectable()
export class ImportacionProcessor implements OnModuleInit {
  private readonly logger = new Logger(ImportacionProcessor.name);

  constructor(
    private readonly importacionService: ImportacionService,
    private readonly rankingService: RankingService,
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerHandler(IMPORTACION_QUEUE, (job) =>
      this.process(job as QueueJob<JobCargarPlanilla>),
    );
  }

  async process(
    job: QueueJob<JobCargarPlanilla>,
  ): Promise<ResultadoImportacion> {
    const { convocatoriaId, filePath, originalname } = job.data;
    this.logger.log(
      `Iniciando importación job=${job.id} convocatoria=${convocatoriaId} archivo=${originalname}`,
    );

    const localPath = await this.storageService.downloadToFile(filePath);
    try {
      const resultado = await this.importacionService.cargarPlanilla(
        convocatoriaId,
        { path: localPath, originalname },
        (rowsProcessed) => {
          void job.updateProgress({ rowsProcessed }).catch(() => undefined);
        },
      );
      this.logger.log(
        `Importación completada job=${job.id}: ${resultado.filasValidas} filas válidas de ${resultado.filasTotal}`,
      );

      try {
        this.logger.log(
          `Recalculando ranking automáticamente para convocatoria=${convocatoriaId}...`,
        );
        await this.rankingService.recalcularAutoRanking(convocatoriaId);
        this.logger.log(
          `Ranking recalculado exitosamente para convocatoria=${convocatoriaId}`,
        );
      } catch (rankingErr: any) {
        this.logger.warn(
          `Auto-ranking falló (no crítico): ${rankingErr.message}`,
        );
      }

      return resultado;
    } finally {
      if (existsSync(localPath)) unlinkSync(localPath);
    }
  }
}
