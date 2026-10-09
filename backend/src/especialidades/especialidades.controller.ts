import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ESPECIALIDADES } from './especialidades';

@ApiTags('Especialidades')
@Controller('especialidades')
export class EspecialidadesController {
  /**
   * Catálogo de especialidades (código, nombre y materias del plan).
   *
   * El frontend lo usa para mostrar el nombre de la carrera en vez del código
   * numérico, en lugar de mantener su propio diccionario.
   */
  @Get()
  @ApiOperation({
    summary: 'Listar especialidades (carreras) con su código y plan',
  })
  listar() {
    return ESPECIALIDADES;
  }
}
