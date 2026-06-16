'use client';

import { resolveReward } from '@/utils/assets';
import type { Reward } from '@atlas/shared';

/** 奖励卡片（图鉴 / 奖励弹层共用） */
export function RewardCard({ reward }: { reward: Reward }) {
  const { src, fallback } = resolveReward(reward);
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-atlas-border bg-atlas-bg/60 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={reward.name}
        className="h-20 w-20 rounded-lg object-cover"
        onError={(e) => {
          if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
        }}
      />
      <div className="text-center">
        <div className="text-sm font-medium">{reward.name}</div>
        {reward.rarity && (
          <div className="text-xs uppercase tracking-wide text-atlas-primary">
            {reward.rarity}
          </div>
        )}
      </div>
    </div>
  );
}
