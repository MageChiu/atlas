'use client';

import { useState } from 'react';
import type { NodeDatum } from '@/scenes/runtime/SceneRuntime';

/**
 * WebGL 不可用时的 DOM 降级节点渲染层。
 * 与 Pixi 渲染保持一致的数据驱动（NodeDatum），保证场景在任何环境可用。
 * - pin=true 时渲染为地图图钉（底部尖端对齐坐标）并支持 hover 浮层（对齐 TF-3）。
 * - 提供 background(底图 + mapSize) 时：底图按比例居中，图钉按 mapSize 归一化定位，
 *   与 Pixi 路径（sprite 尺寸=mapSize、图钉用 mapSize 像素坐标）精确对位。
 * - 无 background 时：按节点包围盒自适应铺满可视区（World 层）。
 */

/** 可视区内边距（百分比），避免节点与标签贴边被裁切 */
const PADDING = 10;

function mapPosition(value: number, min: number, max: number): number {
  if (max - min < 1e-6) return 50;
  const ratio = (value - min) / (max - min);
  return PADDING + ratio * (100 - PADDING * 2);
}

export interface DomSceneBackground {
  src: string;
  fallback: string;
  width: number;
  height: number;
}

export function DomSceneLayer({
  nodes,
  onNodeClick,
  pin = false,
  background,
}: {
  nodes: NodeDatum[];
  onNodeClick: (id: string) => void;
  pin?: boolean;
  background?: DomSceneBackground;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  // 包围盒（无底图时按节点分布自适应）
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const useMap = !!background;

  const pinNodes = (
    <>
      {nodes.map((node) => {
        const disabled = node.state === 'locked' || node.state === 'soon';
        const left = useMap
          ? (node.x / background!.width) * 100
          : mapPosition(node.x, minX, maxX);
        const top = useMap
          ? (node.y / background!.height) * 100
          : mapPosition(node.y, minY, maxY);
        const hovered = hoverId === node.id;
        // 子区域节点渲染为圆形下钻入口，景点（pin 模式）渲染为图钉
        const asPin = pin && node.kind !== 'region';

        return (
          <button
            key={node.id}
            disabled={disabled}
            onClick={() => onNodeClick(node.id)}
            onMouseEnter={() => setHoverId(node.id)}
            onMouseLeave={() => setHoverId((id) => (id === node.id ? null : id))}
            style={{ left: `${left}%`, top: `${top}%` }}
            className={`absolute flex flex-col items-center gap-1 disabled:cursor-not-allowed ${
              asPin ? '-translate-x-1/2 -translate-y-full' : '-translate-x-1/2 -translate-y-1/2'
            }`}
          >
            {hovered && (
              <div className="pointer-events-none absolute bottom-full mb-2 w-48 rounded-lg border border-atlas-border bg-atlas-surface/95 px-3 py-2 text-center shadow-lg">
                <div className="text-sm font-semibold text-atlas-primary">
                  {node.label}
                </div>
                {node.subtitle && (
                  <div className="mt-0.5 text-xs text-atlas-muted">{node.subtitle}</div>
                )}
              </div>
            )}

            {asPin ? (
              <span
                className={`flex h-9 w-9 rotate-45 items-center justify-center rounded-full rounded-br-none border-2 transition-transform hover:scale-110 ${
                  node.state === 'active'
                    ? 'border-white/80 bg-atlas-primary'
                    : 'border-white/30 bg-atlas-border'
                }`}
              >
                <span className="-rotate-45 text-xs">
                  {node.state === 'active' ? '' : '🔒'}
                </span>
              </span>
            ) : (
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${
                  node.state === 'active'
                    ? 'border-white/80 bg-atlas-primary'
                    : 'border-white/30 bg-atlas-border'
                }`}
              >
                {node.state === 'locked' ? '🔒' : node.kind === 'region' ? '🗺' : ''}
              </span>
            )}
            <span className="whitespace-nowrap rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
              {node.label}
            </span>
          </button>
        );
      })}
    </>
  );

  if (useMap) {
    // 底图按比例居中的内层盒，图钉相对底图定位（与 Pixi 一致）
    return (
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div
          className="relative"
          style={{
            aspectRatio: `${background!.width} / ${background!.height}`,
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={background!.src}
            alt="region map"
            className="absolute inset-0 h-full w-full rounded-lg object-cover"
            onError={(e) => {
              if (e.currentTarget.src !== background!.fallback) {
                e.currentTarget.src = background!.fallback;
              }
            }}
          />
          {pinNodes}
        </div>
      </div>
    );
  }

  return <div className="absolute inset-0">{pinNodes}</div>;
}
