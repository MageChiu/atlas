/**
 * 地图投影工具（方案 B：经纬度 → 底图像素）
 * 依据 tasks/03-地图真实坐标标记.md 第 1 章。
 * 小范围（城市级）用线性投影即可，对纬度做 cos 修正以校验底图比例。
 */

import type { GeoBounds, GeoPoint, MapSize } from '../models/content.js';

/** 像素坐标 */
export interface PixelPoint {
  x: number;
  y: number;
}

/**
 * 经纬度 → 底图像素坐标。
 * x = (lng - west)/(east - west) * width
 * y = (north - lat)/(north - south) * height   （纬度朝上、像素朝下）
 */
export function geoToPixel(geo: GeoPoint, bounds: GeoBounds, size: MapSize): PixelPoint {
  const lngSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;
  const x = lngSpan === 0 ? 0 : ((geo.lng - bounds.west) / lngSpan) * size.width;
  const y = latSpan === 0 ? 0 : ((bounds.north - geo.lat) / latSpan) * size.height;
  return { x, y };
}

/** bbox 比例校验结果 */
export interface BoundsRatioCheck {
  ok: boolean;
  /** bbox 实际宽高比（含纬度 cos 修正） */
  ratio: number;
  /** 底图期望宽高比 width/height */
  expected: number;
  /** 相对偏差（|ratio-expected|/expected） */
  deviation: number;
}

/**
 * 校验 bbox 跨度比是否匹配底图宽高比（含纬度 cos 修正）。
 * ratio = (east-west)·cos(latCenter) / (north-south)，应 ≈ width/height。
 * @param tolerance 允许的相对偏差，默认 0.02（2%）。
 */
export function assertBoundsRatio(
  bounds: GeoBounds,
  size: MapSize,
  tolerance = 0.02,
): BoundsRatioCheck {
  const latCenter = (bounds.north + bounds.south) / 2;
  const cosLat = Math.cos((latCenter * Math.PI) / 180);
  const ratio = ((bounds.east - bounds.west) * cosLat) / (bounds.north - bounds.south);
  const expected = size.width / size.height;
  const deviation = Math.abs(ratio - expected) / expected;
  return { ok: deviation <= tolerance, ratio, expected, deviation };
}
