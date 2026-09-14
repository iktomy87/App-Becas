import { Controller, Post, Get, Param, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ImportacionService } from './importacion.service';

@ApiTags('Importación de Planillas')
@Controller('convocatorias/:convocatoriaId/planillas')
export class ImportacionController {
  constructor(private readonly service: ImportacionService) {}

  @Post()
  @ApiOperation({ summary: 'Cargar planilla de inscripciones (.xlsx) y verificar contra el padrón (RF-06, RF-07)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/planillas',
      filename: (_req, file, cb) => cb(null, `planilla_${Date.now()}${extname(file.originalname)}`),
    }),
  }))
  cargar(
    @Param('convocatoriaId') convocatoriaId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.cargarPlanilla(convocatoriaId, file);
  }

  @Get()
  @ApiOperation({ summary: 'Listar cargas de planilla de la convocatoria' })
  listar(@Param('convocatoriaId') convocatoriaId: string) {
    return this.service.listarCargas(convocatoriaId);
  }

  @Get('inscripciones')
  @ApiOperation({ summary: 'Obtener inscripciones de la convocatoria' })
  getInscripciones(@Param('convocatoriaId') convocatoriaId: string) {
    return this.service.getInscripciones(convocatoriaId);
  }

  @Get(':cargaId')
  @ApiOperation({ summary: 'Consultar estado y resultado de una carga (RF-09)' })
  getCarga(@Param('cargaId') cargaId: string) {
    return this.service.getCarga(cargaId);
  }
}
