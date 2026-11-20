import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { tmpdir } from 'os';
import { existsSync, unlinkSync } from 'fs';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PADRON_QUEUE, JobCargarPadron } from './padron.processor';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';

@ApiTags('Padrón')
@Controller('convocatorias/:convocatoriaId/padron')
export class PadronController {
  constructor(
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
  ) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'URL firmada para subir el Excel del padrón' })
  @ApiConsumes('application/json')
  crearUrlSubida(
    @Param('convocatoriaId') convocatoriaId: string,
    @Body() body: { filename: string },
  ) {
    if (!body?.filename)
      throw new BadRequestException('Falta el nombre del archivo');
    return this.storageService.createSignedUploadUrl(
      `padrones/${convocatoriaId}`,
      body.filename,
    );
  }

  @Post()
  @ApiOperation({
    summary:
      'Cargar maestro.xlsx como padrón académico de la convocatoria (procesado en background)',
  })
  @ApiConsumes('multipart/form-data')
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
  async cargar(
    @Param('convocatoriaId') convocatoriaId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo');

    const path = this.storageService.createObjectPath(
      `padrones/${convocatoriaId}`,
      file.originalname,
    );
    try {
      await this.storageService.uploadFile(path, file.path);
    } finally {
      if (existsSync(file.path)) unlinkSync(file.path);
    }

    const job = await this.queueService.enqueue(PADRON_QUEUE, 'cargar-padron', {
      convocatoriaId,
      filePath: path,
      originalname: file.originalname,
    } satisfies JobCargarPadron);

    return {
      jobId: job.id,
      mensaje: 'Padrón en proceso. Verificá el estado con el jobId.',
    };
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Estado del job de carga de padrón' })
  async getStatus(@Param('jobId') jobId: string) {
    const status = await this.queueService.status(jobId);
    if (!status) throw new NotFoundException('Job no encontrado');
    return status;
  }
}
