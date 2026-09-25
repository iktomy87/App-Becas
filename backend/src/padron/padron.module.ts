import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PadronController } from './padron.controller';
import { PadronService } from './padron.service';
import { PadronProcessor } from './padron.processor';
import { PADRON_QUEUE } from './padron.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: PADRON_QUEUE }),
  ],
  controllers: [PadronController],
  providers: [PadronService, PadronProcessor],
  exports: [PadronService],
})
export class PadronModule {}
