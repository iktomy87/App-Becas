import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConvocatoriasService } from './convocatorias.service';
import { CreateConvocatoriaDto, UpdateConvocatoriaDto, CreateRankingConfigDto } from './dto/convocatoria.dto';

@ApiTags('Convocatorias')
@Controller('convocatorias')
export class ConvocatoriasController {
  constructor(private readonly service: ConvocatoriasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las convocatorias' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una convocatoria por ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva convocatoria' })
  create(@Body() dto: CreateConvocatoriaDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una convocatoria' })
  update(@Param('id') id: string, @Body() dto: UpdateConvocatoriaDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/cierre')
  @ApiOperation({ summary: 'Cerrar la convocatoria (dispara el proceso de ranking y asignación vía Facade)' })
  cerrar(@Param('id') id: string) {
    return this.service.cerrar(id);
  }

  @Put(':id/ranking-config')
  @ApiOperation({ summary: 'Configurar parámetros del ranking para esta convocatoria' })
  upsertRankingConfig(@Param('id') id: string, @Body() dto: CreateRankingConfigDto) {
    return this.service.upsertRankingConfig(id, dto);
  }
}
