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
    const buffer = await this.service.generarReporteAsignacion(convocatoriaId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="reporte_asignacion.xlsx"',
    );
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }
}
