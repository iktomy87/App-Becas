import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { PropuestasService } from './propuestas.service';
import { CreatePropuestaDto, UpdateVacantesDto } from './dto/propuesta.dto';

/**
 * Lee las filas del XLS de solicitudes.
 *
 * ExcelJS sólo entiende `.xlsx` (ZIP); el archivo real de solicitudes de la
 * Facultad es un `.xls` binario (BIFF), así que si la lectura falla se cae a
 * SheetJS, que lee ambos formatos. El resultado es un objeto por fila con las
 * claves de la fila de encabezados (`numero`, `area_servicio`, …).
 */
async function leerFilasSolicitudes(filePath: string): Promise<any[]> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
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
    return rows;
  } catch {
    const wb = XLSX.readFile(filePath);
    const filas: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      defval: null,
    });
    return filas.filter((f) => f && f.numero);
  }
}

@ApiTags('Propuestas')
@Controller('propuestas')
export class PropuestasController {
  constructor(private readonly service: PropuestasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar propuestas (filtrar por convocatoria)' })
  @ApiQuery({ name: 'convocatoriaId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  findAll(
    @Query('convocatoriaId') convocatoriaId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('q') q?: string,
  ) {
    return this.service.findAll(convocatoriaId, +page, +limit, q);
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
  @ApiOperation({
    summary: 'Importar propuestas masivamente desde XLS de solicitudes',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/propuestas',
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}${extname(file.originalname)}`),
      }),
    }),
  )
  async importarXls(
    @UploadedFile() file: Express.Multer.File,
    @Query('convocatoriaId') convocatoriaId: string,
  ) {
    const rows = await leerFilasSolicitudes(file.path);
    return this.service.importarDesdeXls(rows, convocatoriaId);
  }
}
