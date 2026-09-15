import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ImportacionService, ResultadoImportacion } from './importacion.service';
import { IMPORTACION_QUEUE } from './importacion.constants';

export interface JobCargarPlanilla {
  convocatoriaId: string;
  filePath: string;
  originalname: string;
}

@Processor(IMPORTACION_QUEUE, {
  concurrency: 1, // procesar una planilla grande a la vez; subir solo si tu DB aguanta más carga concurrente
  lockDuration: 30 * 60 * 1000, // 30 min — jobs de horas necesitan un lock largo o BullMQ los va a dar por "estancados"
})
export class ImportacionProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportacionProcessor.name);

  constructor(private readonly importacionService: ImportacionService) {
    super();
  }

  async process(job: Job<JobCargarPlanilla>): Promise<ResultadoImportacion> {
    const { convocatoriaId, filePath, originalname } = job.data;
    this.logger.log(`Iniciando importación job=${job.id} convocatoria=${convocatoriaId} archivo=${originalname}`);

    try {
      const resultado = await this.importacionService.cargarPlanilla(
        convocatoriaId,
        { path: filePath, originalname },
        (rowsProcessed) => {
          // progreso 0-99 mientras procesa; el 100 lo pone BullMQ solo al terminar el job
          job.updateProgress({ rowsProcessed });
        },
      );
      this.logger.log(`Importación completada job=${job.id}: ${resultado.filasValidas} filas válidas de ${resultado.filasTotal}`);
      return resultado;
    } catch (err: any) {
      this.logger.error(`Falló importación job=${job.id}: ${err.message}`, err.stack);
      throw err; // BullMQ marca el job como failed y deja el archivo en disco para poder inspeccionarlo
    }
    // Nota: no borro el archivo acá. `cargarPlanilla` guarda `storagePath` en
    // CargaPlanilla a propósito (auditoría de qué se subió) — igual que en el
    // service original. Si en algún momento el disco se llena, conviene un job
    // de limpieza aparte que borre archivos de cargas viejas, no borrarlo acá.
  }
}
