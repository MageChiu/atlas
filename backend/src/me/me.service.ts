import { Injectable } from '@nestjs/common';
import type {
  Achievement,
  AchievementsData,
  CollectionEntry,
  CollectionsData,
  GeneratedAssetsData,
} from '@atlas/shared';
import { ConfigRepository } from '../store/config.repository';
import { StateRepository } from '../store/state.repository';

/**
 * B4 - 用户资产服务。
 * 图鉴/收藏：全量奖励 + 用户获得状态；生成记录：user_generated_assets；成就：简版。
 */
@Injectable()
export class MeService {
  constructor(
    private readonly config: ConfigRepository,
    private readonly state: StateRepository,
  ) {}

  /** B4.1 图鉴/收藏 */
  getCollections(userId: string): CollectionsData {
    const userRewards = this.state.listUserRewards(userId);
    const obtainedMap = new Map(userRewards.map((r) => [r.rewardId, r.grantedAt]));
    const collections: CollectionEntry[] = this.config.listRewards().map((reward) => {
      const obtainedAt = obtainedMap.get(reward.id);
      return { reward, obtained: !!obtainedAt, obtainedAt };
    });
    return { collections };
  }

  /** B4.2 生成记录 */
  getGeneratedAssets(userId: string): GeneratedAssetsData {
    return { assets: this.state.listGeneratedAssets(userId) };
  }

  /** B4.3 成就（简版：基于打卡/收藏数派生） */
  getAchievements(userId: string): AchievementsData {
    const checkinCount = this.state
      .listSpotProgress(userId)
      .filter((p) => p.visitCount > 0).length;
    const rewardCount = this.state.listUserRewards(userId).length;

    const achievements: Achievement[] = [
      {
        id: 'ach_first_checkin',
        name: '初次启程',
        description: '完成首次景点打卡',
        unlocked: checkinCount >= 1,
      },
      {
        id: 'ach_explorer',
        name: '京都漫游者',
        description: '打卡 3 个景点',
        unlocked: checkinCount >= 3,
      },
      {
        id: 'ach_collector',
        name: '收藏家',
        description: '获得 3 个奖励',
        unlocked: rewardCount >= 3,
      },
    ];
    return { achievements };
  }
}
