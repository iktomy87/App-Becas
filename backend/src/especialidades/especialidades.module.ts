import { Module } from '@nestjs/common';
import { EspecialidadesController } from './especialidades.controller';

@Module({
  controllers: [EspecialidadesController],
})
export class EspecialidadesModule {}
