import { Module } from '@nestjs/common';
import { PadronService } from './padron.service';
import { PadronProcessor } from './padron.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, QueueModule, StorageModule],
  providers: [PadronService, PadronProcessor],
})
export class PadronWorkerModule {}
