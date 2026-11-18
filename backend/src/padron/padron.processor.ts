import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { PadronService } from './padron.service';
import { QueueJob } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';

export const PADRON_QUEUE = 'padron';

export interface JobCargarPadron {
  convocatoriaId: string;
  filePath: string;
  originalname: string;
}

@Injectable()
export class PadronProcessor implements OnModuleInit {
  private readonly logger = new Logger(PadronProcessor.name);

  constructor(
    private readonly padronService: PadronService,
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerHandler(PADRON_QUEUE, (job) =>
      this.process(job as QueueJob<JobCargarPadron>),
    );
  }

  async process(job: QueueJob<JobCargarPadron>) {
    const { convocatoriaId, filePath, originalname } = job.data;
    this.logger.log(
      `Iniciando carga de padrón job=${job.id} convocatoria=${convocatoriaId} archivo=${originalname}`,
    );

    const localPath = await this.storageService.downloadToFile(filePath);
    try {
      const resultado = await this.padronService.cargarMaestro(
        localPath,
        convocatoriaId,
      );
      this.logger.log(
        `Padrón cargado job=${job.id}: ${resultado.procesadas} procesadas, ${resultado.errores} errores`,
      );
      return resultado;
    } finally {
      if (existsSync(localPath)) unlinkSync(localPath);
    }
  }
}
