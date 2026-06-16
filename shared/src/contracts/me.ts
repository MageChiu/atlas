/**
 * C3.5 - 用户资产接口契约
 *   GET /api/me/collections
 *   GET /api/me/generated-assets
 *   GET /api/me/achievements
 * 依据 docs/Atlas-路过-API协议说明.md 第 6 节。
 */

import type { Reward, UserGeneratedAsset } from '../models/index.js';

/** 图鉴/收藏条目：奖励 + 获得信息 */
export interface CollectionEntry {
  reward: Reward;
  obtained: boolean;
  obtainedAt?: string;
}

/** GET /api/me/collections -> data */
export interface CollectionsData {
  collections: CollectionEntry[];
}

/** GET /api/me/generated-assets -> data */
export interface GeneratedAssetsData {
  assets: UserGeneratedAsset[];
}

/** 成就条目（一期可简版） */
export interface Achievement {
  id: string;
  name: string;
  description?: string;
  unlocked: boolean;
  unlockedAt?: string;
}

/** GET /api/me/achievements -> data */
export interface AchievementsData {
  achievements: Achievement[];
}
