import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RankingService } from './ranking.service';

@ApiTags('Ranking')
@Controller('convocatorias/:convocatoriaId/ranking')
export class RankingController {
  constructor(private readonly service: RankingService) {}

  @Post('calcular')
  @ApiOperation({ summary: 'Calcular ranking de la convocatoria (RF-12, RF-13)' })
  calcular(@Param('convocatoriaId') convocatoriaId: string) {
    return this.service.calcularRanking(convocatoriaId);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener ranking paginado (RF-13)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRanking(
    @Param('convocatoriaId') convocatoriaId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.service.getRanking(convocatoriaId, +page, +limit);
  }

  @Get('estudiante/:dni')
  @ApiOperation({ summary: 'Obtener desglose de puntaje de un estudiante (RF-15)' })
  getDesglose(
    @Param('convocatoriaId') convocatoriaId: string,
    @Param('dni') dni: string,
  ) {
    return this.service.getDesglose(convocatoriaId, dni);
  }
}
