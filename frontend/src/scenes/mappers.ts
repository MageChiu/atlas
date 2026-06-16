import { RegionStatus, SpotStatus, geoToPixel } from '@atlas/shared';
import type { Region, Spot } from '@atlas/shared';
import type { NodeDatum } from './runtime/SceneRuntime';

/** 配置实体 → 场景节点（数据驱动渲染，不写死） */

/**
 * 区域节点定位：
 * - World 层 / 无父坐标：按索引散布（散点网格）。
 * - 容器区域下钻：优先用父 children 边里的 coord（若提供），否则索引散布。
 */
export function regionStateToNode(
  region: Region,
  index = 0,
  coord?: { x: number; y: number },
): NodeDatum {
  let x: number;
  let y: number;
  if (coord) {
    x = coord.x;
    y = coord.y;
  } else {
    const cols = 3;
    x = 320 + (index % cols) * 360;
    y = 220 + Math.floor(index / cols) * 300;
  }
  return {
    id: region.id,
    label: region.name,
    x,
    y,
    kind: 'region',
    state: region.status === RegionStatus.Open ? 'active' : 'soon',
  };
}

/**
 * TF-2 - 景点节点定位：
 * 当 region.geoBounds + region.mapSize + spot.geo 齐全时，用真实经纬度投影到底图像素；
 * 否则回退到抽象像素 spot.coord。
 */
export function spotStateToNode(spot: Spot, region?: Region): NodeDatum {
  let x = spot.coord.x;
  let y = spot.coord.y;
  if (region?.geoBounds && region.mapSize && spot.geo) {
    const p = geoToPixel(spot.geo, region.geoBounds, region.mapSize);
    x = p.x;
    y = p.y;
  }
  return {
    id: spot.id,
    label: spot.title,
    x,
    y,
    kind: 'spot',
    state: spot.status === SpotStatus.Locked ? 'locked' : 'active',
    subtitle: spot.description,
  };
}

/**
 * 图钉防重叠（渲染期偏移，不改数据坐标）：
 * 真实经纬度极近的景点投影后会重叠，这里对距离小于 minDist 的节点做小幅径向散开，
 * 保留相对地理关系，仅改善可点击性与可读性。
 * @param minDist 最小像素间距（底图坐标系，建议 ≈ 图钉直径）
 */
export function deOverlapNodes(nodes: NodeDatum[], minDist = 90): NodeDatum[] {
  if (nodes.length < 2) return nodes;
  const out = nodes.map((n) => ({ ...n }));
  // 多轮松弛：把过近的成对节点沿连线方向各推开一半
  for (let iter = 0; iter < 8; iter++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 1e-3) {
          // 完全重合：给一个确定性的微小角度，避免随机抖动
          const angle = (i * 73 + j * 31) % 360;
          dx = Math.cos((angle * Math.PI) / 180);
          dy = Math.sin((angle * Math.PI) / 180);
          dist = 1;
        }
        const push = (minDist - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
}
