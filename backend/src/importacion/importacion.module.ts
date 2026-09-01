import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ImportacionController } from './importacion.controller';
import { ImportacionService } from './importacion.service';
import { PadronModule } from '../padron/padron.module';

@Module({
  imports: [
    MulterModule.register({ dest: './uploads/planillas' }),
    PadronModule,
  ],
  controllers: [ImportacionController],
  providers: [ImportacionService],
  exports: [ImportacionService],
})
export class ImportacionModule {}
