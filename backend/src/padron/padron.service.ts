import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';

// Columnas conocidas que DEBEN estar en la fila de headers
const KNOWN_HEADERS = new Set([
  'N°Documento', 'Apellido y Nombres', 'Legajo', 'Legajo ', 'Prom.c/Apl',
  'Total Aprobadas', 'Regularizadas', 'Esp.',
]);

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
  private readonly logger = new Logger(PadronService.name);

  constructor(private readonly prisma: PrismaService) { }

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
    this.logger.log(`Iniciando carga de maestro: ${filePath} para convocatoria ${convocatoriaId}`);

    const esCsv = filePath.toLowerCase().endsWith('.csv');

    let headers: string[] = [];
    const batch: any[] = [];
    let headerRowIndex = -1;
    let procesadas = 0;
    let errores = 0;

    if (esCsv) {
      const fs = require('fs');
      const csv = require('csv-parser');

      // Detectar separador leyendo la primera línea
      const firstLine = await new Promise<string>((resolve) => {
        const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
        let data = '';
        stream.on('data', chunk => {
          data += chunk;
          const newlineIdx = data.indexOf('\n');
          if (newlineIdx !== -1) {
            stream.destroy();
            resolve(data.substring(0, newlineIdx));
          }
        });
        stream.on('end', () => resolve(data));
      });
      const separator = firstLine.includes(';') ? ';' : ',';
      this.logger.log(`CSV detectado. Separador: '${separator}'`);

      await new Promise<void>((resolve, reject) => {
        let rowIndex = 1;
        fs.createReadStream(filePath)
          .pipe(csv({ headers: false, separator }))
          .on('data', (data: Record<string, string>) => {
            const cells = Object.values(data).map(c => String(c ?? '').trim());
            
            if (headerRowIndex === -1) {
              const hasKnownHeader = cells.some((c) => KNOWN_HEADERS.has(c));
              if (hasKnownHeader) {
                headerRowIndex = rowIndex;
                headers = cells;
                this.logger.log(`Header encontrado en fila ${headerRowIndex}: ${JSON.stringify(headers)}`);
              }
            } else {
              const raw: any = {};
              cells.forEach((cell, i) => {
                const header = headers[i];
                const field = COL_MAP[header];
                if (field) raw[field] = cell;
              });

              if (raw.dni && String(raw.dni).replace(/\./g, '').trim() !== '0') {
                raw.dni = String(raw.dni).replace(/\./g, '').trim();
                raw.legajo = String(raw.legajo ?? '').trim();
                raw.nombreCompleto = String(raw.nombreCompleto ?? '').trim();
                raw.especialidadCodigo = raw.especialidadCodigo ? parseInt(String(raw.especialidadCodigo).replace(/\./g, ''), 10) : null;
                raw.plan = raw.plan ? parseInt(String(raw.plan).replace(/\./g, ''), 10) : null;
                raw.anioIngreso = raw.anioIngreso ? parseInt(String(raw.anioIngreso).replace(/\./g, ''), 10) : null;
                raw.regularizadas = parseInt(String(raw.regularizadas).replace(/\./g, ''), 10) || 0;
                raw.cursando = parseInt(String(raw.cursando).replace(/\./g, ''), 10) || 0;
                raw.aprobadas = parseInt(String(raw.aprobadas).replace(/\./g, ''), 10) || 0;
                raw.promedio = parseFloat(String(raw.promedio ?? '0').replace(',', '.')) || 0;
                raw.aplazos = parseInt(String(raw.aplazos).replace(/\./g, ''), 10) || 0;
                raw.estado = String(raw.estado ?? 'Activo').trim();
                batch.push(raw);
              }
            }
            rowIndex++;
          })
          .on('end', () => resolve())
          .on('error', reject);
      });
      this.logger.log(`Archivo CSV leído en memoria. Filas útiles: ${batch.length}`);
      
    } else {
      // Leer workbook completo en memoria (para XLSX)
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const ws = workbook.worksheets[0];
      this.logger.log(`Archivo XLSX leído. Filas totales: ${ws.rowCount}`);

      ws.eachRow((row, rowIndex) => {
        if (headerRowIndex === -1) {
          const cells: string[] = [];
          row.eachCell((cell) => cells.push(String(cell.value ?? '').trim()));
          const hasKnownHeader = cells.some((c) => KNOWN_HEADERS.has(c));
          if (hasKnownHeader) {
            headerRowIndex = rowIndex;
            headers = cells;
            this.logger.log(`Header encontrado en fila ${headerRowIndex}: ${JSON.stringify(headers)}`);
          }
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
        raw.especialidadCodigo = raw.especialidadCodigo ? parseInt(String(raw.especialidadCodigo).replace(/\./g, ''), 10) : null;
        raw.plan = raw.plan ? parseInt(String(raw.plan).replace(/\./g, ''), 10) : null;
        raw.anioIngreso = raw.anioIngreso ? parseInt(String(raw.anioIngreso).replace(/\./g, ''), 10) : null;
        raw.regularizadas = parseInt(String(raw.regularizadas).replace(/\./g, ''), 10) || 0;
        raw.cursando = parseInt(String(raw.cursando).replace(/\./g, ''), 10) || 0;
        raw.aprobadas = parseInt(String(raw.aprobadas).replace(/\./g, ''), 10) || 0;
        raw.promedio = parseFloat(String(raw.promedio ?? '0').replace(',', '.')) || 0;
        raw.aplazos = parseInt(String(raw.aplazos).replace(/\./g, ''), 10) || 0;
        raw.estado = String(raw.estado ?? 'Activo').trim();

        batch.push(raw);
      });
    }

    if (headerRowIndex === -1) {
      this.logger.error(`No se encontró fila de headers en el archivo.`);
      return { procesadas: 0, errores: 0 };
    }

    this.logger.log(`Headers encontrados: ${JSON.stringify(headers)}`);
    this.logger.log(`Filas válidas para insertar: ${batch.length}`);

    // ── Deduplicar por DNI ────────────────────────────────────────────────
    // El maestro suele traer el mismo DNI más de una vez (fila corregida
    // reinsertada más abajo, alumno en más de un plan, etc.). Si dos filas
    // con el mismo dni caen en el mismo chunk, el UPSERT con unnest() falla
    // completo: "ON CONFLICT DO UPDATE command cannot affect row a second
    // time" — Postgres no permite que un mismo INSERT afecte la misma fila
    // dos veces, sin importar en qué posición del chunk estén. Por eso hay
    // que dedupear ACÁ, antes de chunkear, no alcanza con separar en lotes.
    // Nos quedamos con la última ocurrencia de cada DNI (gana la fila que
    // aparece más abajo en el archivo, igual semántica que un upsert normal).
    const porDni = new Map<string, any>();
    for (const row of batch) porDni.set(row.dni, row);
    const dedupedBatch = [...porDni.values()];
    const duplicados = batch.length - dedupedBatch.length;
    if (duplicados > 0) {
      this.logger.warn(`Se encontraron ${duplicados} filas con DNI duplicado en el archivo; se conserva la última ocurrencia de cada una.`);
    }

    // Bulk upsert masivo usando raw SQL y unnest para procesar miles de filas por segundo
    // Esto previene que el request HTTP haga timeout (120s) procesando de a 1 fila
    const UPSERT_CHUNK_SIZE = 3000;

    for (let i = 0; i < dedupedBatch.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = dedupedBatch.slice(i, i + UPSERT_CHUNK_SIZE);

      const ids = chunk.map(() => randomUUID());
      const dnis = chunk.map(r => String(r.dni));
      const legajos = chunk.map(r => String(r.legajo));
      const nombres = chunk.map(r => String(r.nombreCompleto));
      const especialidades = chunk.map(r => isNaN(r.especialidadCodigo) ? null : r.especialidadCodigo);
      const planes = chunk.map(r => isNaN(r.plan) ? null : r.plan);
      const anios = chunk.map(r => isNaN(r.anioIngreso) ? null : r.anioIngreso);
      const regulares = chunk.map(r => isNaN(r.regularizadas) ? 0 : r.regularizadas);
      const cursos = chunk.map(r => isNaN(r.cursando) ? 0 : r.cursando);
      const aprobadas = chunk.map(r => isNaN(r.aprobadas) ? 0 : r.aprobadas);
      const promedios = chunk.map(r => isNaN(r.promedio) ? 0 : r.promedio);
      const aplazos = chunk.map(r => isNaN(r.aplazos) ? 0 : r.aplazos);
      const estados = chunk.map(r => String(r.estado));
      const convIds = chunk.map(() => convocatoriaId);

      try {
        await this.prisma.$executeRaw`
          INSERT INTO padron_academico (
            id, dni, legajo, nombre_completo, especialidad_codigo, plan, anio_ingreso,
            regularizadas, cursando, aprobadas, promedio, aplazos, estado, convocatoria_id
          )
          SELECT * FROM unnest(
            ${ids}::text[],
            ${dnis}::text[],
            ${legajos}::text[],
            ${nombres}::text[],
            ${especialidades}::int[],
            ${planes}::int[],
            ${anios}::int[],
            ${regulares}::int[],
            ${cursos}::int[],
            ${aprobadas}::int[],
            ${promedios}::numeric[],
            ${aplazos}::int[],
            ${estados}::text[],
            ${convIds}::text[]
          )
          ON CONFLICT (dni, convocatoria_id)
          DO UPDATE SET
            legajo = EXCLUDED.legajo,
            nombre_completo = EXCLUDED.nombre_completo,
            especialidad_codigo = EXCLUDED.especialidad_codigo,
            plan = EXCLUDED.plan,
            anio_ingreso = EXCLUDED.anio_ingreso,
            regularizadas = EXCLUDED.regularizadas,
            cursando = EXCLUDED.cursando,
            aprobadas = EXCLUDED.aprobadas,
            promedio = EXCLUDED.promedio,
            aplazos = EXCLUDED.aplazos,
            estado = EXCLUDED.estado
        `;
        procesadas += chunk.length;
      } catch (err: any) {
        errores += chunk.length;
        this.logger.error(`Error procesando lote de ${chunk.length} filas: ${err.message}`);
      }

      if ((i + UPSERT_CHUNK_SIZE) % 6000 === 0 || i + UPSERT_CHUNK_SIZE >= dedupedBatch.length) {
        this.logger.log(`Progreso: ${Math.min(i + UPSERT_CHUNK_SIZE, dedupedBatch.length)}/${dedupedBatch.length} filas procesadas`);
      }
    }

    this.logger.log(`Carga completada: ${procesadas} procesadas, ${errores} errores`);
    return { procesadas, errores };
  }
}