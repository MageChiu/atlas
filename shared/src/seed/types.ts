/**
 * C5 - Mock / 种子数据的容器类型
 * 前端 Mock 服务与后端 seed 入库共用同一份数据集。
 */

import type {
  Action,
  AITemplate,
  EventPool,
  GameEvent,
  Region,
  Reward,
  Spot,
} from '../models/index.js';

/** 完整配置种子数据集 */
export interface SeedDataset {
  regions: Region[];
  /** World 入口直接展示的顶层 Region id 列表（区域图 DAG 的根集合） */
  worldRootRegionIds: string[];
  spots: Spot[];
  actions: Action[];
  eventPools: EventPool[];
  events: GameEvent[];
  rewards: Reward[];
  aiTemplates: AITemplate[];
}
