import { create } from 'zustand';
import { DialogueStatus } from '@atlas/shared';
import type {
  DialogueMessage,
  DialogueRewardGrant,
  NpcPublic,
  Reward,
} from '@atlas/shared';

/**
 * TF05-2 - dialogueStore
 * 仅维护当前对话的会话/交互态；不重复缓存后端实体（服务端数据由调用结果驱动）。
 */
interface DialogueState {
  sessionId: string | null;
  npc: NpcPublic | null;
  messages: DialogueMessage[];
  status: DialogueStatus;
  sending: boolean;
  grantedTriggerIds: string[];
  /** 已点亮收获的奖励名（用于消息流内轻提示） */
  grantedRewardNames: string[];
  /** 本轮待展示的收获（在对话面板内叠加 RewardPopup，不替换对话本身） */
  pendingRewards: Reward[];

  startSession: (
    sessionId: string,
    npc: NpcPublic,
    opening: DialogueMessage,
  ) => void;
  appendMessage: (message: DialogueMessage) => void;
  setSending: (sending: boolean) => void;
  setStatus: (status: DialogueStatus) => void;
  applyGrants: (grants: DialogueRewardGrant[]) => void;
  clearPendingRewards: () => void;
  reset: () => void;
}

const initial = {
  sessionId: null as string | null,
  npc: null as NpcPublic | null,
  messages: [] as DialogueMessage[],
  status: DialogueStatus.Active as DialogueStatus,
  sending: false,
  grantedTriggerIds: [] as string[],
  grantedRewardNames: [] as string[],
  pendingRewards: [] as Reward[],
};

export const useDialogueStore = create<DialogueState>((set) => ({
  ...initial,

  startSession: (sessionId, npc, opening) =>
    set({
      sessionId,
      npc,
      messages: [opening],
      status: DialogueStatus.Active,
      sending: false,
      grantedTriggerIds: [],
      grantedRewardNames: [],
      pendingRewards: [],
    }),

  appendMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),

  setSending: (sending) => set({ sending }),

  setStatus: (status) => set({ status }),

  applyGrants: (grants) =>
    set((s) => ({
      grantedTriggerIds: [
        ...s.grantedTriggerIds,
        ...grants.map((g) => g.triggerId),
      ],
      grantedRewardNames: [
        ...s.grantedRewardNames,
        ...grants.map((g) => g.reward.name),
      ],
      pendingRewards: grants.map((g) => g.reward),
    })),

  clearPendingRewards: () => set({ pendingRewards: [] }),

  reset: () => set({ ...initial }),
}));
