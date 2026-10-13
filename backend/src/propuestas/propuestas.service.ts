import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { EstadoConvocatoria, EstadoPropuesta } from '@prisma/client';
import { CreatePropuestaDto, UpdateVacantesDto } from './dto/propuesta.dto';

@Injectable()
export class PropuestasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(convocatoriaId?: string, page = 1, limit = 50, q?: string) {
    const termino = q?.trim();
    const where: Prisma.PropuestaWhereInput = {
      ...(convocatoriaId && { convocatoriaId }),
      // Búsqueda por código, título o responsable (misma semántica `contains`
      // case-insensitive que las demás pantallas). Sin `q`, el where queda
      // como antes: solo `convocatoriaId`.
      ...(termino
        ? {
            OR: [
              { idExterno: { contains: termino, mode: 'insensitive' } },
              { titulo: { contains: termino, mode: 'insensitive' } },
              {
                responsableNombre: {
                  contains: termino,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.propuesta.findMany({
        where,
        orderBy: { titulo: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.propuesta.count({ where }),
    ]);
    return { data, total, page, limit };
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
    const conv = await this.prisma.convocatoria.findUnique({
      where: { id: prop.convocatoriaId },
    });
    if (conv && conv.estado !== EstadoConvocatoria.ABIERTA) {
      throw new ConflictException(
        'No se pueden modificar vacantes con la convocatoria cerrada (RN-02)',
      );
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
    // El archivo de solicitudes es la fuente de verdad del área: la convocatoria
    // puede tener propuestas auto-creadas desde las preferencias de la planilla
    // (responsable "Por definir") que hoy bloquearían la importación con el
    // `skip` original. Ahora se hace un upsert: las existentes se actualizan
    // (incluida la cantidad de becarios, antes de correr la corrida de
    // asignación) y las nuevas se crean.
    let importadas = 0;
    for (const row of rows) {
      const idExterno = String(row.numero);
      const tipo = row.tipo === 'I' ? 'INVESTIGACION' : 'SERVICIO';
      // El export .xls de las solicitudes llena con la cadena literal "NaN" las
      // celdas que no aplican (p. ej. `area_investigacion` en las de Servicio);
      // se normaliza a vacío para no guardar "NaN" como nombre de área.
      const limpiar = (v: unknown): string => {
        const s = String(v ?? '').trim();
        return !s || s.toLowerCase() === 'nan' ? '' : s;
      };
      const area =
        limpiar(row.area_servicio) ||
        limpiar(row.area_investigacion) ||
        limpiar(row['dependencia__nombre']);
      const base: Prisma.PropuestaUncheckedUpdateInput = {
        // En Investigación el título es el PROYECTO; en Servicio no hay proyecto
        // y el nombre que se muestra es el ÁREA.
        titulo: limpiar(row.proyecto) || area || '',
        tipo,
        responsableNombre: limpiar(row.responsable_ayn) || '',
        responsableEmail: limpiar(row.responsable_email) || '',
        vacantesTotal: Number(row.cantidad_becarios) || 1,
        vacantesDisponibles: Number(row.cantidad_becarios) || 1,
        modulos: Number(row.cantidad_modulos) || 1,
        // `dependencia` guarda el ÁREA (columna `area_servicio`/`area_investigacion`),
        // separada del `titulo` que en investigación es el PROYECTO. El reporte de
        // asignación los muestra en columnas distintas ("Nombre Área"/"Nombre Proyecto").
        dependencia: area || null,
        especialidades: limpiar(row.especialidad) || null,
        periodo: limpiar(row.periodo) || null,
        horario: limpiar(row.horario) || null,
        objetivo: limpiar(row.objetivo) || null,
        tareas: limpiar(row.tareas) || null,
        observaciones: limpiar(row.observaciones) || null,
        // El archivo de solicitudes escribe el requisito con el typo `ragularizadas`.
        reqRegularizadas:
          limpiar(row.ragularizadas) || limpiar(row.regularizadas) || null,
        reqAprobadas: limpiar(row.aprobadas) || null,
        reqOtros: limpiar(row.otros) || null,
        estado: EstadoPropuesta.PUBLICADA,
        convocatoriaId,
      };
      const existing = await this.prisma.propuesta.findUnique({
        where: { idExterno },
      });
      if (existing) {
        await this.prisma.propuesta.update({
          where: { id: existing.id },
          data: base,
        });
      } else {
        await this.prisma.propuesta.create({
          data: { idExterno, ...base } as Prisma.PropuestaUncheckedCreateInput,
        });
      }
      importadas++;
    }
    return { importadas };
  }
}
