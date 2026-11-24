import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  nombreEspecialidad,
  materiasDelPlanPorCodigo,
} from '../especialidades/especialidades';
import { normalizarLegajo } from '../padron/resolver-datos';
import { EstadoAsignacion, TipoPropuesta } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { StorageService } from '../storage/storage.service';

/**
 * Columnas del reporte de asignación, espejando la tab "ASIGNACIÓN COMPLETA"
 * del libro "ORDEN DE MERITO" (RF-20).
 *
 * Quedan afuera las columnas del proceso manual de envío de mails (Mail del
 * estudiante, Género, RES. N°, PERFIL VÁLIDO, estados de Campaign): no viven
 * en la base y no tienen valor en el reporte operativo.
 */
const COLUMNAS_ASIGNACION = [
  'DNI',
  'Apellido',
  'Nombre',
  'Legajo',
  'Carrera',
  'Carga Horaria',
  'Fecha Inicio',
  'Fecha Fin',
  'Cód.',
  'Nombre Área',
  'Nombre Proyecto',
  'Período',
  'Cant. Modulos',
  'Tipo de Becas',
  'Nombre Responsable',
  'Mail Responsable',
];

const ANCHOS_ASIGNACION: number[] = [
  10, 20, 24, 9, 10, 13, 12, 12, 18, 34, 50, 8, 12, 16, 28, 30,
];

const COLUMNAS_RANKING = [
  'Posición',
  'DNI',
  'Apellido',
  'Nombre',
  'Legajo',
  'Carrera',
  'Promedio',
  'Aprobadas',
  'Cursadas',
  'Mat. de la carrera',
  'Aplazos',
  'Antecedentes',
  'Factor',
  'Habilitado',
  'Motivo inhabilitación',
];

const ANCHOS_RANKING: number[] = [
  10, 14, 22, 24, 10, 12, 11, 12, 12, 18, 10, 14, 12, 12, 40,
];

const PRIORIDADES_EN_PLANILLA = 11;

/**
 * El padrón guarda `"Apellido, Nombre"` tal como viene del maestro, comillas
 * CSV incluidas (`parseCsvLine` no las saca). La coma es el separador real;
 * el corte en el primer token es solo el fallback para un nombre sin coma.
 */
export function separarNombre(nombreCompleto: string): {
  apellido: string;
  nombre: string;
} {
  const limpio = String(nombreCompleto ?? '')
    .trim()
    .replace(/^"+|"+$/g, '');
  const idxComa = limpio.indexOf(',');
  if (idxComa >= 0) {
    return {
      apellido: limpio.slice(0, idxComa).trim(),
      nombre: limpio.slice(idxComa + 1).trim(),
    };
  }
  const partes = limpio.split(/\s+/);
  const apellido = partes.shift() ?? '';
  return { apellido, nombre: partes.join(' ') };
}

