import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AsignacionEngineService } from './asignacion-engine.service';
import { AsignacionProcessor } from './asignacion.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule, EventEmitterModule.forRoot()],
  providers: [AsignacionEngineService, AsignacionProcessor],
})
export class AsignacionWorkerModule {}
