import { Module } from '@nestjs/common';
import { ConvocatoriaFacadeController } from './convocatoria-facade.controller';
import { ConvocatoriaFacadeService } from './convocatoria-facade.service';
import { ConvocatoriasModule } from '../convocatorias/convocatorias.module';
import { RankingModule } from '../ranking/ranking.module';
import { AsignacionModule } from '../asignacion/asignacion.module';

@Module({
  imports: [ConvocatoriasModule, RankingModule, AsignacionModule],
  controllers: [ConvocatoriaFacadeController],
  providers: [ConvocatoriaFacadeService],
})
export class ConvocatoriaFacadeModule {}
