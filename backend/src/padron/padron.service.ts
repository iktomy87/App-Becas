import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as readline from 'readline';

// El CSV del maestro tiene metadatos en filas 1-5; el header real está en la fila 6
const HEADER_ROW = 6;

// Mapeo de columnas del CSV a campos del modelo
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

const BATCH_SIZE = 100;

function parseRow(headers: string[], values: string[]): any | null {
  const raw: any = {};
  headers.forEach((header, i) => {
    const field = COL_MAP[header.trim()];
    if (field) raw[field] = (values[i] ?? '').trim();
  });

  if (!raw.dni) return null;
  raw.dni = String(raw.dni).replace(/\./g, '').trim();
  if (!raw.dni || raw.dni === '0') return null;

  raw.legajo = String(raw.legajo ?? '').trim();
  raw.nombreCompleto = String(raw.nombreCompleto ?? '').trim();
  raw.especialidadCodigo = raw.especialidadCodigo ? Number(raw.especialidadCodigo) : null;
  raw.plan = raw.plan ? Number(raw.plan) : null;
  raw.anioIngreso = raw.anioIngreso ? Number(String(raw.anioIngreso).replace(/\./g, '')) : null;
  raw.regularizadas = Number(raw.regularizadas) || 0;
  raw.cursando = Number(raw.cursando) || 0;
  raw.aprobadas = Number(raw.aprobadas) || 0;
  raw.promedio = parseFloat(String(raw.promedio ?? '0').replace(',', '.')) || 0;
  raw.aplazos = Number(raw.aplazos) || 0;
  raw.estado = String(raw.estado ?? 'Activo').trim();

  return raw;
}

// Parsea una línea de CSV respetando comillas
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

@Injectable()
export class PadronService {
  private readonly logger = new Logger(PadronService.name);

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
    this.logger.log(`Procesando padrón: ${filePath}`);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let rowIndex = 0;
    let headers: string[] = [];
    let procesadas = 0;
    let errores = 0;
    const batch: any[] = [];

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const ops = batch.splice(0).map(row =>
        this.prisma.padronAcademico.upsert({
          where: { dni_convocatoriaId: { dni: row.dni, convocatoriaId } },
          create: { ...row, convocatoriaId },
          update: { ...row },
        })
        .then(() => { procesadas++; })
        .catch((e) => {
          this.logger.warn(`Error upsert DNI=${row.dni}: ${e.message}`);
          errores++;
        })
      );
      await Promise.all(ops);
    };

    for await (const line of rl) {
      rowIndex++;
      if (rowIndex < HEADER_ROW) continue;

      const values = parseCsvLine(line);

      if (rowIndex === HEADER_ROW) {
        headers = values.map(h => h.trim());
        this.logger.log(`Headers encontrados: ${headers.slice(0, 6).join(', ')}...`);
        continue;
      }

      const row = parseRow(headers, values);
      if (!row) continue;

      batch.push(row);

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }

    // Flush del último lote
    await flushBatch();

    this.logger.log(`Padrón procesado: ${procesadas} filas OK, ${errores} errores`);
    return { procesadas, errores };
  }
}
