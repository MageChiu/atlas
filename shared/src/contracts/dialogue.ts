/**
 * C3.3 - NPC 对话接口契约
 *   POST /api/dialogue/start
 *   POST /api/dialogue/{sessionId}/say
 *   GET  /api/dialogue/{sessionId}
 * 依据 docs/Atlas-路过-NPC对话系统设计.md 第 3.4 节。
 * 注意：system prompt / knowledge / guardrails 仅在服务端使用，绝不出现在以下任何响应中。
 */

import type { DialogueRole, DialogueStatus } from '../enums.js';
import type { NpcPublic } from '../models/npc.js';
import type { Reward } from '../models/content.js';

/** 单条对话消息 */
export interface DialogueMessage {
  role: DialogueRole;
  content: string;
  /** ISO 时间戳 */
  at: string;
}

/** POST /api/dialogue/start -> 请求体 */
export interface StartDialogueRequest {
  spotId: string;
  /** 指定 NPC；缺省时由后端按 spot.npcIds 选取 */
  npcId?: string;
  requestId: string;
}

/** POST /api/dialogue/start -> data */
export interface StartDialogueData {
  sessionId: string;
  npc: NpcPublic;
  opening: DialogueMessage;
}

/** POST /api/dialogue/{sessionId}/say -> 请求体 */
export interface SayRequest {
  message: string;
  requestId: string;
}

/** 本轮点亮的收获 */
export interface DialogueRewardGrant {
  triggerId: string;
  reward: Reward;
}

/** POST /api/dialogue/{sessionId}/say -> data */
export interface SayData {
  reply: DialogueMessage;
  /** 本轮命中的收获（可空） */
  grants: DialogueRewardGrant[];
  status: DialogueStatus;
}

/** GET /api/dialogue/{sessionId} -> data */
export interface DialogueSessionData {
  sessionId: string;
  npcId: string;
  spotId: string;
  status: DialogueStatus;
  messages: DialogueMessage[];
  grantedTriggerIds: string[];
}
