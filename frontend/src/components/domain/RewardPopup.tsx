'use client';

import { ModalShell } from '@/components/ui/ModalShell';
import { RewardCard } from '@/components/ui/RewardCard';
import { useUiStore } from '@/stores/uiStore';
import type { Reward } from '@atlas/shared';

/** F4.5 - RewardPopup：纯奖励发放弹层 */
export function RewardPopup({ rewards }: { rewards: Reward[] }) {
  const closeModal = useUiStore((s) => s.closeModal);

  return (
    <ModalShell
      title="获得奖励"
      onClose={closeModal}
      footer={
        <button
          className="rounded-lg bg-atlas-primary px-4 py-1.5 text-sm font-medium text-black"
          onClick={closeModal}
        >
          收下
        </button>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {rewards.map((r) => (
          <RewardCard key={r.id} reward={r} />
        ))}
      </div>
    </ModalShell>
  );
}
