import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueService } from './queue.service';
import { QueueWorkerService } from './queue-worker.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [QueueService, QueueWorkerService],
  exports: [QueueService],
})
export class QueueModule {}
