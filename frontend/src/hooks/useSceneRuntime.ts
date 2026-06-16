'use client';

import { useEffect, useRef, useState } from 'react';
import { SceneRuntime } from '@/scenes/runtime/SceneRuntime';

/**
 * 在 canvas 上初始化并持有一个 SceneRuntime 实例，
 * 自适应容器尺寸，组件卸载时销毁。
 * 若 WebGL 不可用（initFailed=true），由调用方降级为 DOM 渲染。
 */
export function useSceneRuntime() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [runtime, setRuntime] = useState<SceneRuntime | null>(null);
  const [initFailed, setInitFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    let rt: SceneRuntime | null = null;
    try {
      rt = new SceneRuntime(canvas, {
        width: rect.width || 800,
        height: rect.height || 600,
      });
      setRuntime(rt);
    } catch (e) {
      console.warn('[SceneRuntime] WebGL 初始化失败，降级为 DOM 渲染', e);
      setInitFailed(true);
      return;
    }

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      rt?.resize(width, height);
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      rt?.destroy();
      setRuntime(null);
    };
  }, []);

  return { canvasRef, containerRef, runtime, initFailed };
}
