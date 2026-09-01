import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoConvocatoria } from '@prisma/client';
import { CreateConvocatoriaDto, UpdateConvocatoriaDto, CreateRankingConfigDto } from './dto/convocatoria.dto';

@Injectable()
export class ConvocatoriasService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.convocatoria.findMany({
      orderBy: { createdAt: 'desc' },
      include: { rankingConfig: true, _count: { select: { propuestas: true, cargas: true } } },
    });
  }

  async findOne(id: string) {
    const conv = await this.prisma.convocatoria.findUnique({
      where: { id },
      include: { rankingConfig: true },
    });
    if (!conv) throw new NotFoundException(`Convocatoria ${id} no encontrada`);
    return conv;
  }

  create(dto: CreateConvocatoriaDto) {
    return this.prisma.convocatoria.create({
      data: {
        nombre: dto.nombre,
        fechaApertura: new Date(dto.fechaApertura),
        fechaCierre: new Date(dto.fechaCierre),
      },
    });
  }

  async update(id: string, dto: UpdateConvocatoriaDto) {
    await this.findOne(id);
    return this.prisma.convocatoria.update({
      where: { id },
      data: {
        ...(dto.nombre && { nombre: dto.nombre }),
        ...(dto.fechaApertura && { fechaApertura: new Date(dto.fechaApertura) }),
        ...(dto.fechaCierre && { fechaCierre: new Date(dto.fechaCierre) }),
      },
    });
  }

  async cerrar(id: string) {
    const conv = await this.findOne(id);
    if (conv.estado !== EstadoConvocatoria.ABIERTA) {
      throw new ConflictException(`La convocatoria no está en estado ABIERTA (actual: ${conv.estado})`);
    }
    return this.prisma.convocatoria.update({
      where: { id },
      data: { estado: EstadoConvocatoria.CERRADA },
    });
  }

  async upsertRankingConfig(id: string, dto: CreateRankingConfigDto) {
    await this.findOne(id);
    return this.prisma.rankingConfig.upsert({
      where: { convocatoriaId: id },
      create: {
        convocatoriaId: id,
        minMateriasCursando: dto.minMateriasCursando ?? 3,
        minRegularizadas: dto.minRegularizadas ?? 1,
        criterioDesempate: dto.criterioDesempate ?? 'PROMEDIO',
      },
      update: {
        ...(dto.minMateriasCursando !== undefined && { minMateriasCursando: dto.minMateriasCursando }),
        ...(dto.minRegularizadas !== undefined && { minRegularizadas: dto.minRegularizadas }),
        ...(dto.criterioDesempate && { criterioDesempate: dto.criterioDesempate }),
        version: { increment: 1 },
      },
    });
  }
}
