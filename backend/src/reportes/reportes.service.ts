import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async generarReporteAsignacion(convocatoriaId: string): Promise<string> {
    const corrida = await this.prisma.corridaAsignacion.findFirst({
      where: { convocatoriaId, vigente: true },
      include: {
        resultados: {
          include: {
            padron: true,
            propuesta: true,
          },
          orderBy: { estado: 'asc' },
        },
      },
    });

    if (!corrida)
      throw new Error(
        'No hay corrida de asignación vigente para esta convocatoria',
      );

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Resultado Asignación');

    ws.addRow([
      'DNI',
      'Legajo',
      'Apellido y Nombre',
      'Estado',
      'Área Asignada',
      'ID Propuesta',
      'Preferencia Satisfecha',
    ]);
    ws.getRow(1).font = { bold: true };

    for (const r of corrida.resultados) {
      ws.addRow([
        r.padron.dni,
        r.padron.legajo,
        r.padron.nombreCompleto,
        r.estado,
        r.propuesta?.titulo ?? '-',
        r.propuesta?.idExterno ?? '-',
        r.preferenciaSatisfecha ?? '-',
      ]);
    }

    const fileName = `reporte_asignacion_${convocatoriaId}_${Date.now()}.xlsx`;
    const path = `reportes/${convocatoriaId}/${fileName}`;
    const buffer = await workbook.xlsx.writeBuffer();
    await this.storageService.uploadBuffer(
      path,
      Buffer.from(buffer),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    return this.storageService.createSignedDownloadUrl(
      path,
      'reporte_asignacion.xlsx',
    );
  }
}
