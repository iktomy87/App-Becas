import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PadronService } from './padron.service';
import { PadronProcessor, PADRON_QUEUE } from './padron.processor';
import { PrismaModule } from '../prisma/prisma.module';

// Módulo del padrón para el proceso worker (sin controller HTTP).
@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: PADRON_QUEUE,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 3600 },
        removeOnFail: false,
      },
    }),
  ],
  providers: [PadronService, PadronProcessor],
})
export class PadronWorkerModule {}
