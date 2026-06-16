import { create } from 'zustand';
import type { ActionWithState, ExecuteActionData } from '@atlas/shared';

/**
 * F4.3 - actionStore
 * 管理当前可用动作、执行中动作、最近一次执行结果与冷却映射。
 */
interface ActionState {
  availableActions: ActionWithState[];
  executingActionId: string | null;
  lastActionResult: ExecuteActionData | null;
  /** actionId -> 冷却结束时间戳(ms) */
  cooldownMap: Record<string, number>;

  setAvailableActions: (actions: ActionWithState[]) => void;
  setExecuting: (actionId: string | null) => void;
  setLastResult: (result: ExecuteActionData | null) => void;
  setCooldown: (actionId: string, seconds: number) => void;
  clear: () => void;
}

export const useActionStore = create<ActionState>((set) => ({
  availableActions: [],
  executingActionId: null,
  lastActionResult: null,
  cooldownMap: {},

  setAvailableActions: (actions) => set({ availableActions: actions }),
  setExecuting: (actionId) => set({ executingActionId: actionId }),
  setLastResult: (result) => set({ lastActionResult: result }),
  setCooldown: (actionId, seconds) =>
    set((s) => ({
      cooldownMap: { ...s.cooldownMap, [actionId]: Date.now() + seconds * 1000 },
    })),
  clear: () =>
    set({ availableActions: [], executingActionId: null, lastActionResult: null }),
}));
