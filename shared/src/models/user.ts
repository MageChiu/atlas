/**
 * C2.2 - 用户状态模型
 * 依据 docs/Atlas-路过-数据模型设计.md 第 4 节。
 * 约束：用户状态与配置实体分离，不冗余写入配置表。
 */

import type { GeneratedAssetType } from '../enums.js';

/** 用户区域进度 */
export interface UserRegionProgress {
  userId: string;
  regionId: string;
  unlocked: boolean;
  exploredSpotCount: number;
  /** 探索完成度 0~1 */
  completionRate: number;
  updatedAt: string;
}

/** 用户景点进度 */
export interface UserSpotProgress {
  userId: string;
  spotId: string;
  unlocked: boolean;
  firstVisitedAt?: string;
  visitCount: number;
  actionCount: number;
  updatedAt: string;
}

/** 用户动作执行记录 */
export interface UserActionRecord {
  id: string;
  userId: string;
  actionId: string;
  spotId: string;
  resultType?: string;
  eventId?: string;
  createdAt: string;
}

/** 用户已获得奖励 */
export interface UserReward {
  id: string;
  userId: string;
  rewardId: string;
  /** 来源类型：action / check_in / event 等 */
  sourceType: string;
  sourceId: string;
  grantedAt: string;
}

/** 用户生成资产 */
export interface UserGeneratedAsset {
  id: string;
  userId: string;
  taskId: string;
  assetType: GeneratedAssetType;
  assetUrl: string;
  createdAt: string;
}
