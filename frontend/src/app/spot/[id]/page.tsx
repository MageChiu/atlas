'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { SceneStage } from '@/scenes/components/SceneStage';
import { useSceneStore } from '@/stores/sceneStore';
import { useSpot } from '@/hooks/useContentQueries';

/**
 * F1.1 - 景点页（深链入口）
 * 直接访问时拉取景点确定 region，再把场景同步到 Spot 层，复用统一场景舞台。
 */
export default function SpotPage() {
  const params = useParams<{ id: string }>();
  const enterRegion = useSceneStore((s) => s.enterRegion);
  const enterSpot = useSceneStore((s) => s.enterSpot);
  const currentSpotId = useSceneStore((s) => s.currentSpotId);
  const { data } = useSpot(params.id);

  useEffect(() => {
    if (data?.spot && params.id !== currentSpotId) {
      enterRegion(data.spot.regionId);
      enterSpot(params.id);
    }
  }, [data, params.id, currentSpotId, enterRegion, enterSpot]);

  return <SceneStage />;
}
