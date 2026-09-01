import { Module } from '@nestjs/common';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';
import { RankingV1Strategy } from './strategies/ranking-v1.strategy';

@Module({
  controllers: [RankingController],
  providers: [RankingService, RankingV1Strategy],
  exports: [RankingService],
})
export class RankingModule {}
