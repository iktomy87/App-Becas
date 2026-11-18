import { Module } from '@nestjs/common';
import { ImportacionController } from './importacion.controller';
import { ImportacionService } from './importacion.service';
import { ImportacionProcessor } from './importacion.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { PadronModule } from '../padron/padron.module';
import { RankingModule } from '../ranking/ranking.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    StorageModule,
    PadronModule,
    RankingModule,
  ],
  providers: [ImportacionService, ImportacionProcessor],
  controllers: [ImportacionController],
})
export class ImportacionModule {}
