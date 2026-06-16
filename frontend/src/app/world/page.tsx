'use client';

import { useEffect } from 'react';
import { SceneLevel } from '@atlas/shared';
import { SceneStage } from '@/scenes/components/SceneStage';
import { useSceneStore } from '@/stores/sceneStore';

/** F2 - 世界地图页：承载统一场景舞台 */
export default function WorldPage() {
  const setLevel = useSceneStore((s) => s.setLevel);
  const level = useSceneStore((s) => s.currentLevel);

  // 直接进入 /world 时重置到 world 层
  useEffect(() => {
    if (level === SceneLevel.World) return;
    // 仅在无上下文时复位，避免打断已有层级
  }, [level, setLevel]);

  return <SceneStage />;
}
