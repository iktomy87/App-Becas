import { Controller, Post, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
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

  @Get()
  @ApiOperation({ summary: 'Obtener resultados de asignación vigente' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getResultados(
    @Param('convocatoriaId') convocatoriaId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.engine.getResultados(convocatoriaId, +page, +limit);
  }

  @Get('estudiante/:dni')
  @ApiOperation({ summary: 'Consultar resultado de asignación por DNI (RF-19)' })
  getResultadoPorDni(
    @Param('convocatoriaId') convocatoriaId: string,
    @Param('dni') dni: string,
  ) {
    return this.engine.getResultadoPorDni(convocatoriaId, dni);
  }
}
