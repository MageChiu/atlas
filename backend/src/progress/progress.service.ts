import { Injectable } from '@nestjs/common';
import type { UserRegionProgress, UserSpotProgress } from '@atlas/shared';
import { ConfigRepository } from '../store/config.repository';
import { StateRepository } from '../store/state.repository';

/**
 * B2.6 - 进度模块：维护用户景点/区域进度。
 * 更新顺序可控：先更新 spot 进度，再据此重算所在 region 探索度。
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly config: ConfigRepository,
    private readonly state: StateRepository,
  ) {}

  getSpotProgress(userId: string, spotId: string): UserSpotProgress {
    return (
      this.state.getSpotProgress(userId, spotId) ?? {
        userId,
        spotId,
        unlocked: false,
        visitCount: 0,
        actionCount: 0,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  getRegionProgress(userId: string, regionId: string): UserRegionProgress {
    return (
      this.state.getRegionProgress(userId, regionId) ?? {
        userId,
        regionId,
        unlocked: true,
        exploredSpotCount: 0,
        completionRate: 0,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  /** 记录一次访问（首访时间 + 访问计数 + 解锁），返回更新后的进度 */
  markVisited(userId: string, spotId: string): UserSpotProgress {
    const now = new Date().toISOString();
    const prev = this.getSpotProgress(userId, spotId);
    const next: UserSpotProgress = {
      ...prev,
      unlocked: true,
      firstVisitedAt: prev.firstVisitedAt ?? now,
      visitCount: prev.visitCount + 1,
      updatedAt: now,
    };
    this.state.upsertSpotProgress(next);
    this.recomputeRegion(userId, spotId);
    return next;
  }

  /** 累加一次动作计数，返回更新后的进度 */
  incrementActionCount(userId: string, spotId: string): UserSpotProgress {
    const now = new Date().toISOString();
    const prev = this.getSpotProgress(userId, spotId);
    const next: UserSpotProgress = {
      ...prev,
      unlocked: true,
      actionCount: prev.actionCount + 1,
      updatedAt: now,
    };
    this.state.upsertSpotProgress(next);
    return next;
  }

  /** 据 spot 进度重算 region 探索完成度 */
  private recomputeRegion(userId: string, spotId: string): void {
    const spot = this.config.getSpot(spotId);
    if (!spot) return;
    const regionSpots = this.config.listSpotsByRegion(spot.regionId);
    const explored = regionSpots.filter((s) => {
      const p = this.state.getSpotProgress(userId, s.id);
      return p ? p.visitCount > 0 : false;
    }).length;
    const total = regionSpots.length || 1;
    this.state.upsertRegionProgress({
      userId,
      regionId: spot.regionId,
      unlocked: true,
      exploredSpotCount: explored,
      completionRate: Number((explored / total).toFixed(4)),
      updatedAt: new Date().toISOString(),
    });
  }
}
