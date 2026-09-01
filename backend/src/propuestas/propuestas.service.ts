import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoConvocatoria, EstadoPropuesta } from '@prisma/client';
import { CreatePropuestaDto, UpdateVacantesDto } from './dto/propuesta.dto';

@Injectable()
export class PropuestasService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(convocatoriaId?: string) {
    return this.prisma.propuesta.findMany({
      where: { ...(convocatoriaId && { convocatoriaId }) },
      orderBy: { titulo: 'asc' },
    });
  }

  async findOne(id: string) {
    const prop = await this.prisma.propuesta.findUnique({ where: { id } });
    if (!prop) throw new NotFoundException(`Propuesta ${id} no encontrada`);
    return prop;
  }

  async create(dto: CreatePropuestaDto) {
    return this.prisma.propuesta.create({
      data: {
        ...dto,
        vacantesDisponibles: dto.vacantesTotal,
      },
    });
  }

  async publicar(id: string) {
    const prop = await this.findOne(id);
    if (prop.estado === EstadoPropuesta.PUBLICADA) {
      throw new ConflictException('La propuesta ya está publicada');
    }
    return this.prisma.propuesta.update({
      where: { id },
      data: { estado: EstadoPropuesta.PUBLICADA },
    });
  }

  async updateVacantes(id: string, dto: UpdateVacantesDto) {
    const prop = await this.findOne(id);
    // RN-02: no modificar vacantes si la convocatoria está cerrada
    const conv = await this.prisma.convocatoria.findUnique({ where: { id: prop.convocatoriaId } });
    if (conv && conv.estado !== EstadoConvocatoria.ABIERTA) {
      throw new ConflictException('No se pueden modificar vacantes con la convocatoria cerrada (RN-02)');
    }

    const valorAnterior = prop.vacantesTotal;
    const diff = dto.vacantesTotal - valorAnterior;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.propuesta.update({
        where: { id },
        data: {
          vacantesTotal: dto.vacantesTotal,
          vacantesDisponibles: { increment: diff },
        },
      });
      // RF-04: auditoría de cambio de vacantes
      await tx.vacanteAuditoria.create({
        data: { propuestaId: id, valorAnterior, valorNuevo: dto.vacantesTotal },
      });
      return updated;
    });
  }

  // Carga masiva desde XLS de solicitudes
  async importarDesdeXls(rows: any[], convocatoriaId: string) {
    const created: any[] = [];
    for (const row of rows) {
      const existing = await this.prisma.propuesta.findUnique({
        where: { idExterno: String(row.numero) },
      });
      if (existing) continue;

      const tipo = row.tipo === 'I' ? 'INVESTIGACION' : 'SERVICIO';
      const prop = await this.prisma.propuesta.create({
        data: {
          idExterno: String(row.numero),
          titulo: row.proyecto || row.area_servicio || row.area_investigacion || '',
          tipo,
          responsableNombre: row.responsable_ayn ?? '',
          responsableEmail: row.responsable_email ?? '',
          vacantesTotal: Number(row.cantidad_becarios) || 1,
          vacantesDisponibles: Number(row.cantidad_becarios) || 1,
          modulos: Number(row.cantidad_modulos) || 1,
          dependencia: row['dependencia__nombre'] ?? null,
          especialidades: row.especialidad ?? null,
          periodo: row.periodo ?? null,
          horario: row.horario ?? null,
          objetivo: row.objetivo ?? null,
          tareas: row.tareas ?? null,
          observaciones: row.observaciones ?? null,
          reqRegularizadas: row.regularizadas ?? null,
          reqAprobadas: row.aprobadas ?? null,
          reqOtros: row.otros ?? null,
          estado: EstadoPropuesta.PUBLICADA,
          convocatoriaId,
        },
      });
      created.push(prop);
    }
    return { importadas: created.length };
  }
}
