import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ImportacionService } from './importacion.service';
import { ImportacionProcessor } from './importacion.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { PadronModule } from '../padron/padron.module';
import { IMPORTACION_QUEUE } from './importacion.constants';

// Igual que ImportacionModule, pero sin ImportacionController: este módulo
// se levanta en un PROCESO APARTE (worker-main.ts) que nunca sirve HTTP,
// así que no tiene sentido cargar @nestjs/platform-express ni sus rutas ahí.
@Module({
  imports: [
    PrismaModule,
    PadronModule,
    BullModule.registerQueue({
      name: IMPORTACION_QUEUE,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 3600 },
        removeOnFail: false,
      },
    }),
  ],
  providers: [ImportacionService, ImportacionProcessor],
})
export class ImportacionWorkerModule {}
