import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PadronService } from './padron.service';

export const PADRON_QUEUE = 'padron';

export interface JobCargarPadron {
  convocatoriaId: string;
  filePath: string;
  originalname: string;
}

@Processor(PADRON_QUEUE, {
  concurrency: 1,
  lockDuration: 30 * 60 * 1000, // 30 min
})
export class PadronProcessor extends WorkerHost {
  private readonly logger = new Logger(PadronProcessor.name);

  constructor(private readonly padronService: PadronService) {
    super();
  }

  async process(job: Job<JobCargarPadron>) {
    const { convocatoriaId, filePath, originalname } = job.data;
    this.logger.log(`Iniciando carga de padrón job=${job.id} convocatoria=${convocatoriaId} archivo=${originalname}`);

    try {
      const resultado = await this.padronService.cargarMaestro(filePath, convocatoriaId);
      this.logger.log(`Padrón cargado job=${job.id}: ${resultado.procesadas} procesadas, ${resultado.errores} errores`);
      return resultado;
    } catch (err: any) {
      this.logger.error(`Falló carga de padrón job=${job.id}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
