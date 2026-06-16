/**
 * C3.3 / C3.6 - 行为接口契约
 *   POST /api/spots/{spotId}/check-in
 *   POST /api/actions/{actionId}/execute
 * 依据 docs/Atlas-路过-API协议说明.md 第 4 节、后端技术设计第 6 节。
 */

import type { GameEvent, Reward, UserSpotProgress } from '../models/index.js';
import type { AITask } from '../models/index.js';
import type { IdempotentRequest } from './common.js';

/** 打卡请求 */
export interface CheckInRequest extends IdempotentRequest {
  payload?: Record<string, any>;
}

/** POST /api/spots/{spotId}/check-in -> data */
export interface CheckInData {
  spotId: string;
  checkedIn: boolean;
  /** 首次打卡发放的奖励（重复打卡为空数组） */
  reward: Reward[];
  progress?: UserSpotProgress;
}

/** 执行动作请求 */
export interface ExecuteActionRequest extends IdempotentRequest {
  payload?: Record<string, any>;
}

/**
 * POST /api/actions/{actionId}/execute -> data
 * 统一返回结构（冻结，不随意变更）：
 * { actionId, event, reward, aiTask, progress }
 */
export interface ExecuteActionData {
  actionId: string;
  /** 触发的事件（无则为 null） */
  event: GameEvent | null;
  /** 发放的奖励 */
  reward: Reward[];
  /** 创建的 AI 异步任务（无则为 null） */
  aiTask: AITask | null;
  /** 更新后的景点进度 */
  progress: UserSpotProgress | null;
}
