import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
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
  @ApiConsumes('application/json')
  async cargar(
    @Param('convocatoriaId') convocatoriaId: string,
    @Body() body: { path: string; originalname: string },
  ) {
    if (!body?.path || !body?.originalname) {
      throw new BadRequestException('Faltan path u originalname del archivo');
    }
    this.storageService.assertPath(body.path, `padrones/${convocatoriaId}`);

    const job = await this.queueService.enqueue(PADRON_QUEUE, 'cargar-padron', {
      convocatoriaId,
      filePath: body.path,
      originalname: body.originalname,
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
