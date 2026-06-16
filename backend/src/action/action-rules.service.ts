import { Injectable } from '@nestjs/common';
import { RegionStatus, SpotStatus } from '@atlas/shared';
import type { Action, Region, Spot } from '@atlas/shared';
import { ConfigRepository } from '../store/config.repository';
import { StateRepository } from '../store/state.repository';

export interface ActionAvailability {
  available: boolean;
  cooldownRemaining: number;
}

/**
 * Action 可执行性与 Spot 解锁判定（B1.6 / B2.3 共用）。
 * 集中规则，避免散落在各 Controller。
 */
@Injectable()
export class ActionRulesService {
  constructor(
    private readonly config: ConfigRepository,
    private readonly state: StateRepository,
  ) {}

  isRegionOpen(region: Region | undefined): boolean {
    return !!region && region.status === RegionStatus.Open;
  }

  /**
   * Spot 是否对用户解锁：
   * - 配置 open：开放。
   * - 配置 locked：需满足 unlockCondition（当前支持 requireCheckInCount）。
   * - hidden：不可见 => 未解锁。
   */
  isSpotUnlocked(userId: string, spot: Spot): boolean {
    if (spot.status === SpotStatus.Open) return true;
    if (spot.status === SpotStatus.Hidden) return false;
    // locked：按解锁条件判定
    const need = spot.unlockCondition?.requireCheckInCount;
    if (typeof need === 'number') {
      const count = this.state.listSpotProgress(userId).filter((p) => p.visitCount > 0).length;
      return count >= need;
    }
    return false;
  }

  /** 计算剩余冷却秒数（0 表示无冷却或已就绪） */
  cooldownRemaining(userId: string, action: Action): number {
    if (!action.cooldown) return 0;
    const last = this.state.actionLastExecAt.get(StateRepository.key(userId, action.id));
    if (!last) return 0;
    const elapsed = (Date.now() - last) / 1000;
    const remaining = Math.ceil(action.cooldown - elapsed);
    return remaining > 0 ? remaining : 0;
  }

  /** Action 前置解锁条件（当前支持 requireActionId：需先执行过某动作） */
  meetsUnlockCondition(userId: string, action: Action): boolean {
    const requireActionId = action.unlockCondition?.requireActionId;
    if (typeof requireActionId === 'string') {
      return this.state.actionRecords.some(
        (r) => r.userId === userId && r.actionId === requireActionId,
      );
    }
    return true;
  }

  evaluate(userId: string, spot: Spot, action: Action): ActionAvailability {
    const cooldownRemaining = this.cooldownRemaining(userId, action);
    const available =
      this.isSpotUnlocked(userId, spot) &&
      this.meetsUnlockCondition(userId, action) &&
      cooldownRemaining === 0;
    return { available, cooldownRemaining };
  }
}
