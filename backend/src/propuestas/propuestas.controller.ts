import {
  Controller, Get, Post, Put, Param, Body,
  Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as ExcelJS from 'exceljs';
import { PropuestasService } from './propuestas.service';
import { CreatePropuestaDto, UpdateVacantesDto } from './dto/propuesta.dto';

@ApiTags('Propuestas')
@Controller('propuestas')
export class PropuestasController {
  constructor(private readonly service: PropuestasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar propuestas (filtrar por convocatoria)' })
  @ApiQuery({ name: 'convocatoriaId', required: false })
  findAll(@Query('convocatoriaId') convocatoriaId?: string) {
    return this.service.findAll(convocatoriaId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una propuesta manualmente' })
  create(@Body() dto: CreatePropuestaDto) {
    return this.service.create(dto);
  }

  @Post(':id/publicar')
  @ApiOperation({ summary: 'Publicar una propuesta (RF-02)' })
  publicar(@Param('id') id: string) {
    return this.service.publicar(id);
  }

  @Put(':id/vacantes')
  @ApiOperation({ summary: 'Actualizar cupo de vacantes (RF-03, RN-02)' })
  updateVacantes(@Param('id') id: string, @Body() dto: UpdateVacantesDto) {
    return this.service.updateVacantes(id, dto);
  }

  @Post('importar-xls')
  @ApiOperation({ summary: 'Importar propuestas masivamente desde XLS de solicitudes' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/propuestas',
      filename: (_req, file, cb) => cb(null, `${Date.now()}${extname(file.originalname)}`),
    }),
  }))
  async importarXls(
    @UploadedFile() file: Express.Multer.File,
    @Query('convocatoriaId') convocatoriaId: string,
  ) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const ws = workbook.worksheets[0];
    const rows: any[] = [];
    const headers: string[] = [];
    ws.eachRow((row, idx) => {
      if (idx === 1) {
        row.eachCell((cell) => headers.push(String(cell.value ?? '').trim()));
      } else {
        const obj: any = {};
        row.eachCell((cell, colNumber) => {
          obj[headers[colNumber - 1]] = cell.value;
        });
        if (obj['numero']) rows.push(obj);
      }
    });
    return this.service.importarDesdeXls(rows, convocatoriaId);
  }
}
