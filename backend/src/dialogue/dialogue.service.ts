import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DialogueRole,
  DialogueStatus,
  ErrorCode,
  SpotStatus,
} from '@atlas/shared';
import type {
  DialogueMessage,
  DialogueRewardGrant,
  DialogueRewardTrigger,
  DialogueSessionData,
  NpcProfile,
  NpcPublic,
  SayData,
  SayRequest,
  Spot,
  StartDialogueData,
  StartDialogueRequest,
} from '@atlas/shared';
import { BusinessException } from '../common/business.exception';
import { AppConfigService } from '../config/app-config.service';
import { ConfigRepository } from '../store/config.repository';
import { StateRepository } from '../store/state.repository';
import {
  DialogueSession,
  DialogueSessionRepository,
} from '../store/dialogue-session.repository';
import { RewardService } from '../reward/reward.service';
import { RiskService } from '../ops/risk.service';
import { NpcRepository } from './npc.repository';
import { LLM_PROVIDER, type LlmChatMessage, type LlmProvider } from './llm/llm.provider';
import { KNOWLEDGE_PREFIX } from './llm/mock-llm.provider';

/**
 * TB05-4 - 对话编排 + 收获判定。
 * system prompt（persona + knowledge + guardrails）服务端组装，绝不下发前端。
 * 收获判定服务端权威、幂等发奖，复用 reward 通道，不影响主进度链。
 */
@Injectable()
export class DialogueService {
  private readonly logger = new Logger(DialogueService.name);
  /** say 幂等缓存： key userId|sessionId|requestId -> 上次结果 */
  private readonly sayIdempotency = new Map<string, SayData>();

  constructor(
    private readonly config: ConfigRepository,
    private readonly appConfig: AppConfigService,
    private readonly npcs: NpcRepository,
    private readonly sessions: DialogueSessionRepository,
    private readonly rewards: RewardService,
    private readonly risk: RiskService,
    // 仅依赖抽象接口；具体实现由 token 注入
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly state: StateRepository,
  ) {}

  /** POST /api/dialogue/start */
  start(userId: string, body: StartDialogueRequest): StartDialogueData {
    const spot = this.config.getSpot(body.spotId);
    if (!spot) throw new BusinessException(ErrorCode.ACTION_NOT_AVAILABLE, 'Spot not found');
    if (spot.status !== SpotStatus.Open) {
      throw new BusinessException(ErrorCode.SPOT_NOT_UNLOCKED, 'Spot is not unlocked');
    }

    // 幂等：相同 requestId 返回同一会话
    const existingId = this.state.getIdempotent(userId, 'dialogue-start', body.requestId);
    if (existingId) {
      const existing = this.sessions.getById(userId, existingId);
      if (existing) return this.toStartData(existing);
    }

    const npc = this.selectNpc(spot, body.npcId);
    if (!npc) throw new BusinessException(ErrorCode.ACTION_NOT_AVAILABLE, 'NPC not found');

    const opening: DialogueMessage = {
      role: DialogueRole.Npc,
      content: npc.persona.opening,
      at: new Date().toISOString(),
    };
    const session = this.sessions.create(userId, spot.id, npc.id, opening);
    this.state.setIdempotent(userId, 'dialogue-start', body.requestId, session.id);
    return this.toStartData(session);
  }

  /** POST /api/dialogue/{sessionId}/say */
  async say(userId: string, sessionId: string, body: SayRequest): Promise<SayData> {
    const session = this.requireSession(userId, sessionId);
    if (session.status === DialogueStatus.Ended) {
      throw new BusinessException(ErrorCode.DIALOGUE_SESSION_ENDED, 'Dialogue session has ended');
    }

    // 幂等：重复 requestId 返回上次结果，不重复发奖
    const idemKey = `${userId}|${sessionId}|${body.requestId}`;
    const cached = this.sayIdempotency.get(idemKey);
    if (cached) return cached;

    // 内容安全
    if (!this.risk.checkText(body.message)) {
      throw new BusinessException(ErrorCode.RISK_BLOCKED, 'Content blocked by risk control');
    }

    const npc = this.npcs.getNpc(session.npcId);
    if (!npc) throw new BusinessException(ErrorCode.ACTION_NOT_AVAILABLE, 'NPC not found');

    // 服务端组 system prompt + 历史 + 当前输入
    const messages = this.buildLlmMessages(npc, session, body.message);
    let replyText: string;
    try {
      const result = await this.llm.chat({ messages });
      replyText = result.text;
    } catch (err) {
      this.logger.error(`LLM chat failed: ${(err as Error).message}`);
      throw new BusinessException(ErrorCode.LLM_UNAVAILABLE, 'LLM service is unavailable');
    }

    const now = new Date().toISOString();
    const userMsg: DialogueMessage = { role: DialogueRole.User, content: body.message, at: now };
    const npcMsg: DialogueMessage = { role: DialogueRole.Npc, content: replyText, at: now };
    this.sessions.appendMessage(session, userMsg);
    this.sessions.appendMessage(session, npcMsg);

    // 收获判定（命中 topicHints 且未点亮 → 发奖）
    const grants = this.evaluateRewards(userId, session, body.message, replyText);

    // 轮次上限 → 结束
    if (this.sessions.userTurns(session) >= this.appConfig.dialogueMaxTurns) {
      this.sessions.endSession(session);
    }

    const data: SayData = { reply: npcMsg, grants, status: session.status };
    this.sayIdempotency.set(idemKey, data);
    return data;
  }

