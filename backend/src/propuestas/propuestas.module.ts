import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PropuestasController } from './propuestas.controller';
import { PropuestasService } from './propuestas.service';

@Module({
  imports: [MulterModule.register({ dest: './uploads/propuestas' })],
  controllers: [PropuestasController],
  providers: [PropuestasService],
  exports: [PropuestasService],
})
export class PropuestasModule {}
