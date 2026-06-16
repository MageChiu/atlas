/**
 * 资源 URL 解析（本地素材临时方案）
 *
 * 规则：
 * 1. 种子数据中的资源是相对命名（如 spots/xxx/scene.png），
 *    拼上 NEXT_PUBLIC_ASSET_BASE（默认 /assets）得到本地静态资源 URL。
 * 2. 本地素材可能尚未放置，组件用 onError 回退到文生图占位，保证页面不空缺。
 * 3. 联调/上线时只需改 NEXT_PUBLIC_ASSET_BASE 指向 CDN，无需改种子数据与组件。
 *
 * 详见 docs/Atlas-路过-素材资源方案.md 与 frontend/public/assets/README.md
 */

import type { Region, Reward, Spot } from '@atlas/shared';
import { APP_CONFIG } from '@/config';

const IMG_API = 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image';

function placeholder(prompt: string, size = 'landscape_16_9'): string {
  return `${IMG_API}?prompt=${encodeURIComponent(prompt)}&image_size=${size}`;
}

/** 相对资源路径 → 本地静态资源 URL */
export function localAssetUrl(relativePath: string): string {
  const base = APP_CONFIG.assetBase.replace(/\/$/, '');
  const path = relativePath.replace(/^\//, '');
  return `${base}/${path}`;
}

// ---- 文生图占位（本地素材缺失时的回退） ----

/** 景点主视觉占位 */
export function placeholderSpotScene(title: string): string {
  return placeholder(
    `${title}, chengdu sichuan travel scenery, cinematic warm light, highly detailed`,
    'landscape_16_9',
  );
}

/** 景点封面占位 */
export function placeholderSpotCover(title: string): string {
  return placeholder(`${title}, chengdu travel postcard illustration, vivid`, 'square');
}

/** 区域地图占位 */
export function placeholderRegionMap(name: string): string {
  return placeholder(
    `stylized travel map of ${name} city china, illustrated, soft tones, top down`,
    'landscape_16_9',
  );
}

/** 世界地图占位 */
export function placeholderWorldMap(): string {
  return placeholder(
    'stylized world travel map, illustrated, parchment, soft tones',
    'landscape_16_9',
  );
}

/** 奖励图标占位 */
export function placeholderReward(name: string): string {
  return placeholder(`${name}, game reward badge icon, glossy, centered`, 'square');
}

// ---- 解析：返回 { src, fallback }，组件 src 用本地、onError 切 fallback ----

export interface ResolvedAsset {
  src: string;
  fallback: string;
}

/** 景点主视觉：本地优先，缺失回退占位 */
export function resolveSpotScene(spot: Pick<Spot, 'title' | 'sceneAsset'>): ResolvedAsset {
  const fallback = placeholderSpotScene(spot.title);
  return { src: spot.sceneAsset ? localAssetUrl(spot.sceneAsset) : fallback, fallback };
}

/** 景点封面：本地优先，缺失回退占位 */
export function resolveSpotCover(spot: Pick<Spot, 'title' | 'coverAsset'>): ResolvedAsset {
  const fallback = placeholderSpotCover(spot.title);
  return { src: spot.coverAsset ? localAssetUrl(spot.coverAsset) : fallback, fallback };
}

/**
 * 区域地图底图（TF-4）：本地 regions/{region.id}/map.png 优先，缺失回退占位。
 * 底图随素材服务托管，不打包进前端产物（见 docs/Atlas-路过-素材资源方案.md）。
 */
export function resolveRegionMap(
  region: Pick<Region, 'id' | 'name' | 'mapAsset'>,
): ResolvedAsset {
  const fallback = placeholderRegionMap(region.name);
  const relative = region.mapAsset || `regions/${region.id}/map.png`;
  return { src: relative ? localAssetUrl(relative) : fallback, fallback };
}

/** 奖励图：本地优先，缺失回退占位 */
export function resolveReward(reward: Pick<Reward, 'name' | 'asset'>): ResolvedAsset {
  const fallback = placeholderReward(reward.name);
  return { src: reward.asset ? localAssetUrl(reward.asset) : fallback, fallback };
}
