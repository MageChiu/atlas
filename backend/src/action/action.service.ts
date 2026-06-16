import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { ActionType, ErrorCode } from '@atlas/shared';
import type {
  Action,
  AITask,
  CheckInData,
  ExecuteActionData,
  ExecuteActionRequest,
  GameEvent,
  Reward,
  Spot,
  UserActionRecord,
} from '@atlas/shared';
import { BusinessException } from '../common/business.exception';
import { ConfigRepository } from '../store/config.repository';
import { StateRepository } from '../store/state.repository';
import { ProgressService } from '../progress/progress.service';
import { RewardService } from '../reward/reward.service';
import { EventService } from '../event/event.service';
import { AiService } from '../ai/ai.service';
import { OpsService } from '../ops/ops.service';
import { ActionRulesService } from './action-rules.service';

const FIRST_VISIT_BADGE = 'reward_badge_first_visit';

/**
 * B2.2 / B2.3 - 行为逻辑：打卡与执行 Action。
 */
@Injectable()
export class ActionService {
  private readonly logger = new Logger(ActionService.name);

  constructor(
    private readonly config: ConfigRepository,
    private readonly state: StateRepository,
    private readonly progress: ProgressService,
    private readonly rewards: RewardService,
    private readonly events: EventService,
    private readonly ai: AiService,
    private readonly ops: OpsService,
    private readonly rules: ActionRulesService,
  ) {}

  /** B2.2 打卡：幂等，首次打卡发奖+解锁图鉴 */
  checkIn(userId: string, spotId: string, requestId?: string): CheckInData {
    const spot = this.config.getSpot(spotId);
    if (!spot) throw new BusinessException(ErrorCode.ACTION_NOT_AVAILABLE, 'Spot not found');
    this.assertSpotAccessible(userId, spot);

    const checkinKey = StateRepository.key(userId, spotId);
    const already = this.state.checkins.has(checkinKey);

    // 幂等：相同 requestId 重复请求直接返回既有结果（不重复发奖）
    const idem = this.state.getIdempotent(userId, 'check-in', requestId);

    if (already || idem) {
      return {
        spotId,
        checkedIn: true,
        reward: [],
        progress: this.progress.getSpotProgress(userId, spotId),
      };
    }

    this.state.checkins.add(checkinKey);
    const progress = this.progress.markVisited(userId, spotId);
    const reward = this.rewards.grant(userId, [FIRST_VISIT_BADGE], 'check_in', spotId);
    this.state.setIdempotent(userId, 'check-in', requestId, spotId);

    return { spotId, checkedIn: true, reward, progress };
  }

  /** B2.3 执行 Action：标准流程 */
  execute(userId: string, actionId: string, body: ExecuteActionRequest): ExecuteActionData {
    // 幂等：相同 requestId 已执行过 -> 回放结果（此处简化为返回当前进度的空结果，避免重复发奖）
    const idem = this.state.getIdempotent(userId, 'execute', body.requestId);

    // 1. Action 校验
    const action = this.config.getAction(actionId);
    if (!action) throw new BusinessException(ErrorCode.ACTION_NOT_AVAILABLE, 'Action not found');

    const spot = this.config.getSpot(action.spotId);
    if (!spot) throw new BusinessException(ErrorCode.ACTION_NOT_AVAILABLE, 'Spot not found');

    if (idem) {
      return {
        actionId,
        event: null,
        reward: [],
        aiTask: this.state.aiTasks.get(idem) ?? null,
        progress: this.progress.getSpotProgress(userId, spot.id),
      };
    }

    // 2/3. 开放与解锁校验
    this.assertSpotAccessible(userId, spot);

    // 4. 前置条件与冷却校验
    if (!this.rules.meetsUnlockCondition(userId, action)) {
      throw new BusinessException(ErrorCode.ACTION_NOT_AVAILABLE, 'Action precondition not met');
    }
    const cooldown = this.rules.cooldownRemaining(userId, action);
    if (cooldown > 0) {
      throw new BusinessException(ErrorCode.ACTION_COOLDOWN, `Cooling down, ${cooldown}s left`);
    }

    // CheckIn 类型动作走打卡通道
    if (action.type === ActionType.CheckIn) {
      const checkIn = this.checkIn(userId, spot.id, body.requestId);
      return {
        actionId,
        event: null,
        reward: checkIn.reward,
        aiTask: null,
        progress: checkIn.progress ?? null,
      };
    }

    // 5. 写行为记录 + 标记冷却起点
    this.state.actionLastExecAt.set(StateRepository.key(userId, action.id), Date.now());

    // 6. 选事件
    let event: GameEvent | null = null;
    if (action.bindEventPool) {
      event = this.events.pickFromPool(userId, action.bindEventPool);
    }

    // 7. 发奖励 / 建 AI 任务
    const reward = this.grantEventRewards(userId, event, actionId);
    const aiTask = this.maybeCreateAiTask(userId, action);

    this.recordAction(userId, action, event);
    const progress = this.progress.incrementActionCount(userId, spot.id);

    if (aiTask) this.state.setIdempotent(userId, 'execute', body.requestId, aiTask.id);
    else this.state.setIdempotent(userId, 'execute', body.requestId, `done_${actionId}`);

    // 8. 统一返回
    return { actionId, event, reward, aiTask, progress };
  }

  private grantEventRewards(userId: string, event: GameEvent | null, actionId: string): Reward[] {
    const rewardIds = event?.rewardPayload?.rewardIds;
    if (!event || !Array.isArray(rewardIds) || rewardIds.length === 0) return [];
    return this.rewards.grant(userId, rewardIds, 'event', event.id || actionId);
  }

  private maybeCreateAiTask(userId: string, action: Action): AITask | null {
    if (!action.bindAiTemplate) return null;
    if (!this.ops.isFeatureEnabled('ai_photo_generate')) return null;
    const task = this.ai.createTask(userId, action.bindAiTemplate);
    this.ai.enqueue(task.id);
    return task;
  }

  private recordAction(userId: string, action: Action, event: GameEvent | null): void {
    const record: UserActionRecord = {
      id: uuid(),
      userId,
      actionId: action.id,
      spotId: action.spotId,
      resultType: event ? event.type : action.type,
      eventId: event?.id,
      createdAt: new Date().toISOString(),
    };
    this.state.actionRecords.push(record);
  }

  /** 开放/解锁校验（B2.3 step 2/3） */
  private assertSpotAccessible(userId: string, spot: Spot): void {
    const region = this.config.getRegion(spot.regionId);
    if (!this.rules.isRegionOpen(region)) {
      throw new BusinessException(ErrorCode.REGION_NOT_OPEN, 'Region is not open');
    }
    if (!this.rules.isSpotUnlocked(userId, spot)) {
      throw new BusinessException(ErrorCode.SPOT_NOT_UNLOCKED, 'Spot is not unlocked');
    }
  }
}
