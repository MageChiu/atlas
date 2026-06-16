'use client';

import { ModalShell } from '@/components/ui/ModalShell';
import { RewardCard } from '@/components/ui/RewardCard';
import { useUiStore } from '@/stores/uiStore';
import type { GameEvent, Reward } from '@atlas/shared';

/** F4.5 - EventModal：展示随机事件结果与奖励 */
export function EventModal({
  event,
  rewards,
}: {
  event: GameEvent;
  rewards: Reward[];
}) {
  const closeModal = useUiStore((s) => s.closeModal);

  return (
    <ModalShell
      title={event.title}
      onClose={closeModal}
      footer={
        <button
          className="rounded-lg bg-atlas-primary px-4 py-1.5 text-sm font-medium text-black"
          onClick={closeModal}
        >
          知道了
        </button>
      }
    >
      {event.description && (
        <p className="mb-3 text-sm leading-relaxed text-atlas-muted">
          {event.description}
        </p>
      )}
      {rewards.length > 0 && (
        <>
          <div className="mb-2 text-xs text-atlas-muted">获得奖励</div>
          <div className="grid grid-cols-3 gap-2">
            {rewards.map((r) => (
              <RewardCard key={r.id} reward={r} />
            ))}
          </div>
        </>
      )}
    </ModalShell>
  );
}