/** Fecha como dd/mm/aaaa, el formato del libro de orden de mérito. */
export function formatoFecha(fecha: Date | string | null | undefined): string {
  if (!fecha) return '';
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Un módulo equivale a 6 hs semanales (criterio de las solicitudes). */
export function cargaHorariaModulos(
  modulos: number | null | undefined,
): string {
  const m = modulos && modulos > 0 ? modulos : 1;
  return `${m * 6}hs`;
}

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async generarReporteAsignacion(convocatoriaId: string): Promise<Buffer> {
    const corrida = await this.prisma.corridaAsignacion.findFirst({
      where: { convocatoriaId, vigente: true },
      include: {
        convocatoria: true,
        resultados: {
          include: {
            padron: true,
            propuesta: true,
          },
        },
      },
    });

    if (!corrida)
      throw new NotFoundException(
        'No hay corrida de asignación vigente para esta convocatoria',
      );

    // La tab de referencia lista sólo a los becarios asignados, ordenados por
    // apellido. Los NO_ASIGNADO quedan fuera de la planilla de asignación.
    const asignados = corrida.resultados
      .filter((r) => r.estado === EstadoAsignacion.ASIGNADO)
      .map((r) => {
        const { apellido, nombre } = separarNombre(r.padron.nombreCompleto);
        const propuesta = r.propuesta;
        const esInvestigacion = propuesta?.tipo === TipoPropuesta.INVESTIGACION;
        return { apellido, nombre, esInvestigacion, r, propuesta };
      })
      .sort(
        (a, b) =>
          a.apellido.localeCompare(b.apellido, 'es') ||
          a.nombre.localeCompare(b.nombre, 'es'),
      );

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('ASIGNACIÓN COMPLETA');
    ws.columns = COLUMNAS_ASIGNACION.map((header, i) => ({
      header,
      width: ANCHOS_ASIGNACION[i] ?? 15,
    }));
    ws.getRow(1).font = { bold: true };

    for (const {
      apellido,
      nombre,
      esInvestigacion,
      r,
      propuesta,
    } of asignados) {
      ws.addRow([
        r.padron.dni,
        apellido,
        nombre,
        normalizarLegajo(r.padron.legajo),
        nombreEspecialidad(r.padron.especialidadCodigo),
        cargaHorariaModulos(propuesta?.modulos),
        formatoFecha(corrida.convocatoria.fechaApertura),
        formatoFecha(corrida.convocatoria.fechaCierre),
        propuesta?.idExterno ?? '-',
        propuesta?.dependencia || propuesta?.titulo || '-',
        esInvestigacion ? propuesta.titulo : '',
        propuesta?.periodo ?? '',
        propuesta?.modulos ?? 1,
        esInvestigacion ? 'Investigación' : 'Servicio',
        propuesta?.responsableNombre ?? '-',
        propuesta?.responsableEmail ?? '-',
      ]);
    }

    const fileName = `reporte_asignacion_${convocatoriaId}_${Date.now()}.xlsx`;
    const path = `reportes/${convocatoriaId}/${fileName}`;
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await this.storageService.uploadBuffer(
      path,
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    return buffer;
  }

  async generarReporteRanking(convocatoriaId: string): Promise<Buffer> {
    const resultados = await this.prisma.resultadoRanking.findMany({
      where: { convocatoriaId },
      orderBy: [{ posicion: 'asc' }, { puntajeTotal: 'desc' }],
      include: { padron: true },
    });

    const postulaciones =
      resultados.length === 0
        ? []
        : await this.prisma.postulacion.findMany({
            where: {
              convocatoriaId,
              padronId: { in: resultados.map((r) => r.padronId) },
            },
            orderBy: [{ padronId: 'asc' }, { ordenPreferencia: 'asc' }],
            select: {
              padronId: true,
              ordenPreferencia: true,
              propuesta: { select: { idExterno: true } },
            },
          });

    const prefsPorPadron = new Map<string, string[]>();
    for (const p of postulaciones) {
      const lista = prefsPorPadron.get(p.padronId) ?? [];
      lista.push(
        `${p.propuesta?.idExterno ?? ''} - prio: ${p.ordenPreferencia}`,
      );
      prefsPorPadron.set(p.padronId, lista);
    }

    const maxPrioridades = Math.max(
      PRIORIDADES_EN_PLANILLA,
      ...Array.from(prefsPorPadron.values(), (lista) => lista.length),
    );
    const headers = [
      ...COLUMNAS_RANKING,
      ...Array.from({ length: maxPrioridades }, (_, i) => `Prioridad ${i + 1}`),
    ];
    const anchos = [
      ...ANCHOS_RANKING,
      ...Array.from({ length: maxPrioridades }, () => 26),
    ];

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('RANKING');
    ws.columns = headers.map((header, i) => ({
      header,
      width: anchos[i] ?? 18,
    }));
    ws.getRow(1).font = { bold: true };

    for (const r of resultados) {
      const { apellido, nombre } = separarNombre(r.padron.nombreCompleto);
      const prioridades = prefsPorPadron.get(r.padronId) ?? [];
      ws.addRow([
        r.posicion ?? '',
        r.padron.dni,
        apellido,
        nombre,
        normalizarLegajo(r.padron.legajo),
        nombreEspecialidad(r.padron.especialidadCodigo),
        Number(r.padron.promedio),
        r.padron.aprobadas,
        r.padron.regularizadas,
        materiasDelPlanPorCodigo(r.padron.especialidadCodigo) ?? '',
        r.padron.aplazos,
        Number(r.bonusAntecedentes),
        Number(r.puntajeTotal),
        r.habilitado ? 'Sí' : 'No',
        r.motivoInhabilitacion ?? '',
        ...Array.from(
          { length: maxPrioridades },
          (_, i) => prioridades[i] ?? '',
        ),
      ]);
    }

    const fileName = `reporte_ranking_${convocatoriaId}_${Date.now()}.xlsx`;
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await this.storageService.uploadBuffer(
      `reportes/${convocatoriaId}/${fileName}`,
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    return buffer;
  }
}
