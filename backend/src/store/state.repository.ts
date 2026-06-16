import { Injectable } from '@nestjs/common';
import type {
  AITask,
  AITaskResult,
  UploadedImage,
  UserActionRecord,
  UserGeneratedAsset,
  UserRegionProgress,
  UserReward,
  UserSpotProgress,
} from '@atlas/shared';

/**
 * B2 / B3 - 用户状态仓储（内存实现）。
 * 保存所有可变的用户态与 AI 任务态，与配置实体（ConfigRepository）严格分离。
 * 内置幂等表，支撑 check-in / execute / photo-generate 的 requestId 去重。
 */
@Injectable()
export class StateRepository {
  readonly regionProgress = new Map<string, UserRegionProgress>(); // key: userId|regionId
  readonly spotProgress = new Map<string, UserSpotProgress>(); // key: userId|spotId
  readonly actionRecords: UserActionRecord[] = [];
  readonly userRewards: UserReward[] = [];

  /** 已触发的一次性事件： key: userId|eventId */
  readonly firedOnceEvents = new Set<string>();
  /** 已打卡景点： key: userId|spotId */
  readonly checkins = new Set<string>();
  /** Action 上次执行时间（冷却用）： key: userId|actionId -> epoch ms */
  readonly actionLastExecAt = new Map<string, number>();

  readonly uploadedImages = new Map<string, UploadedImage>();
  readonly aiTasks = new Map<string, AITask>();
  readonly aiResults = new Map<string, AITaskResult>(); // key: taskId
  readonly generatedAssets: UserGeneratedAsset[] = [];

  /** 幂等表： key: userId|scope|requestId -> 已产出的资源 id */
  private readonly idempotency = new Map<string, string>();

  static key(...parts: string[]): string {
    return parts.join('|');
  }

  getIdempotent(userId: string, scope: string, requestId?: string): string | undefined {
    if (!requestId) return undefined;
    return this.idempotency.get(StateRepository.key(userId, scope, requestId));
  }

  setIdempotent(userId: string, scope: string, requestId: string | undefined, resourceId: string): void {
    if (!requestId) return;
    this.idempotency.set(StateRepository.key(userId, scope, requestId), resourceId);
  }

  // ---- region progress ----
  getRegionProgress(userId: string, regionId: string): UserRegionProgress | undefined {
    return this.regionProgress.get(StateRepository.key(userId, regionId));
  }
  upsertRegionProgress(p: UserRegionProgress): void {
    this.regionProgress.set(StateRepository.key(p.userId, p.regionId), p);
  }
  listRegionProgress(userId: string): UserRegionProgress[] {
    return [...this.regionProgress.values()].filter((p) => p.userId === userId);
  }

  // ---- spot progress ----
  getSpotProgress(userId: string, spotId: string): UserSpotProgress | undefined {
    return this.spotProgress.get(StateRepository.key(userId, spotId));
  }
  upsertSpotProgress(p: UserSpotProgress): void {
    this.spotProgress.set(StateRepository.key(p.userId, p.spotId), p);
  }
  listSpotProgress(userId: string): UserSpotProgress[] {
    return [...this.spotProgress.values()].filter((p) => p.userId === userId);
  }

  listUserRewards(userId: string): UserReward[] {
    return this.userRewards.filter((r) => r.userId === userId);
  }
  hasReward(userId: string, rewardId: string): boolean {
    return this.userRewards.some((r) => r.userId === userId && r.rewardId === rewardId);
  }

  listGeneratedAssets(userId: string): UserGeneratedAsset[] {
    return this.generatedAssets.filter((a) => a.userId === userId);
  }
}
