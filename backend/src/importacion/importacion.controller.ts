import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { tmpdir } from 'os';
import { existsSync, unlinkSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { ImportacionService } from './importacion.service';
import { IMPORTACION_QUEUE } from './importacion.constants';
import { JobCargarPlanilla } from './importacion.processor';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';

@Controller('convocatorias/:convocatoriaId')
export class ImportacionController {
  constructor(
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly importacionService: ImportacionService,
  ) {}

  @Post('planillas/upload-url')
  async crearUrlSubida(
    @Param('convocatoriaId') convocatoriaId: string,
    @Body() body: { filename: string },
  ) {
    await this.validarConvocatoriaExiste(convocatoriaId);
    if (!body?.filename)
      throw new BadRequestException('Falta el nombre del archivo');
    return this.storageService.createSignedUploadUrl(
      `planillas/${convocatoriaId}`,
      body.filename,
    );
  }

  @Post(['planilla', 'planillas'])
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, file, cb) =>
          cb(
            null,
            `${Date.now()}-${Math.random().toString(36).slice(2)}${extname(file.originalname)}`,
          ),
      }),
    }),
  )
  async subirPlanilla(
    @Param('convocatoriaId') convocatoriaId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.validarConvocatoriaExiste(convocatoriaId);
    if (!file) throw new BadRequestException('Falta el archivo');

    const path = this.storageService.createObjectPath(
      `planillas/${convocatoriaId}`,
      file.originalname,
    );
    try {
      await this.storageService.uploadFile(path, file.path);
    } finally {
      if (existsSync(file.path)) unlinkSync(file.path);
    }

    const job = await this.queueService.enqueue(
      IMPORTACION_QUEUE,
      'cargar-planilla',
      {
        convocatoriaId,
        filePath: path,
        originalname: file.originalname,
      } satisfies JobCargarPlanilla,
    );

    return { jobId: job.id };
  }

  @Get('planilla/status/:jobId')
  async getStatus(@Param('jobId') jobId: string) {
    const status = await this.queueService.status(jobId);
    if (!status) throw new NotFoundException('Job no encontrado');
    return status;
  }

  @Get('planillas')
  listarPlanillas(@Param('convocatoriaId') convocatoriaId: string) {
    return this.importacionService.listarCargas(convocatoriaId);
  }

  @Get('planillas/inscripciones')
  getInscripciones(
    @Param('convocatoriaId') convocatoriaId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('q') q?: string,
    @Query('carrera') carrera?: string,
  ) {
    return this.importacionService.getInscripciones(
      convocatoriaId,
      +page,
      +limit,
      q,
      carrera,
    );
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

  private async validarConvocatoriaExiste(
    convocatoriaId: string,
  ): Promise<void> {
    const conv = await this.prisma.convocatoria.findUnique({
      where: { id: convocatoriaId },
    });
    if (!conv) throw new NotFoundException('Convocatoria no encontrada');
  }
}
