import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RankingV1Strategy } from './strategies/ranking-v1.strategy';
import { EstadoConvocatoria } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';

@Injectable()
export class RankingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly strategy: RankingV1Strategy,
  ) {}

  async calcularRanking(convocatoriaId: string): Promise<{ calculados: number; inhabilitados: number }> {
    const conv = await this.prisma.convocatoria.findUnique({
      where: { id: convocatoriaId },
      include: { rankingConfig: true },
    });
    if (!conv) throw new Error('Convocatoria no encontrada');
    if (conv.estado !== EstadoConvocatoria.CERRADA && conv.estado !== EstadoConvocatoria.EN_RANKING) {
      throw new Error('La convocatoria debe estar CERRADA para calcular el ranking');
    }

    const config = conv.rankingConfig ?? { minMateriasCursando: 3, minRegularizadas: 1, criterioDesempate: 'PROMEDIO', id: '' };

    // Cambiar estado a EN_RANKING
    await this.prisma.convocatoria.update({ where: { id: convocatoriaId }, data: { estado: EstadoConvocatoria.EN_RANKING } });

    // Obtener postulantes únicos por cursor (streaming — RNF-02)
    const postulantesUnicos = await this.prisma.postulacion.findMany({
      where: { convocatoriaId },
      select: { padronId: true },
      distinct: ['padronId'],
    });

    let calculados = 0;
    let inhabilitados = 0;

    for (const { padronId } of postulantesUnicos) {
      const padron = await this.prisma.padronAcademico.findUnique({ where: { id: padronId } });
      if (!padron) continue;

      const habilitacion = this.strategy.verificarHabilitacion(padron, {
        minMateriasCursando: config.minMateriasCursando,
        minRegularizadas: config.minRegularizadas,
      });

      const desglose = habilitacion.habilitado
        ? this.strategy.calcularPuntaje(padron)
        : { terminoPromedio: 0, terminoAprobadas: 0, terminoAvance: 0, terminoAplazos: 0, bonusAntecedentes: 0, puntajeTotal: 0 };

      await this.prisma.resultadoRanking.upsert({
        where: { padronId_convocatoriaId: { padronId, convocatoriaId } },
        create: {
          padronId,
          convocatoriaId,
          rankingConfigId: config.id,
          puntajeTotal: desglose.puntajeTotal,
          terminoPromedio: desglose.terminoPromedio,
          terminoAprobadas: desglose.terminoAprobadas,
          terminoAvance: desglose.terminoAvance,
          terminoAplazos: desglose.terminoAplazos,
          bonusAntecedentes: desglose.bonusAntecedentes,
          habilitado: habilitacion.habilitado,
          motivoInhabilitacion: habilitacion.motivo ?? null,
          criterioDesempateVal: Number(padron.promedio),
        },
        update: {
          puntajeTotal: desglose.puntajeTotal,
          terminoPromedio: desglose.terminoPromedio,
          terminoAprobadas: desglose.terminoAprobadas,
          terminoAvance: desglose.terminoAvance,
          terminoAplazos: desglose.terminoAplazos,
          habilitado: habilitacion.habilitado,
          motivoInhabilitacion: habilitacion.motivo ?? null,
        },
      });

      habilitacion.habilitado ? calculados++ : inhabilitados++;
    }

    // Asignar posiciones ordenadas descendentemente
    const rankingOrdenado = await this.prisma.resultadoRanking.findMany({
      where: { convocatoriaId, habilitado: true },
      orderBy: [{ puntajeTotal: 'desc' }, { criterioDesempateVal: 'desc' }],
    });

    for (let i = 0; i < rankingOrdenado.length; i++) {
      await this.prisma.resultadoRanking.update({
        where: { id: rankingOrdenado[i].id },
        data: { posicion: i + 1 },
      });
    }

    return { calculados, inhabilitados };
  }

  async getRanking(convocatoriaId: string, page = 1, limit = 50) {
    const [data, total] = await Promise.all([
      this.prisma.resultadoRanking.findMany({
        where: { convocatoriaId },
        orderBy: [{ posicion: 'asc' }, { puntajeTotal: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { padron: { select: { dni: true, legajo: true, nombreCompleto: true, promedio: true, regularizadas: true, aprobadas: true, aplazos: true } } },
      }),
      this.prisma.resultadoRanking.count({ where: { convocatoriaId } }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  getDesglose(convocatoriaId: string, dni: string) {
    return this.prisma.resultadoRanking.findFirst({
      where: { convocatoriaId, padron: { dni } },
      include: { padron: true, rankingConfig: true },
    });
  }
  /** Fila cruda leída del archivo de orden de mérito (CSV o Excel). */
  private interpretarFilaRanking(getCampo: (...claves: string[]) => any) {
    const numero = (v: any) => {
      const n = Number(String(v ?? '').replace(',', '.').trim());
      return Number.isFinite(n) ? n : 0;
    };
    const rawDni = getCampo('DNI', 'DOCUMENTO') ?? '';
    const dni = String(rawDni).replace(/[,.]/g, '').trim();
    return {
      dni,
      promedio: numero(getCampo('PROMEDIO')),
      aprobadas: numero(getCampo('APROBADAS')),
      cursadas: numero(getCampo('CURSADAS')),
      // Este dato viene siempre del archivo — cada carrera tiene un plan distinto
      // (ISI=42, IEM/IQ=45, LAR=36, TUP/TUM=18, etc.) y no hay que adivinarlo.
      materiasPlan: numero(getCampo('MAT DE LA CARRERA', 'MATERIAS DE LA CARRERA', 'MATERIAS DEL PLAN', 'MATERIAS PLAN')),
      aplazos: numero(getCampo('APLAZOS')),
      bonusAntecedentes: numero(getCampo('ANTECEDENTES')),
    };
  }

  private normalizarHeader(s: string): string {
    return s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
  }

  async importarRanking(convocatoriaId: string, file: Express.Multer.File) {
    const conv = await this.prisma.convocatoria.findUnique({
      where: { id: convocatoriaId },
      include: { rankingConfig: true },
    });
    if (!conv) throw new Error('Convocatoria no encontrada');

    const config = conv.rankingConfig ?? await this.prisma.rankingConfig.create({
      data: {
        convocatoriaId,
        nombre: 'Importado',
        tipo: 'EXTERNO',
        minMateriasCursando: 0,
        minRegularizadas: 0,
        criterioDesempate: 'PROMEDIO',
      },
    });

    // 1. Parsear el archivo de orden de mérito completo: trae, por alumno,
    //    Promedio, Aprobadas, Cursadas, Mat. de la carrera, Aplazos y Antecedentes.
    //    Todo sale del archivo — no se infiere ni se hardcodea nada acá.
    type FilaRanking = ReturnType<RankingService['interpretarFilaRanking']>;
    const filas: FilaRanking[] = [];
    const esCsv = file.originalname.toLowerCase().endsWith('.csv');

    if (esCsv) {
      const csv = require('csv-parser');
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(file.path)
          .pipe(csv())
          .on('data', (data: any) => {
            const claveOriginal = new Map(Object.keys(data).map((k) => [this.normalizarHeader(k), k]));
            const getCampo = (...claves: string[]) => {
              for (const clave of claves) {
                const original = claveOriginal.get(clave);
                if (original !== undefined) return data[original];
              }
              return undefined;
            };
            const fila = this.interpretarFilaRanking(getCampo);
            if (fila.dni) filas.push(fila);
          })
          .on('end', () => resolve())
          .on('error', (err: any) => reject(err));
      });
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      const sheet = workbook.worksheets[0];
      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = this.normalizarHeader(String(cell.value ?? ''));
      });
      const colIndex = (...claves: string[]) => headers.findIndex((h) => claves.includes(h));

      for (let i = 2; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        const getCampo = (...claves: string[]) => {
          const idx = colIndex(...claves);
          return idx > 0 ? row.getCell(idx).value : undefined;
        };
        const fila = this.interpretarFilaRanking(getCampo);
        if (fila.dni) filas.push(fila);
      }
    }
    fs.unlinkSync(file.path);

    // 2. Traer los padrones correspondientes, solo para poder linkear el padronId
    const padrones = await this.prisma.padronAcademico.findMany({
      where: { convocatoriaId, dni: { in: filas.map((f) => f.dni) } },
    });
    const padronPorDni = new Map(padrones.map((p) => [p.dni, p]));

    let filasTotal = 0;
    let filasValidas = 0;
    let filasError = 0;
    const errores: string[] = [];

    // 3. Calcular el puntaje reutilizando la misma fórmula que usa calcularRanking,
    //    pero con los valores tal como vienen en el archivo (fuente de verdad).
    for (const fila of filas) {
      filasTotal++;
      const padron = padronPorDni.get(fila.dni);

      if (!padron) {
        filasError++;
        errores.push(`DNI ${fila.dni}: no se encontró en el padrón de esta convocatoria`);
        continue;
      }
      if (!fila.materiasPlan) {
        filasError++;
        errores.push(`DNI ${fila.dni}: falta "Mat. de la carrera" en el archivo, no se puede calcular el factor`);
        continue;
      }

      const desglose = this.strategy.calcularPuntaje(
        {
          ...padron,
          promedio: fila.promedio,
          aprobadas: fila.aprobadas,
          cursando: fila.cursadas,
          aplazos: fila.aplazos,
        } as any,
        fila.materiasPlan,
      );
      const puntajeTotal = desglose.puntajeTotal + fila.bonusAntecedentes;

      await this.prisma.resultadoRanking.upsert({
        where: { padronId_convocatoriaId: { padronId: padron.id, convocatoriaId } },
        create: {
          padronId: padron.id,
          convocatoriaId,
          rankingConfigId: config.id,
          puntajeTotal,
          terminoPromedio: desglose.terminoPromedio,
          terminoAprobadas: desglose.terminoAprobadas,
          terminoAvance: desglose.terminoAvance,
          terminoAplazos: desglose.terminoAplazos,
          bonusAntecedentes: fila.bonusAntecedentes,
          criterioDesempateVal: fila.promedio,
        },
        update: {
          puntajeTotal,
          terminoPromedio: desglose.terminoPromedio,
          terminoAprobadas: desglose.terminoAprobadas,
          terminoAvance: desglose.terminoAvance,
          terminoAplazos: desglose.terminoAplazos,
          bonusAntecedentes: fila.bonusAntecedentes,
          criterioDesempateVal: fila.promedio,
        },
      });
      filasValidas++;
    }

    // 4. Asignar posiciones ordenadas — igual que hace calcularRanking, pero
    //    acá antes faltaba este paso por completo.
    const rankingOrdenado = await this.prisma.resultadoRanking.findMany({
      where: { convocatoriaId },
      orderBy: [{ puntajeTotal: 'desc' }, { criterioDesempateVal: 'desc' }],
    });
    for (let i = 0; i < rankingOrdenado.length; i++) {
      await this.prisma.resultadoRanking.update({
        where: { id: rankingOrdenado[i].id },
        data: { posicion: i + 1 },
      });
    }

    // Cambiar estado a EN_RANKING
    await this.prisma.convocatoria.update({ where: { id: convocatoriaId }, data: { estado: EstadoConvocatoria.EN_RANKING } });

    return { filasTotal, filasValidas, filasError, errores };
  }
}