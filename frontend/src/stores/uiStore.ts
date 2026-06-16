import { create } from 'zustand';
import { genId } from '@/utils/id';
import type { GameEvent, Reward, AITask } from '@atlas/shared';

/**
 * F1.2 / F4.5 - uiStore
 * 全局通知（toast）与弹窗（modal）容器状态。
 * Event / Reward / Encounter / AI 结果均通过统一弹窗渲染入口。
 */

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

/** 弹窗负载：通过统一入口渲染不同类型 */
export type ModalPayload =
  | { type: 'event'; event: GameEvent; rewards: Reward[] }
  | { type: 'reward'; rewards: Reward[] }
  | { type: 'encounter'; event: GameEvent; rewards: Reward[] }
  | { type: 'photo'; spotId: string; templateId: string }
  | { type: 'aiResult'; taskId: string }
  | { type: 'aiPending'; task: AITask }
  | { type: 'dialogue' };

interface UiState {
  toasts: Toast[];
  modal: ModalPayload | null;
  pushToast: (kind: ToastKind, message: string) => void;
  removeToast: (id: string) => void;
  openModal: (payload: ModalPayload) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  modal: null,
  pushToast: (kind, message) =>
    set((s) => ({ toasts: [...s.toasts, { id: genId('toast'), kind, message }] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openModal: (payload) => set({ modal: payload }),
  closeModal: () => set({ modal: null }),
}));
