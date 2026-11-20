import { Module } from '@nestjs/common';
import { AsignacionController } from './asignacion.controller';
import { AsignacionEngineService } from './asignacion-engine.service';
import { AsignacionProcessor } from './asignacion.processor';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [AsignacionController],
  providers: [AsignacionEngineService, AsignacionProcessor],
  exports: [AsignacionEngineService],
})
export class AsignacionModule {}
