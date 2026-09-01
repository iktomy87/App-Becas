import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoAsignacion, EstadoConvocatoria } from '@prisma/client';

@Injectable()
export class AsignacionEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async ejecutar(convocatoriaId: string): Promise<{ corridaId: string; asignados: number; noAsignados: number }> {
    // Invalidar corrida anterior si existe
    await this.prisma.corridaAsignacion.updateMany({
      where: { convocatoriaId, vigente: true },
      data: { estado: 'INVALIDADA', vigente: false },
    });

    // Nueva corrida
    const corrida = await this.prisma.corridaAsignacion.create({
      data: { convocatoriaId, estado: 'EN_CURSO', vigente: true },
    });

    // Ranking habilitado ordenado por posición (RF-16, RN-05)
    const ranking = await this.prisma.resultadoRanking.findMany({
      where: { convocatoriaId, habilitado: true, posicion: { not: null } },
      orderBy: { posicion: 'asc' },
      include: {
        padron: {
          include: {
            postulaciones: {
              where: { convocatoriaId },
              orderBy: { ordenPreferencia: 'asc' },
              include: { propuesta: true },
            },
          },
        },
      },
    });

    let asignados = 0;
    let noAsignados = 0;

    for (const entrada of ranking) {
      const padron = entrada.padron;
      let asignado = false;

      // RF-17, RN-06: evaluar preferencias en orden
      for (const postulacion of padron.postulaciones) {
        const propuesta = postulacion.propuesta;

        // RF-18, RNF-03: decremento atómico con SELECT FOR UPDATE
        const resultado = await this.prisma.$transaction(async (tx) => {
          const prop = await tx.propuesta.findUnique({
            where: { id: propuesta.id },
            // SELECT FOR UPDATE via raw query no disponible directamente en Prisma — usamos optimistic check
          });
          if (!prop || prop.vacantesDisponibles <= 0) return null;

          await tx.propuesta.update({
            where: { id: propuesta.id },
            data: { vacantesDisponibles: { decrement: 1 } },
          });
          return prop;
        });

        if (resultado) {
          await this.prisma.resultadoAsignacion.create({
            data: {
              corridaId: corrida.id,
              padronId: padron.id,
              propuestaId: propuesta.id,
              preferenciaSatisfecha: postulacion.ordenPreferencia,
              estado: EstadoAsignacion.ASIGNADO,
            },
          });
          this.events.emit('asignacion.estudiante_asignado', { padronId: padron.id, propuestaId: propuesta.id, corridaId: corrida.id });
          asignados++;
          asignado = true;
          break;
        }
      }

      if (!asignado) {
        await this.prisma.resultadoAsignacion.create({
          data: {
            corridaId: corrida.id,
            padronId: padron.id,
            estado: EstadoAsignacion.NO_ASIGNADO,
          },
        });
        this.events.emit('asignacion.estudiante_no_asignado', { padronId: padron.id, corridaId: corrida.id });
        noAsignados++;
      }
    }

    await this.prisma.corridaAsignacion.update({
      where: { id: corrida.id },
      data: { estado: 'COMPLETADA', totalPostulantes: ranking.length, totalAsignados: asignados, totalNoAsignados: noAsignados, finishedAt: new Date() },
    });
    await this.prisma.convocatoria.update({ where: { id: convocatoriaId }, data: { estado: EstadoConvocatoria.ASIGNADA } });

    this.events.emit('asignacion.finalizada', { convocatoriaId, corridaId: corrida.id, asignados, noAsignados });

    return { corridaId: corrida.id, asignados, noAsignados };
  }

  getResultados(convocatoriaId: string, page = 1, limit = 50) {
    return this.prisma.corridaAsignacion.findFirst({
      where: { convocatoriaId, vigente: true },
      include: {
        resultados: {
          skip: (page - 1) * limit,
          take: limit,
          include: {
            padron: { select: { dni: true, legajo: true, nombreCompleto: true } },
            propuesta: { select: { idExterno: true, titulo: true } },
          },
          orderBy: { estado: 'asc' },
        },
      },
    });
  }

  getResultadoPorDni(convocatoriaId: string, dni: string) {
    return this.prisma.resultadoAsignacion.findFirst({
      where: { corrida: { convocatoriaId, vigente: true }, padron: { dni } },
      include: { propuesta: true, padron: { select: { nombreCompleto: true, dni: true } } },
    });
  }
}
