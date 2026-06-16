import { Injectable } from '@nestjs/common';
import type { GameEvent } from '@atlas/shared';
import { ConfigRepository } from '../store/config.repository';
import { StateRepository } from '../store/state.repository';

/**
 * B2.4 - 事件引擎：从事件池按权重选取可触发事件，处理 onceOnly 一次性事件。
 */
@Injectable()
export class EventService {
  constructor(
    private readonly config: ConfigRepository,
    private readonly state: StateRepository,
  ) {}

  /**
   * 从指定事件池为用户选取一个事件。
   * - 过滤掉已触发的 onceOnly 事件。
   * - 按 weight 加权随机；无候选返回 null。
   * - 命中 onceOnly 事件后标记已触发。
   */
  pickFromPool(userId: string, poolId: string): GameEvent | null {
    const pool = this.config.getEventPool(poolId);
    if (!pool) return null;

    const candidates = pool.eventIds
      .map((id) => this.config.getEvent(id))
      .filter((e): e is GameEvent => !!e)
      .filter((e) => {
        if (!e.onceOnly) return true;
        return !this.state.firedOnceEvents.has(StateKey(userId, e.id));
      });

    if (candidates.length === 0) return null;

    const picked = weightedPick(candidates);
    if (picked.onceOnly) {
      this.state.firedOnceEvents.add(StateKey(userId, picked.id));
    }
    return picked;
  }
}

function StateKey(userId: string, eventId: string): string {
  return `${userId}|${eventId}`;
}

function weightedPick(events: GameEvent[]): GameEvent {
  const total = events.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const e of events) {
    roll -= e.weight ?? 1;
    if (roll <= 0) return e;
  }
  return events[events.length - 1];
}
