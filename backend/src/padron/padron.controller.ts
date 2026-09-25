import { Controller, Post, Get, Param, UploadedFile, UseInterceptors, BadRequestException, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { PADRON_QUEUE, JobCargarPadron } from './padron.processor';

@ApiTags('Padrón')
@Controller('convocatorias/:convocatoriaId/padron')
export class PadronController {
  constructor(
    @InjectQueue(PADRON_QUEUE) private readonly padronQueue: Queue<JobCargarPadron>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cargar maestro.xlsx como padrón académico de la convocatoria (procesado en background)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: '/tmp/uploads',
      filename: (_req, file, cb) => cb(null, `padron_${Date.now()}${extname(file.originalname)}`),
    }),
  }))
  async cargar(
    @Param('convocatoriaId') convocatoriaId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo');

    const job = await this.padronQueue.add('cargar-padron', {
      convocatoriaId,
      filePath: file.path,
      originalname: file.originalname,
    });

    return { jobId: job.id, mensaje: 'Padrón en proceso. Verificá el estado con el jobId.' };
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Estado del job de carga de padrón' })
  async getStatus(@Param('jobId') jobId: string) {
    const job = await this.padronQueue.getJob(jobId);
    if (!job) throw new NotFoundException('Job no encontrado');

    const state = await job.getState();
    return {
      state,
      progress: job.progress,
      resultado: state === 'completed' ? job.returnvalue : undefined,
      error: state === 'failed' ? job.failedReason : undefined,
    };
  }
}
