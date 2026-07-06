import { Injectable } from '@nestjs/common';
import { RegionChildType, RegionStatus, RegionType, seedDataset } from '@atlas/shared';
import type {
  Action,
  AITemplate,
  EventPool,
  GameEvent,
  Region,
  Reward,
  Spot,
} from '@atlas/shared';

/**
 * B1 - 配置仓储（内存实现）。
 * 单一事实来源为 @atlas/shared 的 seedDataset（与前端 Mock 同源）。
 * 仅读，不随用户态变化；后续可替换为 Postgres 读模型。
 */
@Injectable()
export class ConfigRepository {
  private readonly regions = new Map<string, Region>();
  private readonly spots = new Map<string, Spot>();
  private readonly actions = new Map<string, Action>();
  private readonly eventPools = new Map<string, EventPool>();
  private readonly events = new Map<string, GameEvent>();
  private readonly rewards = new Map<string, Reward>();
  private readonly aiTemplates = new Map<string, AITemplate>();

  private readonly worldRootRegionIds: string[] = [];

  constructor() {
    for (const r of seedDataset.regions) this.regions.set(r.id, r);
    for (const s of seedDataset.spots) this.spots.set(s.id, s);
    for (const a of seedDataset.actions) this.actions.set(a.id, a);
    for (const p of seedDataset.eventPools) this.eventPools.set(p.id, p);
    for (const e of seedDataset.events) this.events.set(e.id, e);
    for (const rw of seedDataset.rewards) this.rewards.set(rw.id, rw);
    for (const t of seedDataset.aiTemplates) this.aiTemplates.set(t.id, t);
    this.worldRootRegionIds = [...(seedDataset.worldRootRegionIds ?? [])];
  }

  listRegions(): Region[] {
    return [...this.regions.values()];
  }
  getRegion(id: string): Region | undefined {
    return this.regions.get(id);
  }

  /**
   * 区域图 DAG 的根集合：World 入口直接展示的顶层区域。
   * 依据 seedDataset.worldRootRegionIds 保序解析，过滤 hidden / 解析不到的。
   */
  listWorldRootRegions(): Region[] {
    return this.worldRootRegionIds
      .map((id) => this.regions.get(id))
      .filter((r): r is Region => !!r && r.status !== RegionStatus.Hidden);
  }

  /**
   * 父区域直接包含的子区域（children 边中 refType==='region'）。
   * 按 orderIndex 排序，过滤 hidden / 解析不到的。
   */
  listChildRegions(regionId: string): Region[] {
    const region = this.regions.get(regionId);
    if (!region?.children) return [];
    return region.children
      .filter((c) => c.refType === RegionChildType.Region)
      .slice()
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((c) => this.regions.get(c.refId))
      .filter((r): r is Region => !!r && r.status !== RegionStatus.Hidden);
  }

  /**
   * 父区域直接包含的景点（children 边中 refType==='spot'，含跨区域多父挂载）。
   * 按 orderIndex 排序，跳过解析不到的。
   * 兼容回退：region 无 children 时退回 spot.regionId === regionId 过滤逻辑。
   */
  listChildSpots(regionId: string): Spot[] {
    const region = this.regions.get(regionId);
    if (!region?.children) return this.spotsByRegionId(regionId);
    return region.children
      .filter((c) => c.refType === RegionChildType.Spot)
      .slice()
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((c) => this.spots.get(c.refId))
      .filter((s): s is Spot => !!s);
  }

  /** @deprecated 展示挂载请用 listChildSpots（走 children 边）；保留以兼容旧调用 */
  listSpotsByRegion(regionId: string): Spot[] {
    return this.listChildSpots(regionId);
  }

  /** 旧逻辑：按主归属 regionId 过滤（仅作 children 缺失时的兜底） */
  private spotsByRegionId(regionId: string): Spot[] {
    return [...this.spots.values()]
      .filter((s) => s.regionId === regionId)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }
  getSpot(id: string): Spot | undefined {
    return this.spots.get(id);
  }

  /**
   * 反查景点所属的城市 region id（用于 LLM 路由上下文）。
   * 从景点主归属 regionId 沿 children 边逆向上溯，取最近的 City 类型祖先（含自身）。
   * 找不到则返回 undefined（如世界遗产路线等非行政分组下未挂城市的景点）。
   */
  getCityIdForSpot(spotId: string): string | undefined {
    const spot = this.spots.get(spotId);
    if (!spot) return undefined;
    return this.findCityAncestor(spot.regionId, new Set());
  }

  private findCityAncestor(regionId: string, visited: Set<string>): string | undefined {
    if (visited.has(regionId)) return undefined;
    visited.add(regionId);
    const region = this.regions.get(regionId);
    if (!region) return undefined;
    if (region.type === RegionType.City) return region.id;
    for (const parentId of this.parentRegionIds(regionId)) {
      const found = this.findCityAncestor(parentId, visited);
      if (found) return found;
    }
    return undefined;
  }

  /** 声明了 regionId 为子 Region 的父区域集合（children 边逆向） */
  private parentRegionIds(regionId: string): string[] {
    const parents: string[] = [];
    for (const r of this.regions.values()) {
      const hit = r.children?.some(
        (c) => c.refType === RegionChildType.Region && c.refId === regionId,
      );
      if (hit) parents.push(r.id);
    }
    return parents;
  }

  listActionsBySpot(spotId: string): Action[] {
    return [...this.actions.values()]
      .filter((a) => a.spotId === spotId)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }
  getAction(id: string): Action | undefined {
    return this.actions.get(id);
  }

  getEventPool(id: string): EventPool | undefined {
    return this.eventPools.get(id);
  }
  getEvent(id: string): GameEvent | undefined {
    return this.events.get(id);
  }

  getReward(id: string): Reward | undefined {
    return this.rewards.get(id);
  }
  listRewards(): Reward[] {
    return [...this.rewards.values()];
  }

  getAiTemplate(id: string): AITemplate | undefined {
    return this.aiTemplates.get(id);
  }
}
