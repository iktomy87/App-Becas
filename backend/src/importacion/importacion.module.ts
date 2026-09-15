import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ImportacionController } from './importacion.controller';
import { ImportacionService } from './importacion.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PadronModule } from '../padron/padron.module';
import { IMPORTACION_QUEUE } from './importacion.constants';

// Proceso API. Encola jobs de carga (InjectQueue) y además expone las
// lecturas (listar cargas, ver padrón/inscripciones) que no requieren
// procesar ningún archivo — esas se resuelven al toque contra la DB, no
// tienen que pasar por el worker.
@Module({
  imports: [
    PrismaModule,
    PadronModule, // lo necesita ImportacionService (padronService inyectado)
    BullModule.registerQueue({ name: IMPORTACION_QUEUE }),
  ],
  providers: [ImportacionService],
  controllers: [ImportacionController],
})
export class ImportacionModule {}