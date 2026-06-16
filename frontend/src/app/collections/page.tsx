'use client';

import { useCollections } from '@/hooks/useContentQueries';
import { resolveReward } from '@/utils/assets';

/** F6.1 - 图鉴页 */
export default function CollectionsPage() {
  const { data, isLoading } = useCollections();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold">图鉴收藏</h1>
      {isLoading ? (
        <div className="text-atlas-muted">加载中…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {data?.collections.map(({ reward, obtained }) => {
            const { src, fallback } = resolveReward(reward);
            return (
            <div
              key={reward.id}
              className={`flex flex-col items-center gap-2 rounded-xl border border-atlas-border bg-atlas-surface p-4 ${
                obtained ? '' : 'opacity-40 grayscale'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={reward.name}
                className="h-24 w-24 rounded-lg object-cover"
                onError={(e) => {
                  if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                }}
              />
              <div className="text-center text-sm font-medium">{reward.name}</div>
              <div className="text-xs text-atlas-muted">
                {obtained ? '已获得' : '未获得'}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
