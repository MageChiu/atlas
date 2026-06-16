'use client';

import { useSceneStore } from '@/stores/sceneStore';
import { useSpot } from '@/hooks/useContentQueries';
import { resolveSpotScene } from '@/utils/assets';
import { ActionPanel } from '@/components/domain/ActionPanel';

/**
 * F2.3 / 6.3 - SpotScene
 * 展示景点主视觉并渲染 Action 入口；作为 Event Layer 的承载基底。
 */
export function SpotScene() {
  const spotId = useSceneStore((s) => s.currentSpotId);
  const { data, isLoading } = useSpot(spotId);

  if (!spotId) return null;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* 主视觉 */}
      <div className="relative flex-1 overflow-hidden">
        {data?.spot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveSpotScene(data.spot).src}
            alt={data.spot.title}
            className="h-full w-full object-cover"
            onError={(e) => {
              const { fallback } = resolveSpotScene(data.spot);
              if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-atlas-bg via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6">
          {isLoading ? (
            <div className="text-atlas-muted">加载景点…</div>
          ) : (
            data?.spot && (
              <>
                <h2 className="text-2xl font-bold drop-shadow">{data.spot.title}</h2>
                {data.spot.description && (
                  <p className="mt-1 max-w-xl text-sm text-white/80 drop-shadow">
                    {data.spot.description}
                  </p>
                )}
              </>
            )
          )}
        </div>
      </div>

      {/* Action 入口面板 */}
      <ActionPanel spotId={spotId} />
    </div>
  );
}
