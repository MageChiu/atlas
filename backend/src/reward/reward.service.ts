import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { Reward, UserReward } from '@atlas/shared';
import { ConfigRepository } from '../store/config.repository';
import { StateRepository } from '../store/state.repository';

/**
 * B2.5 - 奖励模块：发放奖励，去重保证不重复，记录 sourceType/sourceId 可追踪。
 */
@Injectable()
export class RewardService {
  constructor(
    private readonly config: ConfigRepository,
    private readonly state: StateRepository,
  ) {}

  /**
   * 发放一组奖励。对 grantRule.once 的奖励，用户已持有则跳过（去重）。
   * 返回本次实际新发放的奖励配置列表。
   */
  grant(
    userId: string,
    rewardIds: string[],
    sourceType: string,
    sourceId: string,
  ): Reward[] {
    const granted: Reward[] = [];
    const now = new Date().toISOString();

    for (const rewardId of rewardIds) {
      const reward = this.config.getReward(rewardId);
      if (!reward) continue;

      const once = reward.grantRule?.once === true;
      if (once && this.state.hasReward(userId, rewardId)) continue;

      const record: UserReward = {
        id: uuid(),
        userId,
        rewardId,
        sourceType,
        sourceId,
        grantedAt: now,
      };
      this.state.userRewards.push(record);
      granted.push(reward);
    }
    return granted;
  }
}
