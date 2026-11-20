import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EstadoAsignacion } from '@prisma/client';
import { AsignacionEngineService } from './asignacion-engine.service';
import { ASIGNACION_QUEUE } from './asignacion.processor';
import { QueueService } from '../queue/queue.service';

@ApiTags('Asignación')
@Controller('convocatorias/:convocatoriaId/asignacion')
export class AsignacionController {
  constructor(
    private readonly engine: AsignacionEngineService,
    private readonly queueService: QueueService,
  ) {}

  @Post('ejecutar')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Encolar motor de asignación (RF-16 a RF-19)',
  })
  async ejecutar(@Param('convocatoriaId') convocatoriaId: string) {
    const job = await this.queueService.enqueue(
      ASIGNACION_QUEUE,
      'ejecutar-asignacion',
      { convocatoriaId },
    );
    return {
      jobId: job.id,
      mensaje: 'Asignación en proceso. Verificá el estado con el jobId.',
    };
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Estado del job de asignación' })
  async getStatus(@Param('jobId') jobId: string) {
    const status = await this.queueService.status(jobId);
    if (!status) throw new NotFoundException('Job no encontrado');
    return status;
  }

  @Post(':resultadoId/remover')
  @ApiOperation({
    summary:
      'Retirar a un estudiante de su área asignada y reubicarlo en otra de sus preferencias',
  })
  remover(
    @Param('convocatoriaId') convocatoriaId: string,
    @Param('resultadoId') resultadoId: string,
  ) {
    return this.engine.removerAsignacion(convocatoriaId, resultadoId);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener resultados de asignación vigente' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['ASIGNADO', 'NO_ASIGNADO'],
    description: 'Filtra los resultados por estado',
  })
  getResultados(
    @Param('convocatoriaId') convocatoriaId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('estado') estado?: string,
  ) {
    // Un `estado` fuera del enum se ignora en vez de romper la consulta.
    const filtroEstado =
      estado === EstadoAsignacion.ASIGNADO ||
      estado === EstadoAsignacion.NO_ASIGNADO
        ? estado
        : undefined;
    return this.engine.getResultados(
      convocatoriaId,
      +page,
      +limit,
      filtroEstado,
    );
  }

  @Get('estudiante/:dni')
  @ApiOperation({
    summary: 'Consultar resultado de asignación por DNI (RF-19)',
  })
  getResultadoPorDni(
    @Param('convocatoriaId') convocatoriaId: string,
    @Param('dni') dni: string,
  ) {
    return this.engine.getResultadoPorDni(convocatoriaId, dni);
  }
}
