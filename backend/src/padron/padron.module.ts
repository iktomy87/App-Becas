import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PadronController } from './padron.controller';
import { PadronService } from './padron.service';

@Module({
  imports: [MulterModule.register({ dest: './uploads/padron' })],
  controllers: [PadronController],
  providers: [PadronService],
  exports: [PadronService],
})
export class PadronModule {}
