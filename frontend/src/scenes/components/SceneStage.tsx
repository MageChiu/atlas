'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SceneLevel } from '@atlas/shared';
import { useSceneRuntime } from '@/hooks/useSceneRuntime';
import { useSceneStore } from '@/stores/sceneStore';
import { useWorld, useRegion } from '@/hooks/useContentQueries';
import type { NodeDatum } from '@/scenes/runtime/SceneRuntime';
import { spotStateToNode, regionStateToNode, deOverlapNodes } from '@/scenes/mappers';
import { resolveRegionMap } from '@/utils/assets';
import { SpotScene } from './SpotScene';
import { SceneHud } from './SceneHud';
import { DomSceneLayer } from './DomSceneLayer';

/**
 * F2 / F3 - 统一场景舞台
 * 单一运行时承载 World→Region 两层节点渲染，层级切换由相机转场驱动，
 * 不以页面跳转替代（F3.4）。WebGL 不可用时降级为 DOM 节点层。
 * Region 层（方案 B）：渲染插画底图 + 景点按经纬度投影打图钉。
 * Spot 层叠加 DOM 主视觉(SpotScene) 作为 Event Layer 承载基底。
 */
export function SceneStage() {
  const { canvasRef, containerRef, runtime, initFailed } = useSceneRuntime();
  const level = useSceneStore((s) => s.currentLevel);
  const regionId = useSceneStore((s) => s.currentRegionId);
  const enterRegion = useSceneStore((s) => s.enterRegion);
  const enterSpot = useSceneStore((s) => s.enterSpot);
  const beginTransition = useSceneStore((s) => s.beginTransition);
  const endTransition = useSceneStore((s) => s.endTransition);

  const { data: world } = useWorld();
  const { data: region } = useRegion(regionId);

  const nodePos = useRef<Record<string, { x: number; y: number }>>({});
  const nodeKind = useRef<Record<string, NodeDatum['kind']>>({});
  const nodeLabel = useRef<Record<string, string>>({});
  const [hoverId, setHoverId] = useState<string | null>(null);

  const isRegion = level === SceneLevel.Region;

  // 当前层级对应的节点数据（数据驱动）
  const nodes: NodeDatum[] = useMemo(() => {
    if (level === SceneLevel.World && world) {
      return world.regions.map((r, i) => regionStateToNode(r, i));
    }
    if (isRegion && region) {
      // TF04-3 / TF06-1：容器区域显示子区域入口 + 叶子区域显示景点，两类可并存。
      // 子区域优先按自身 geo 投影到父底图（落在地理正确位置），否则 coord/索引兜底。
      const childEdges = region.region.children ?? [];
      const projectedRegions = region.childRegions.map((r, i) => {
        const coord = childEdges.find((c) => c.refId === r.id)?.coord;
        return regionStateToNode(r, i, coord, region.region);
      });
      const regionNodes = deOverlapNodes(projectedRegions, 110);
      // TF-2：景点按经纬度投影定位；并对极近图钉做渲染期防重叠
      const projected = region.spots.map((s) => spotStateToNode(s, region.region));
      const spotNodes = deOverlapNodes(projected, 110);
      return [...regionNodes, ...spotNodes];
    }
    return [];
  }, [level, isRegion, world, region]);

  useEffect(() => {
    nodePos.current = Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    nodeKind.current = Object.fromEntries(nodes.map((n) => [n.id, n.kind]));
    nodeLabel.current = Object.fromEntries(nodes.map((n) => [n.id, n.label]));
  }, [nodes]);

  // 节点点击：按节点 kind 分发下钻（区域→继续下钻，景点→进入 Spot），并播放进入相机动画
  const handleNodeClick = useCallback(
    async (id: string) => {
      const pos = nodePos.current[id];
      const kind = nodeKind.current[id];
      const name = nodeLabel.current[id];
      // World 层一律进入区域；Region 层按 kind 区分子区域/景点
      if (level === SceneLevel.World) {
        beginTransition('enter', SceneLevel.Region);
        if (runtime && pos)
          await runtime.camera.transitionTo('enter', { ...pos, zoom: 1.8 });
        enterRegion(id, name);
        endTransition();
      } else if (isRegion && kind === 'region') {
        beginTransition('enter', SceneLevel.Region);
        if (runtime && pos)
          await runtime.camera.transitionTo('enter', { ...pos, zoom: 1.8 });
        enterRegion(id, name);
        endTransition();
      } else if (isRegion) {
        beginTransition('enter', SceneLevel.Spot);
        if (runtime && pos)
          await runtime.camera.transitionTo('enter', { ...pos, zoom: 2.2 });
        enterSpot(id);
        endTransition();
      }
    },
    [level, isRegion, runtime, beginTransition, endTransition, enterRegion, enterSpot],
  );

  // TF-1 / TF04-3：进入/离开 Region 时设置/清除底图，并按 mapSize 调整相机。
  // 叶子城市（有 mapSize+geoBounds）走底图投影；容器区域无底图，清底图走纯色背景、相机复位（不崩溃）。
  useEffect(() => {
    if (!runtime) return;
    const r = isRegion ? region?.region : undefined;
    if (r?.mapSize && r.geoBounds) {
      const { mapSize } = r;
      const { src } = resolveRegionMap(r);
      // setBackground 内部已对加载失败兜底（保持纯色背景，不崩溃）
      void runtime.setBackground(src, mapSize);
      // 相机缩放/平移范围匹配底图尺寸，居中显示整张地图
      const view = runtime.app.renderer;
      const fitZoom = Math.min(
        view.width / mapSize.width,
        view.height / mapSize.height,
      );
      runtime.camera.updateParams({
        minZoom: fitZoom * 0.8,
        maxZoom: Math.max(2.4, fitZoom * 4),
      });
      runtime.camera.setImmediate({
        x: mapSize.width / 2,
        y: mapSize.height / 2,
        zoom: fitZoom,
      });
    } else {
      // World 层或容器区域：清除底图，恢复默认缩放范围与复位视图
      runtime.clearBackground();
      runtime.camera.updateParams({ minZoom: 0.5, maxZoom: 3 });
      runtime.camera.resetView(0);
    }
  }, [runtime, isRegion, region]);

  // 渲染节点（Region 层景点用图钉、子区域用圆点），并接相机复位与 hover
  useEffect(() => {
    if (!runtime) return;
    runtime.renderNodes(nodes, { drawPaths: false, pin: isRegion });
    if (!isRegion) {
      runtime.camera.resetView(level === SceneLevel.World ? 0 : 0.6);
    }
    runtime.setNodeClickHandler(handleNodeClick);
    runtime.setNodeHoverHandler(setHoverId);
  }, [runtime, nodes, level, isRegion, handleNodeClick]);

  const showDomLayer = initFailed && level !== SceneLevel.Spot;
  const hoverNode = hoverId ? nodes.find((n) => n.id === hoverId) : null;

  // DOM 降级层底图（仅 Region 且 mapSize 齐全时）
  const domBackground = useMemo(() => {
    if (!isRegion || !region?.region?.mapSize) return undefined;
    const { src, fallback } = resolveRegionMap(region.region);
    return {
      src,
      fallback,
      width: region.region.mapSize.width,
      height: region.region.mapSize.height,
    };
  }, [isRegion, region]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-atlas-bg">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {/* WebGL 不可用时的 DOM 降级节点层 */}
      {showDomLayer && (
        <DomSceneLayer
          nodes={nodes}
          pin={isRegion}
          background={domBackground}
          onNodeClick={handleNodeClick}
        />
      )}
      {/* Pixi 路径下的 hover 浮层卡片 */}
      {!showDomLayer && hoverNode && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-lg border border-atlas-border bg-atlas-surface/95 px-4 py-2 text-center shadow-lg">
          <div className="text-sm font-semibold text-atlas-primary">
            {hoverNode.label}
          </div>
          {hoverNode.subtitle && (
            <div className="mt-0.5 max-w-xs text-xs text-atlas-muted">
              {hoverNode.subtitle}
            </div>
          )}
        </div>
      )}
      {/* Spot 层：DOM 主视觉 + Action 面板（Event Layer 承载基底） */}
      {level === SceneLevel.Spot && <SpotScene />}
      {/* HUD：层级面包屑与回退（回退触发镜像相机动画） */}
      <SceneHud runtime={runtime} />
    </div>
  );
}
