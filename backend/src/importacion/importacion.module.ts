import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ImportacionController } from './importacion.controller';
import { ImportacionService } from './importacion.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PadronService } from '../padron/padron.service';
import { IMPORTACION_QUEUE } from './importacion.constants';

// Proceso API. Encola jobs de carga (InjectQueue) y además expone las
// lecturas (listar cargas, ver padrón/inscripciones) que no requieren
// procesar ningún archivo — esas se resuelven al toque contra la DB, no
// tienen que pasar por el worker.
@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: IMPORTACION_QUEUE }),
  ],
  providers: [ImportacionService, PadronService],
  controllers: [ImportacionController],
})
export class ImportacionModule {}
