/**
 * C3.2 - 内容查询接口契约
 *   GET /api/world
 *   GET /api/regions/{regionId}
 *   GET /api/spots/{spotId}
 *   GET /api/spots/{spotId}/actions
 * 依据 docs/Atlas-路过-API协议说明.md 第 3、4.2 节。
 */

import type {
  Action,
  Region,
  Spot,
  UserRegionProgress,
  UserSpotProgress,
} from '../models/index.js';

/** GET /api/world -> data */
export interface WorldData {
  /** World 入口直接展示的顶层区域（区域图 DAG 的根集合） */
  regions: Region[];
  /** 用户对各区域的解锁/进度信息 */
  regionProgress?: UserRegionProgress[];
}

/**
 * GET /api/regions/{regionId} -> data
 * 区域为区域图 DAG 节点：childRegions 为可继续下钻的子区域，spots 为可进入的景点；两者可并存。
 */
export interface RegionDetailData {
  region: Region;
  /** 子区域（容器节点的下钻入口）；叶子区域为空 */
  childRegions: Region[];
  /** 本区域直接包含的景点（含通过 children 边跨区域挂载进来的） */
  spots: Spot[];
  progress?: UserRegionProgress;
}

/** GET /api/spots/{spotId} -> data */
export interface SpotDetailData {
  spot: Spot;
  actions: Action[];
  progress?: UserSpotProgress;
}

/** Action 列表项：在配置基础上附加用户态运行信息 */
export interface ActionWithState extends Action {
  /** 当前是否可执行 */
  available: boolean;
  /** 剩余冷却秒数（0 表示无冷却） */
  cooldownRemaining?: number;
}

/** GET /api/spots/{spotId}/actions -> data */
export interface SpotActionsData {
  actions: ActionWithState[];
}
