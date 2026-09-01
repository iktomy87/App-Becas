import { Controller, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConvocatoriaFacadeService } from './convocatoria-facade.service';

@ApiTags('Convocatoria Facade')
@Controller('convocatorias/:id/cerrar-y-asignar')
export class ConvocatoriaFacadeController {
  constructor(private readonly facade: ConvocatoriaFacadeService) {}

  @Post()
  @ApiOperation({ summary: 'Cierra la convocatoria, calcula el ranking y ejecuta la asignación en un único paso (§4.5 ERS)' })
  cerrarYAsignar(@Param('id') id: string) {
    return this.facade.cerrarYAsignar(id);
  }
}
