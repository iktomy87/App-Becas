import { Module } from '@nestjs/common';
import { AsignacionController } from './asignacion.controller';
import { AsignacionEngineService } from './asignacion-engine.service';

@Module({
  controllers: [AsignacionController],
  providers: [AsignacionEngineService],
  exports: [AsignacionEngineService],
})
export class AsignacionModule {}
