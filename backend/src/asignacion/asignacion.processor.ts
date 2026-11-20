import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AsignacionEngineService } from './asignacion-engine.service';
import { QueueJob } from '../queue/job.interface';
import { QueueService } from '../queue/queue.service';

export const ASIGNACION_QUEUE = 'asignacion';

export interface JobEjecutarAsignacion {
  convocatoriaId: string;
}

@Injectable()
export class AsignacionProcessor implements OnModuleInit {
  private readonly logger = new Logger(AsignacionProcessor.name);

  constructor(
    private readonly engine: AsignacionEngineService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerHandler(ASIGNACION_QUEUE, (job) =>
      this.process(job as QueueJob<JobEjecutarAsignacion>),
    );
  }

  async process(job: QueueJob<JobEjecutarAsignacion>) {
    const { convocatoriaId } = job.data;
    this.logger.log(
      `Iniciando asignación job=${job.id} convocatoria=${convocatoriaId}`,
    );

    const resultado = await this.engine.ejecutar(convocatoriaId);

    this.logger.log(
      `Asignación finalizada job=${job.id}: ${resultado.asignados} asignados, ${resultado.noAsignados} no asignados`,
    );
    return resultado;
  }
}
