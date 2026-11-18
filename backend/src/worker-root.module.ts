import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { ImportacionWorkerModule } from './importacion/importacion-worker.module';
import { PadronWorkerModule } from './padron/padron-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    StorageModule,
    ImportacionWorkerModule,
    PadronWorkerModule,
  ],
})
export class WorkerRootModule {}
