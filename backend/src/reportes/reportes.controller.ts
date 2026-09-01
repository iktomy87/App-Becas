import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportesService } from './reportes.service';

@ApiTags('Reportes')
@Controller('convocatorias/:convocatoriaId/reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Get('asignacion')
  @ApiOperation({ summary: 'Descargar reporte de asignación en Excel (RF-20)' })
  async descargarAsignacion(
    @Param('convocatoriaId') convocatoriaId: string,
    @Res() res: Response,
  ) {
    const filePath = await this.service.generarReporteAsignacion(convocatoriaId);
    res.download(filePath, 'reporte_asignacion.xlsx');
  }
}
