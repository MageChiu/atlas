import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ActionWithState,
  RegionDetailData,
  SpotActionsData,
  SpotDetailData,
  WorldData,
} from '@atlas/shared';
import { ConfigRepository } from '../store/config.repository';
import { ProgressService } from '../progress/progress.service';
import { ActionRulesService } from '../action/action-rules.service';

/**
 * B1.3~B1.6 - 内容查询服务。
 * 输出配置数据 + 用户态（进度 / Action 可执行状态）。
 */
@Injectable()
export class ContentService {
  constructor(
    private readonly config: ConfigRepository,
    private readonly progress: ProgressService,
    private readonly rules: ActionRulesService,
  ) {}

  /** B1.3 GET /api/world：区域图 DAG 根集合 + 用户区域进度 */
  getWorld(userId: string): WorldData {
    const regions = this.config.listWorldRootRegions();
    const regionProgress = regions.map((r) => this.progress.getRegionProgress(userId, r.id));
    return { regions, regionProgress };
  }

  /** B1.4 GET /api/regions/{id}：region + 子区域 + 景点 + 用户进度（DAG 下钻） */
  getRegionDetail(userId: string, regionId: string): RegionDetailData {
    const region = this.config.getRegion(regionId);
    if (!region) throw new NotFoundException('Region not found');
    return {
      region,
      childRegions: this.config.listChildRegions(regionId),
      spots: this.config.listChildSpots(regionId),
      progress: this.progress.getRegionProgress(userId, regionId),
    };
  }

  /** B1.5 GET /api/spots/{id}：spot + actions + 用户状态 */
  getSpotDetail(userId: string, spotId: string): SpotDetailData {
    const spot = this.config.getSpot(spotId);
    if (!spot) throw new NotFoundException('Spot not found');
    return {
      spot,
      actions: this.config.listActionsBySpot(spotId),
      progress: this.progress.getSpotProgress(userId, spotId),
    };
  }

  /** B1.6 GET /api/spots/{id}/actions：可执行 Action（含冷却/解锁状态） */
  getSpotActions(userId: string, spotId: string): SpotActionsData {
    const spot = this.config.getSpot(spotId);
    if (!spot) throw new NotFoundException('Spot not found');
    const actions: ActionWithState[] = this.config.listActionsBySpot(spotId).map((action) => {
      const { available, cooldownRemaining } = this.rules.evaluate(userId, spot, action);
      return { ...action, available, cooldownRemaining };
    });
    return { actions };
  }
}
