import { Controller, Post, Param, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PadronService } from './padron.service';

@ApiTags('Padrón')
@Controller('convocatorias/:convocatoriaId/padron')
export class PadronController {
  constructor(private readonly service: PadronService) {}

  @Post()
  @ApiOperation({ summary: 'Cargar maestro.xlsx como padrón académico de la convocatoria' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/padron',
      filename: (_req, file, cb) => cb(null, `padron_${Date.now()}${extname(file.originalname)}`),
    }),
  }))
  async cargar(
    @Param('convocatoriaId') convocatoriaId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.service.cargarMaestro(file.path, convocatoriaId);
    return { mensaje: 'Padrón cargado exitosamente', ...result };
  }
}
