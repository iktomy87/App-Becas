import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ImportacionService } from './importacion.service';
import { ImportacionProcessor } from './importacion.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { PadronService } from '../padron/padron.service';
import { RankingService } from '../ranking/ranking.service';
import { RankingV1Strategy } from '../ranking/strategies/ranking-v1.strategy';
import { IMPORTACION_QUEUE } from './importacion.constants';

// Igual que ImportacionModule, pero sin ImportacionController: este módulo
// se levanta en un PROCESO APARTE (worker-main.ts) que nunca sirve HTTP.
@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: IMPORTACION_QUEUE,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 3600 },
        removeOnFail: false,
      },
    }),
  ],
  providers: [
    ImportacionService,
    ImportacionProcessor,
    PadronService,
    RankingService,
    RankingV1Strategy,
  ],
})
export class ImportacionWorkerModule {}
