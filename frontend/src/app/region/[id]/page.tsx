'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { SceneStage } from '@/scenes/components/SceneStage';
import { useSceneStore } from '@/stores/sceneStore';

/**
 * F1.1 - 区域页（深链入口）
 * 直接访问时把场景同步到对应 Region 层，复用统一场景舞台。
 */
export default function RegionPage() {
  const params = useParams<{ id: string }>();
  const resetToRegion = useSceneStore((s) => s.resetToRegion);
  const currentRegionId = useSceneStore((s) => s.currentRegionId);

  useEffect(() => {
    if (params.id && params.id !== currentRegionId) {
      resetToRegion(params.id);
    }
  }, [params.id, currentRegionId, resetToRegion]);

  return <SceneStage />;
}
