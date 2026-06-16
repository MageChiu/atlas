'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActionType } from '@atlas/shared';
import type { ActionWithState } from '@atlas/shared';
import { api } from '@/services/api';
import { ApiRequestError } from '@/services/errors';
import { useActionStore } from '@/stores/actionStore';
import { useUiStore } from '@/stores/uiStore';
import { useProgressStore } from '@/stores/progressStore';
import { useDialogue } from './useDialogue';
import { queryKeys } from './useContentQueries';

/**
 * F4.2 / TF05-5 - Action 执行流程
 * 点击 → 调 execute/check-in → loading → 接收结果 → 渲染 Event/Reward/AI 状态。
 * encounter 类型改为开启多轮对话面板（NPC 对话系统），不再走 executeAction。
 * 所有 Action 类型经统一入口（F4.1）。
 */
export function useExecuteAction(spotId: string) {
  const qc = useQueryClient();
  const setExecuting = useActionStore((s) => s.setExecuting);
  const setLastResult = useActionStore((s) => s.setLastResult);
  const setCooldown = useActionStore((s) => s.setCooldown);
  const openModal = useUiStore((s) => s.openModal);
  const pushToast = useUiStore((s) => s.pushToast);
  const setSpotProgress = useProgressStore((s) => s.setSpotProgress);
  const { start: startDialogue } = useDialogue();

  return useCallback(
    async (action: ActionWithState) => {
      if (!action.available) {
        pushToast('error', '动作冷却中，请稍后再试');
        return;
      }
      setExecuting(action.id);
      try {
        // photo 类型：打开生成面板，不走 execute
        if (action.type === ActionType.Photo) {
          openModal({
            type: 'photo',
            spotId,
            templateId: action.bindAiTemplate ?? '',
          });
          return;
        }

        // encounter 类型：开启多轮对话面板（NPC 对话系统），不走 executeAction
        if (action.type === ActionType.Encounter) {
          const ok = await startDialogue(spotId);
          if (ok) openModal({ type: 'dialogue' });
          return;
        }

        // check_in 走专用接口；其余走 execute
        if (action.type === ActionType.CheckIn) {
          const data = await api.checkIn(spotId);
          if (data.progress) setSpotProgress(data.progress);
          if (data.reward.length > 0) {
            openModal({ type: 'reward', rewards: data.reward });
          } else {
            pushToast('success', '打卡成功');
          }
        } else {
          const data = await api.executeAction(action.id);
          setLastResult(data);
          if (data.progress) setSpotProgress(data.progress);

          if (data.aiTask) {
            openModal({ type: 'aiPending', task: data.aiTask });
          } else if (data.event) {
            openModal({ type: 'event', event: data.event, rewards: data.reward });
          } else if (data.reward.length > 0) {
            openModal({ type: 'reward', rewards: data.reward });
          } else {
            pushToast('info', '什么都没有发生……');
          }
        }

        if (action.cooldown) setCooldown(action.id, action.cooldown);
        // 刷新动作冷却态
        qc.invalidateQueries({ queryKey: queryKeys.spotActions(spotId) });
        qc.invalidateQueries({ queryKey: queryKeys.collections });
      } catch (err) {
        const message =
          err instanceof ApiRequestError ? err.message : '执行失败，请重试';
        pushToast('error', message);
      } finally {
        setExecuting(null);
      }
    },
    [
      spotId,
      qc,
      setExecuting,
      setLastResult,
      setCooldown,
      openModal,
      pushToast,
      setSpotProgress,
      startDialogue,
    ],
  );
}
