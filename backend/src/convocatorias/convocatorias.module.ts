import { Module } from '@nestjs/common';
import { ConvocatoriasController } from './convocatorias.controller';
import { ConvocatoriasService } from './convocatorias.service';

@Module({
  controllers: [ConvocatoriasController],
  providers: [ConvocatoriasService],
  exports: [ConvocatoriasService],
})
export class ConvocatoriasModule {}
