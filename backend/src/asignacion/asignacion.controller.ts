import { Controller, Post, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EstadoAsignacion } from '@prisma/client';
import { AsignacionEngineService } from './asignacion-engine.service';

@ApiTags('Asignación')
@Controller('convocatorias/:convocatoriaId/asignacion')
export class AsignacionController {
  constructor(private readonly engine: AsignacionEngineService) {}

  @Post('ejecutar')
  @ApiOperation({ summary: 'Ejecutar motor de asignación (RF-16 a RF-19)' })
  ejecutar(@Param('convocatoriaId') convocatoriaId: string) {
    return this.engine.ejecutar(convocatoriaId);
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
