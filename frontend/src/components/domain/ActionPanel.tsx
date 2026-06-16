'use client';

import { useEffect } from 'react';
import { ActionType } from '@atlas/shared';
import type { ActionWithState } from '@atlas/shared';
import { useSpotActions } from '@/hooks/useContentQueries';
import { useExecuteAction } from '@/hooks/useExecuteAction';
import { useActionStore } from '@/stores/actionStore';

/**
 * F4.1 - Action 面板（统一渲染入口）
 * 所有 Action 类型经统一结构渲染：icon / title / subtitle / status / handler。
 */

const ACTION_META: Record<ActionType, { icon: string; subtitle: string }> = {
  [ActionType.CheckIn]: { icon: '📍', subtitle: '打卡留念' },
  [ActionType.Photo]: { icon: '📷', subtitle: 'AI 写真' },
  [ActionType.Encounter]: { icon: '✨', subtitle: '偶遇事件' },
  [ActionType.RandomEvent]: { icon: '🎲', subtitle: '随机事件' },
};

export function ActionPanel({ spotId }: { spotId: string }) {
  const { data, isLoading } = useSpotActions(spotId);
  const execute = useExecuteAction(spotId);
  const executingId = useActionStore((s) => s.executingActionId);
  const setAvailable = useActionStore((s) => s.setAvailableActions);

  useEffect(() => {
    if (data?.actions) setAvailable(data.actions);
  }, [data, setAvailable]);

  return (
    <div className="border-t border-atlas-border bg-atlas-surface/95 px-4 py-3 backdrop-blur">
      <div className="mb-2 text-xs uppercase tracking-wide text-atlas-muted">
        可执行动作
      </div>
      {isLoading ? (
        <div className="text-sm text-atlas-muted">加载动作…</div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {data?.actions.map((action) => (
            <ActionButton
              key={action.id}
              action={action}
              executing={executingId === action.id}
              onClick={() => execute(action)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  action,
  executing,
  onClick,
}: {
  action: ActionWithState;
  executing: boolean;
  onClick: () => void;
}) {
  const meta = ACTION_META[action.type];
  const disabled = !action.available || executing;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex min-w-[120px] flex-col items-start gap-0.5 rounded-xl border border-atlas-border bg-atlas-bg/60 px-4 py-3 text-left transition-colors hover:border-atlas-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{meta.icon}</span>
        <span className="text-sm font-medium">{action.name}</span>
      </div>
      <span className="text-xs text-atlas-muted">
        {executing
          ? '处理中…'
          : !action.available && action.cooldownRemaining
            ? `冷却 ${action.cooldownRemaining}s`
            : meta.subtitle}
      </span>
    </button>
  );
}
