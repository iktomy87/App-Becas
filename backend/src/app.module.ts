import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { ConvocatoriasModule } from './convocatorias/convocatorias.module';
import { PropuestasModule } from './propuestas/propuestas.module';
import { PadronModule } from './padron/padron.module';
import { ImportacionModule } from './importacion/importacion.module';
import { RankingModule } from './ranking/ranking.module';
import { AsignacionModule } from './asignacion/asignacion.module';
import { ConvocatoriaFacadeModule } from './convocatoria-facade/convocatoria-facade.module';
import { ReportesModule } from './reportes/reportes.module';
import { EspecialidadesModule } from './especialidades/especialidades.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    QueueModule,
    StorageModule,
    ConvocatoriasModule,
    PropuestasModule,
    PadronModule,
    ImportacionModule,
    RankingModule,
    AsignacionModule,
    ConvocatoriaFacadeModule,
    ReportesModule,
    EspecialidadesModule,
  ],
})
export class AppModule {}
