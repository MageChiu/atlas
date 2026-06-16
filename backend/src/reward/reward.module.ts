import { Global, Module } from '@nestjs/common';
import { RewardService } from './reward.service';

@Global()
@Module({
  providers: [RewardService],
  exports: [RewardService],
})
export class RewardModule {}
