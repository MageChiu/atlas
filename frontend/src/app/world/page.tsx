'use client';

import { useEffect } from 'react';
import { SceneLevel } from '@atlas/shared';
import { SceneStage } from '@/scenes/components/SceneStage';
import { useSceneStore } from '@/stores/sceneStore';
import { useWorld } from '@/hooks/useContentQueries';

/**
 * F2 / TF06-3 - 世界地图页：承载统一场景舞台。
 * 方案 A 下 World 入口只有单根「地球」，直接并入区域栈：
 * 进入 /world 且尚无区域上下文时 resetToRegion(region_earth)，World 层只作加载态。
 */
export default function WorldPage() {
  const level = useSceneStore((s) => s.currentLevel);
  const regionStackLen = useSceneStore((s) => s.regionStack.length);
  const resetToRegion = useSceneStore((s) => s.resetToRegion);
  const { data: world } = useWorld();

  useEffect(() => {
    // 仅在无任何区域上下文（首次进入/直达 /world）时，进入单根地球，避免打断已有层级
    if (level !== SceneLevel.World || regionStackLen > 0) return;
    const root = world?.regions[0];
    if (root) resetToRegion(root.id, root.name);
  }, [level, regionStackLen, world, resetToRegion]);

  return <SceneStage />;
}
