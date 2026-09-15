import {
  Controller, Post, Get, Param, UploadedFile, UseInterceptors,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoConvocatoria } from '@prisma/client';
import { ImportacionService } from './importacion.service';
import { IMPORTACION_QUEUE } from './importacion.constants';
import { JobCargarPlanilla } from './importacion.processor';

@Controller('convocatorias/:convocatoriaId')
export class ImportacionController {
  constructor(
    @InjectQueue(IMPORTACION_QUEUE) private readonly importacionQueue: Queue<JobCargarPlanilla>,
    private readonly prisma: PrismaService,
    private readonly importacionService: ImportacionService,
  ) {}

  @Post(['planilla', 'planillas'])
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: '/tmp/uploads',
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 3 * 1024 * 1024 * 1024 },
  }))
  async subirPlanilla(
    @Param('convocatoriaId') convocatoriaId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo');

    const conv = await this.prisma.convocatoria.findUnique({ where: { id: convocatoriaId } });
    if (!conv) throw new NotFoundException('Convocatoria no encontrada');
    if (conv.estado !== EstadoConvocatoria.ABIERTA) {
      throw new BadRequestException(`No se puede cargar planilla: la convocatoria está en estado ${conv.estado} (RN-02)`);
    }

    const job = await this.importacionQueue.add('cargar-planilla', {
      convocatoriaId,
      filePath: file.path,
      originalname: file.originalname,
    });

    return { jobId: job.id };
  }

  @Get('planilla/status/:jobId')
  async getStatus(@Param('jobId') jobId: string) {
    const job = await this.importacionQueue.getJob(jobId);
    if (!job) throw new NotFoundException('Job no encontrado');

    const state = await job.getState();
    return {
      state,
      progress: job.progress,
      resultado: state === 'completed' ? job.returnvalue : undefined,
      error: state === 'failed' ? job.failedReason : undefined,
    };
  }

  // ── Repuestos: existían en el ImportacionController original y se
  // perdieron al reescribir el controller para la cola. ──

  @Get('planillas')
  listarPlanillas(@Param('convocatoriaId') convocatoriaId: string) {
    return this.importacionService.listarCargas(convocatoriaId);
  }

  @Get('planillas/:cargaId')
  async getPlanilla(@Param('cargaId') cargaId: string) {
    const carga = await this.importacionService.getCarga(cargaId);
    if (!carga) throw new NotFoundException('Carga no encontrada');
    return carga;
  }

  @Get('padron')
  getPadron(@Param('convocatoriaId') convocatoriaId: string) {
    return this.importacionService.getInscripciones(convocatoriaId);
  }
}