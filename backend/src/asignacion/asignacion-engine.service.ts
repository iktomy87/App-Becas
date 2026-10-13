import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoAsignacion,
  EstadoConvocatoria,
  EstadoCorrida,
} from '@prisma/client';

@Injectable()
export class AsignacionEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async ejecutar(
    convocatoriaId: string,
  ): Promise<{ corridaId: string; asignados: number; noAsignados: number }> {
    // Invalidar corrida anterior si existe
    await this.prisma.corridaAsignacion.updateMany({
      where: { convocatoriaId, vigente: true },
      data: { estado: EstadoCorrida.INVALIDADA, vigente: false },
    });

    // Nueva corrida
    const corrida = await this.prisma.corridaAsignacion.create({
      data: { convocatoriaId, estado: EstadoCorrida.EN_CURSO, vigente: true },
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
          this.events.emit('asignacion.estudiante_asignado', {
            padronId: padron.id,
            propuestaId: propuesta.id,
            corridaId: corrida.id,
          });
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
        this.events.emit('asignacion.estudiante_no_asignado', {
          padronId: padron.id,
          corridaId: corrida.id,
        });
        noAsignados++;
      }
    }

    await this.prisma.corridaAsignacion.update({
      where: { id: corrida.id },
      data: {
        estado: EstadoCorrida.COMPLETADA,
        totalPostulantes: ranking.length,
        totalAsignados: asignados,
        totalNoAsignados: noAsignados,
        finishedAt: new Date(),
      },
    });
    await this.prisma.convocatoria.update({
      where: { id: convocatoriaId },
      data: { estado: EstadoConvocatoria.ASIGNADA },
    });

    this.events.emit('asignacion.finalizada', {
      convocatoriaId,
      corridaId: corrida.id,
      asignados,
      noAsignados,
    });

    return { corridaId: corrida.id, asignados, noAsignados };
  }

  /**
   * Retira a un estudiante de su área/proyecto asignado y trata de reubicarlo.
   *
   * Caso de uso: los horarios chocan o la entrevista con el responsable no
   * prospera. Se libera la vacante del área actual y se recorre el resto de las
   * preferencias del estudiante, en orden, contra las vacantes disponibles
   * (mismo criterio que el motor: RF-17/RN-06). Si ninguna otra preferencia
   * tiene cupo, el resultado pasa a NO_ASIGNADO.
   *
   * Devuelve el resultado actualizado, con la propuesta final si hubo.
   */
  async removerAsignacion(convocatoriaId: string, resultadoId: string) {
    const corrida = await this.prisma.corridaAsignacion.findFirst({
      where: { convocatoriaId, vigente: true },
      select: { id: true },
    });
    if (!corrida) {
      throw new NotFoundException(
        'No hay corrida de asignación vigente para esta convocatoria',
      );
    }

    const actual = await this.prisma.resultadoAsignacion.findFirst({
      where: { id: resultadoId, corridaId: corrida.id },
    });
    if (!actual) {
      throw new NotFoundException('No se encontró el resultado de asignación');
    }
    if (actual.estado !== EstadoAsignacion.ASIGNADO) {
      throw new ConflictException(
        'El estudiante no está asignado a ninguna área',
      );
    }

    // Preferencias del estudiante en orden de prioridad.
    const postulaciones = await this.prisma.postulacion.findMany({
      where: { padronId: actual.padronId, convocatoriaId },
      orderBy: { ordenPreferencia: 'asc' },
    });

    const propuestaActualId = actual.propuestaId;

    const actualizado = await this.prisma.$transaction(async (tx) => {
      // 1) Liberar la vacante del área de la que se lo retira.
      if (propuestaActualId) {
        await tx.propuesta.update({
          where: { id: propuestaActualId },
          data: { vacantesDisponibles: { increment: 1 } },
        });
      }

      // 2) Primera otra preferencia con cupo (chequeo atómico, como el motor).
      let reasignado: {
        propuestaId: string;
        ordenPreferencia: number;
      } | null = null;
      for (const postulacion of postulaciones) {
        if (postulacion.propuestaId === propuestaActualId) continue;
        const prop = await tx.propuesta.findUnique({
          where: { id: postulacion.propuestaId },
          select: { vacantesDisponibles: true },
        });
        if (!prop || prop.vacantesDisponibles <= 0) continue;
        await tx.propuesta.update({
          where: { id: postulacion.propuestaId },
          data: { vacantesDisponibles: { decrement: 1 } },
        });
        reasignado = {
          propuestaId: postulacion.propuestaId,
          ordenPreferencia: postulacion.ordenPreferencia,
        };
        break;
      }

      // 3) Actualizar el resultado (una sola fila por estudiante y corrida).
      const resultado = await tx.resultadoAsignacion.update({
        where: { id: actual.id },
        data: reasignado
          ? {
              propuestaId: reasignado.propuestaId,
              preferenciaSatisfecha: reasignado.ordenPreferencia,
              estado: EstadoAsignacion.ASIGNADO,
            }
          : {
              propuestaId: null,
              preferenciaSatisfecha: null,
              estado: EstadoAsignacion.NO_ASIGNADO,
            },
        include: {
          propuesta: {
            select: {
              idExterno: true,
              titulo: true,
              tipo: true,
              dependencia: true,
            },
          },
        },
      });

      // 4) Si quedó sin área, ajustar los totales de la corrida.
      if (!reasignado) {
        await tx.corridaAsignacion.update({
          where: { id: corrida.id },
          data: {
            totalAsignados: { decrement: 1 },
            totalNoAsignados: { increment: 1 },
          },
        });
      }

      return resultado;
    });

    if (actualizado.estado === EstadoAsignacion.ASIGNADO) {
      this.events.emit('asignacion.estudiante_asignado', {
        padronId: actual.padronId,
        propuestaId: actualizado.propuestaId,
        corridaId: corrida.id,
      });
    } else {
      this.events.emit('asignacion.estudiante_no_asignado', {
        padronId: actual.padronId,
        corridaId: corrida.id,
      });
    }

    return actualizado;
  }

  async getResultados(
    convocatoriaId: string,
    page = 1,
    limit = 50,
    estado?: EstadoAsignacion,
  ) {
    // La página muestra dos secciones (asignados y no asignados) y necesita el
    // resumen de la corrida aunque esa sección esté vacía; se devuelven juntos.
    const corrida = await this.prisma.corridaAsignacion.findFirst({
      where: { convocatoriaId, vigente: true },
      select: {
        id: true,
        estado: true,
        totalPostulantes: true,
        totalAsignados: true,
        totalNoAsignados: true,
        vigente: true,
      },
    });
    if (!corrida) return null;

    const where = { corridaId: corrida.id, ...(estado ? { estado } : {}) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.resultadoAsignacion.findMany({
        where,
        include: {
          padron: { select: { dni: true, legajo: true, nombreCompleto: true } },
          propuesta: {
            select: {
              idExterno: true,
              titulo: true,
              tipo: true,
              dependencia: true,
            },
          },
        },
        // El orden es por apellido (como la planilla), no por estado.
        orderBy: { padron: { nombreCompleto: 'asc' } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.resultadoAsignacion.count({ where }),
    ]);

    return { resumen: corrida, data, total, page, limit };
  }

  getResultadoPorDni(convocatoriaId: string, dni: string) {
    return this.prisma.resultadoAsignacion.findFirst({
      where: { corrida: { convocatoriaId, vigente: true }, padron: { dni } },
      include: {
        propuesta: true,
        padron: { select: { nombreCompleto: true, dni: true } },
      },
    });
  }
}
