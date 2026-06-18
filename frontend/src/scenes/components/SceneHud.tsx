'use client';

import { useEffect } from 'react';
import { SceneLevel } from '@atlas/shared';
import { useSceneStore } from '@/stores/sceneStore';
import { useRegion } from '@/hooks/useContentQueries';
import type { SceneRuntime } from '@/scenes/runtime/SceneRuntime';

/**
 * TF04-4 - 场景 HUD：区域栈面包屑 + 逐级回退。
 * 面包屑反映 regionStack（World › 亚洲 › 中国 › 四川 › 成都 ›（Spot）），
 * 回退使用与进入镜像的相机动画（F3.3），不做页面跳转。
 */
export function SceneHud({ runtime }: { runtime: SceneRuntime | null }) {
  const level = useSceneStore((s) => s.currentLevel);
  const regionStack = useSceneStore((s) => s.regionStack);
  const regionNames = useSceneStore((s) => s.regionNames);
  const regionId = useSceneStore((s) => s.currentRegionId);
  const spotId = useSceneStore((s) => s.currentSpotId);
  const backOneLevel = useSceneStore((s) => s.backOneLevel);
  const goToRegionDepth = useSceneStore((s) => s.goToRegionDepth);
  const setRegionName = useSceneStore((s) => s.setRegionName);
  const beginTransition = useSceneStore((s) => s.beginTransition);
  const endTransition = useSceneStore((s) => s.endTransition);

  const { data: region } = useRegion(regionId);
  const spotName = region?.spots.find((s) => s.id === spotId)?.title;

  // 把当前区域名补进缓存（深链进入时栈里可能尚无名称）
  useEffect(() => {
    if (region?.region && regionNames[region.region.id] !== region.region.name) {
      setRegionName(region.region.id, region.region.name);
    }
  }, [region, regionNames, setRegionName]);

  const playBack = async (run: () => void) => {
    beginTransition('back', SceneLevel.Region);
    if (runtime) await runtime.camera.resetView(0.6);
    run();
    endTransition();
  };

  // World 层只是加载态（方案 A 下 /world 会立即进入根「地球」）
  if (level === SceneLevel.World) {
    return (
      <div className="pointer-events-none absolute left-4 top-4 text-sm text-atlas-muted">
        加载中…
      </div>
    );
  }

  // 当前是否停在某个区域层（用于把栈顶渲染成不可点击的当前项）
  const atRegionLeaf = level === SceneLevel.Region;

  return (
    <div className="absolute left-4 top-4 flex flex-wrap items-center gap-1.5 text-sm">
      {regionStack.map((id, i) => {
        const name = regionNames[id] ?? '…';
        const isLast = i === regionStack.length - 1;
        // 栈顶：Region 层为当前项（不可点）；Spot 层时栈顶仍可点（回到该区域）
        const isCurrent = isLast && atRegionLeaf;
        return (
          <span key={id} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-atlas-muted">/</span>}
            {isCurrent ? (
              <span className="px-1 text-white">{name}</span>
            ) : (
              <button
                onClick={() => playBack(() => goToRegionDepth(i + 1))}
                className="rounded bg-atlas-surface/80 px-3 py-1 text-atlas-muted backdrop-blur transition-colors hover:text-white"
              >
                {name}
              </button>
            )}
          </span>
        );
      })}
      {spotName && (
        <>
          <span className="text-atlas-muted">/</span>
          <span className="px-1 text-white">{spotName}</span>
        </>
      )}
      <button
        onClick={() => playBack(backOneLevel)}
        className="ml-2 rounded border border-atlas-border px-3 py-1 text-atlas-muted backdrop-blur transition-colors hover:text-white"
      >
        返回
      </button>
    </div>
  );
}
