import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { DialogueStatus } from '@atlas/shared';
import type { DialogueMessage } from '@atlas/shared';

/** 进程内对话会话（与配置实体分离，参考 StateRepository 风格） */
export interface DialogueSession {
  id: string;
  userId: string;
  spotId: string;
  npcId: string;
  status: DialogueStatus;
  messages: DialogueMessage[];
  /** 已点亮的收获触发点 id（幂等去重） */
  grantedTriggerIds: Set<string>;
  createdAt: string;
  updatedAt: string;
}

/**
 * TB05-2 - 对话会话仓储（内存实现）。
 * 仅保存会话态；归属以 userId 校验。
 */
@Injectable()
export class DialogueSessionRepository {
  private readonly sessions = new Map<string, DialogueSession>();

  create(userId: string, spotId: string, npcId: string, opening: DialogueMessage): DialogueSession {
    const now = new Date().toISOString();
    const session: DialogueSession = {
      id: uuid(),
      userId,
      spotId,
      npcId,
      status: DialogueStatus.Active,
      messages: [opening],
      grantedTriggerIds: new Set<string>(),
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /** 取会话并校验归属；非本人或不存在返回 undefined */
  getById(userId: string, sessionId: string): DialogueSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) return undefined;
    return session;
  }

  appendMessage(session: DialogueSession, message: DialogueMessage): void {
    session.messages.push(message);
    session.updatedAt = new Date().toISOString();
  }

  markGranted(session: DialogueSession, triggerId: string): void {
    session.grantedTriggerIds.add(triggerId);
    session.updatedAt = new Date().toISOString();
  }

  endSession(session: DialogueSession): void {
    session.status = DialogueStatus.Ended;
    session.updatedAt = new Date().toISOString();
  }

  /** 用户在该会话内已说话的轮次（user 消息数） */
  userTurns(session: DialogueSession): number {
    return session.messages.filter((m) => m.role === 'user').length;
  }
}