  /** GET /api/dialogue/{sessionId} */
  getSession(userId: string, sessionId: string): DialogueSessionData {
    const session = this.requireSession(userId, sessionId);
    return {
      sessionId: session.id,
      npcId: session.npcId,
      spotId: session.spotId,
      status: session.status,
      messages: session.messages,
      grantedTriggerIds: [...session.grantedTriggerIds],
    };
  }

  // ---- 内部 ----

  private requireSession(userId: string, sessionId: string): DialogueSession {
    const session = this.sessions.getById(userId, sessionId);
    if (!session) {
      throw new BusinessException(
        ErrorCode.DIALOGUE_SESSION_NOT_FOUND,
        'Dialogue session not found',
      );
    }
    return session;
  }

  /** 选 NPC：指定优先；否则 spot.npcIds 中签名优先，generic 兜底 */
  private selectNpc(spot: Spot, npcId?: string): NpcProfile | undefined {
    if (npcId) return this.npcs.getNpc(npcId);
    const candidates = (spot.npcIds ?? [])
      .map((id) => this.npcs.getNpc(id))
      .filter((n): n is NpcProfile => !!n);
    if (candidates.length === 0) return undefined;
    const signature = candidates.find((n) => n.kind === 'signature');
    return signature ?? candidates[0];
  }

  /** 组装发给 LLM 的消息：system(persona+knowledge+guardrails) + 历史 + 当前输入 */
  private buildLlmMessages(
    npc: NpcProfile,
    session: DialogueSession,
    userInput: string,
  ): LlmChatMessage[] {
    const systemLines: string[] = [
      `你将扮演「${npc.name}」与到访者对话。`,
      `【人格】口吻：${npc.persona.voice}；设定：${npc.persona.setting}。`,
      '【知识锚（只可引用、不可编造）】',
      ...npc.knowledge.map((k) => `${KNOWLEDGE_PREFIX}${k.topic}：${k.facts}`),
      '【护栏】',
      ...npc.guardrails.map((g) => `- ${g}`),
    ];
    const system: LlmChatMessage = { role: 'system', content: systemLines.join('\n') };

    const history: LlmChatMessage[] = session.messages.map((m) => ({
      role: m.role === DialogueRole.Npc ? 'assistant' : 'user',
      content: m.content,
    }));

    return [system, ...history, { role: 'user', content: userInput }];
  }

  /** 收获判定：遍历 spot.dialogueRewards，命中且未点亮则发奖（幂等） */
  private evaluateRewards(
    userId: string,
    session: DialogueSession,
    userInput: string,
    reply: string,
  ): DialogueRewardGrant[] {
    const spot = this.config.getSpot(session.spotId);
    const triggers = spot?.dialogueRewards ?? [];
    const haystack = `${userInput}\n${reply}`;
    const grants: DialogueRewardGrant[] = [];

    for (const trigger of triggers) {
      if (session.grantedTriggerIds.has(trigger.id)) continue;
      if (!this.isHit(trigger, haystack)) continue;

      const rewardConfig = this.config.getReward(trigger.rewardId);
      if (!rewardConfig) {
        this.logger.warn(`收获触发点 ${trigger.id} 引用的 reward 不存在：${trigger.rewardId}`);
        this.sessions.markGranted(session, trigger.id); // 避免重复告警
        continue;
      }

      this.rewards.grant(userId, [trigger.rewardId], 'dialogue', trigger.id);
      this.sessions.markGranted(session, trigger.id);
      grants.push({ triggerId: trigger.id, reward: rewardConfig });
    }
    return grants;
  }

  private isHit(trigger: DialogueRewardTrigger, haystack: string): boolean {
    return trigger.topicHints.some((hint) => haystack.includes(hint));
  }

  private toStartData(session: DialogueSession): StartDialogueData {
    const npc = this.npcs.getNpc(session.npcId);
    const npcPublic: NpcPublic = npc
      ? { id: npc.id, name: npc.name, avatar: npc.avatar }
      : { id: session.npcId, name: session.npcId };
    return {
      sessionId: session.id,
      npc: npcPublic,
      opening: session.messages[0],
    };
  }
}
