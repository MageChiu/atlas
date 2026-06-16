'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DialogueRole, DialogueStatus, ErrorCode } from '@atlas/shared';
import type { DialogueMessage } from '@atlas/shared';
import { api } from '@/services/api';
import { ApiRequestError } from '@/services/errors';
import { useDialogueStore } from '@/stores/dialogueStore';
import { useUiStore } from '@/stores/uiStore';
import { queryKeys } from './useContentQueries';

/**
 * TF05-3 - useDialogue
 * 封装对话 start / say：写入 dialogueStore、命中收获展示 RewardPopup 并刷新图鉴。
 * 错误码映射：RISK_BLOCKED / LLM_UNAVAILABLE（可重发） / DIALOGUE_SESSION_ENDED（关闭面板）。
 */
export function useDialogue() {
  const qc = useQueryClient();
  const startSession = useDialogueStore((s) => s.startSession);
  const appendMessage = useDialogueStore((s) => s.appendMessage);
  const setSending = useDialogueStore((s) => s.setSending);
  const setStatus = useDialogueStore((s) => s.setStatus);
  const applyGrants = useDialogueStore((s) => s.applyGrants);
  const openModal = useUiStore((s) => s.openModal);
  const pushToast = useUiStore((s) => s.pushToast);

  const start = useCallback(
    async (spotId: string, npcId?: string) => {
      try {
        const data = await api.startDialogue({ spotId, npcId });
        startSession(data.sessionId, data.npc, data.opening);
        return true;
      } catch (err) {
        const message =
          err instanceof ApiRequestError ? err.message : '无法开始对话，请稍后再试';
        pushToast('error', message);
        return false;
      }
    },
    [startSession, pushToast],
  );

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text) return;
      const { sessionId, sending, status } = useDialogueStore.getState();
      if (!sessionId || sending || status === DialogueStatus.Ended) return;

      // 乐观追加用户消息
      const userMsg: DialogueMessage = {
        role: DialogueRole.User,
        content: text,
        at: new Date().toISOString(),
      };
      appendMessage(userMsg);
      setSending(true);

      try {
        const data = await api.say(sessionId, text);
        appendMessage(data.reply);
        setStatus(data.status);
        if (data.grants.length > 0) {
          // 收获在对话面板内叠加 RewardPopup（不替换对话本身），并刷新图鉴
          applyGrants(data.grants);
          qc.invalidateQueries({ queryKey: queryKeys.collections });
        }
        if (data.status === DialogueStatus.Ended) {
          pushToast('info', '这段对话告一段落了');
        }
        return true;
      } catch (err) {
        const code = err instanceof ApiRequestError ? err.code : 'UNKNOWN';
        if (code === ErrorCode.RISK_BLOCKED) {
          pushToast('error', '这句话不太合适，换个说法试试');
        } else if (code === ErrorCode.LLM_UNAVAILABLE) {
          pushToast('error', '对方走神了，稍后再说一次吧');
        } else if (code === ErrorCode.DIALOGUE_SESSION_NOT_FOUND) {
          pushToast('error', '对话已失效');
          setStatus(DialogueStatus.Ended);
        } else if (code === ErrorCode.DIALOGUE_SESSION_ENDED) {
          pushToast('info', '这段对话已经结束了');
          setStatus(DialogueStatus.Ended);
        } else {
          const m = err instanceof ApiRequestError ? err.message : '发送失败，请重试';
          pushToast('error', m);
        }
        return false;
      } finally {
        setSending(false);
      }
    },
    [qc, appendMessage, setSending, setStatus, applyGrants, pushToast],
  );

  return { start, send };
}
