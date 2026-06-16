'use client';

import { useState } from 'react';
import { DialogueStatus } from '@atlas/shared';
import { ModalShell } from '@/components/ui/ModalShell';
import { RewardCard } from '@/components/ui/RewardCard';
import { DialogueMessageList } from './DialogueMessageList';
import { useDialogueStore } from '@/stores/dialogueStore';
import { useDialogue } from '@/hooks/useDialogue';
import { useUiStore } from '@/stores/uiStore';
import { localAssetUrl } from '@/utils/assets';

/**
 * TF05-4 - 对话面板（Event Layer 内 UI，不跳页）。
 * 渲染 NPC 公开信息（id/name/avatar）+ 多轮消息流 + 输入框；
 * 收获经 useDialogue 走 RewardPopup，消息流内插入轻提示。关闭时 reset。
 */
const AVATAR_PLACEHOLDER =
  'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=portrait%20avatar%20illustration%20warm%20tone&image_size=square';

export function DialoguePanel() {
  const npc = useDialogueStore((s) => s.npc);
  const messages = useDialogueStore((s) => s.messages);
  const status = useDialogueStore((s) => s.status);
  const sending = useDialogueStore((s) => s.sending);
  const grantedRewardNames = useDialogueStore((s) => s.grantedRewardNames);
  const pendingRewards = useDialogueStore((s) => s.pendingRewards);
  const clearPendingRewards = useDialogueStore((s) => s.clearPendingRewards);
  const reset = useDialogueStore((s) => s.reset);
  const closeModal = useUiStore((s) => s.closeModal);
  const { send } = useDialogue();

  const [input, setInput] = useState('');
  const ended = status === DialogueStatus.Ended;

  const handleClose = () => {
    reset();
    closeModal();
  };

  const handleSend = async () => {
    if (!input.trim() || sending || ended) return;
    const text = input;
    setInput('');
    await send(text);
  };

  const avatarSrc = npc?.avatar ? localAssetUrl(npc.avatar) : AVATAR_PLACEHOLDER;

  return (
    <ModalShell title={npc ? `与「${npc.name}」对话` : '对话'} onClose={handleClose}>
      <div className="mb-2 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc}
          alt={npc?.name ?? 'npc'}
          className="h-12 w-12 rounded-full border border-atlas-border object-cover"
          onError={(e) => {
            if (e.currentTarget.src !== AVATAR_PLACEHOLDER) {
              e.currentTarget.src = AVATAR_PLACEHOLDER;
            }
          }}
        />
        <div>
          <div className="text-sm font-semibold text-white">{npc?.name}</div>
          <div className="text-xs text-atlas-muted">
            {ended ? '对话已结束' : '正在对话中'}
          </div>
        </div>
      </div>

      <DialogueMessageList messages={messages} npc={npc} sending={sending} />

      {grantedRewardNames.length > 0 && (
        <div className="mt-2 rounded-lg border border-atlas-primary/40 bg-atlas-primary/10 px-3 py-1.5 text-xs text-atlas-primary">
          获得：{grantedRewardNames.join('、')} · 已收入图鉴
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          disabled={sending || ended}
          placeholder={ended ? '对话已结束' : '说点什么…'}
          className="flex-1 rounded-lg border border-atlas-border bg-atlas-bg/60 px-3 py-2 text-sm outline-none focus:border-atlas-primary disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={sending || ended || !input.trim()}
          className="rounded-lg bg-atlas-primary px-4 py-2 text-sm font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          发送
        </button>
      </div>

      {/* 收获弹层：叠加在对话面板之上，关闭后回到对话（不销毁会话） */}
      {pendingRewards.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={clearPendingRewards}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-atlas-border bg-atlas-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-center text-base font-semibold text-atlas-primary">
              聊出了收获 · 已收入图鉴
            </div>
            <div className="grid grid-cols-3 gap-2">
              {pendingRewards.map((r) => (
                <RewardCard key={r.id} reward={r} />
              ))}
            </div>
            <button
              onClick={clearPendingRewards}
              className="mt-4 w-full rounded-lg bg-atlas-primary px-4 py-1.5 text-sm font-medium text-black"
            >
              收下，继续聊
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
