import { Module } from '@nestjs/common';
import { ImportacionService } from './importacion.service';
import { ImportacionProcessor } from './importacion.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { RankingModule } from '../ranking/ranking.module';
import { PadronService } from '../padron/padron.service';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, QueueModule, StorageModule, RankingModule],
  providers: [ImportacionService, ImportacionProcessor, PadronService],
})
export class ImportacionWorkerModule {}
