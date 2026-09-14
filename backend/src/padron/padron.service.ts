import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

// El maestro.xlsx tiene metadatos en filas 1-5; el header real está en la fila 6
const HEADER_ROW = 6;

const COL_MAP: Record<string, string> = {
  'Esp.': 'especialidadCodigo',
  'Plan ': 'plan',
  'Plan': 'plan',
  'Legajo ': 'legajo',
  'Legajo': 'legajo',
  'Ingr.': 'anioIngreso',
  'N°Documento': 'dni',
  'Apellido y Nombres': 'nombreCompleto',
  'Regularizadas': 'regularizadas',
  'Cursando año actual': 'cursando',
  'Total Aprobadas': 'aprobadas',
  'Prom.c/Apl': 'promedio',
  'Estado': 'estado',
  'Cant. ': 'aplazos',
  'Cant.': 'aplazos',
};

@Injectable()
export class PadronService {
  constructor(private readonly prisma: PrismaService) {}

  async findByDni(dni: string, convocatoriaId: string) {
    return this.prisma.padronAcademico.findUnique({
      where: { dni_convocatoriaId: { dni: String(dni).replace(/\./g, ''), convocatoriaId } },
    });
  }

  async findByLegajo(legajo: string, convocatoriaId: string) {
    return this.prisma.padronAcademico.findFirst({
      where: { legajo: String(legajo), convocatoriaId },
    });
  }

  async cargarMaestro(filePath: string, convocatoriaId: string): Promise<{ procesadas: number; errores: number }> {
    // Leer workbook completo en memoria (heap ampliado a 4GB en package.json)
    const workbook = new ExcelJS.Workbook();
    if (filePath.toLowerCase().endsWith('.csv')) {
      await workbook.csv.readFile(filePath);
    } else {
      await workbook.xlsx.readFile(filePath);
    }
    const ws = workbook.worksheets[0];

    let headers: string[] = [];
    let procesadas = 0;
    let errores = 0;
    const BATCH_SIZE = 200;
    const batch: any[] = [];

    const flush = async () => {
      if (batch.length === 0) return;
      // Upsert concurrente en lote para mayor rendimiento
      const ops = batch.map(row =>
        this.prisma.padronAcademico.upsert({
          where: { dni_convocatoriaId: { dni: row.dni, convocatoriaId } },
          create: { ...row, convocatoriaId },
          update: { ...row },
        })
        .then(() => { procesadas++; })
        .catch(() => { errores++; })
      );
      await Promise.all(ops);
      batch.length = 0;
    };

    ws.eachRow((row, rowIndex) => {
      if (rowIndex < HEADER_ROW) return;
      if (rowIndex === HEADER_ROW) {
        row.eachCell((cell) => headers.push(String(cell.value ?? '').trim()));
        return;
      }

      const raw: any = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        const field = COL_MAP[header];
        if (field) raw[field] = cell.value;
      });

      if (!raw.dni) return;
      raw.dni = String(raw.dni).replace(/\./g, '').trim();
      if (!raw.dni || raw.dni === '0') return;

      raw.legajo = String(raw.legajo ?? '').trim();
      raw.nombreCompleto = String(raw.nombreCompleto ?? '').trim();
      raw.especialidadCodigo = raw.especialidadCodigo ? Number(raw.especialidadCodigo) : null;
      raw.plan = raw.plan ? Number(raw.plan) : null;
      raw.anioIngreso = raw.anioIngreso ? Number(String(raw.anioIngreso).replace('.', '')) : null;
      raw.regularizadas = Number(raw.regularizadas) || 0;
      raw.cursando = Number(raw.cursando) || 0;
      raw.aprobadas = Number(raw.aprobadas) || 0;
      raw.promedio = parseFloat(String(raw.promedio ?? '0').replace(',', '.')) || 0;
      raw.aplazos = Number(raw.aplazos) || 0;
      raw.estado = String(raw.estado ?? 'Activo').trim();

      batch.push(raw);
    });

    // Flush all at once after reading is complete
    const CHUNK = 200;
    for (let i = 0; i < batch.length; i += CHUNK) {
      const chunk = batch.slice(i, i + CHUNK);
      const ops = chunk.map(row =>
        this.prisma.padronAcademico.upsert({
          where: { dni_convocatoriaId: { dni: row.dni, convocatoriaId } },
          create: { ...row, convocatoriaId },
          update: { ...row },
        })
        .then(() => { procesadas++; })
        .catch(() => { errores++; })
      );
      await Promise.all(ops);
    }

    return { procesadas, errores };
  }
}
