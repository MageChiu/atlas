/**
 * 区域插画底图生成脚本（TS-1，方案 B）
 *
 * 产出风格化/插画风成都地图，覆盖范围 = region.geoBounds，尺寸 = region.mapSize。
 * 地理特征（山地、岷江/府南河、市区暖块、景点标注点）均按经纬度经 geoToPixel
 * 投影到底图像素，确保与前端图钉对位一致。
 *
 * 依赖系统的 rsvg-convert（macOS: brew install librsvg）把 SVG 转 PNG。
 * 落地到 resources/assets/regions/{regionId}/map.png（覆盖现有照片）。
 *
 * 用法：
 *   node scripts/gen-region-map.mjs            # 生成缺失
 *   node scripts/gen-region-map.mjs --force    # 覆盖重新生成
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { seedDataset, geoToPixel, assertBoundsRatio } from '@atlas/shared';

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ASSET_DIR = join(ROOT, 'resources', 'assets');
const FORCE = process.argv.slice(2).includes('--force');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** 把一组经纬度点投影成 "x,y x,y ..." 折线坐标串 */
function polyline(points, bounds, size) {
  return points
    .map((g) => {
      const p = geoToPixel(g, bounds, size);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
}

/** 构造风格化成都地图 SVG（坐标系 = mapSize；地物按经纬度投影） */
function buildChengduSvg(bounds, size) {
  const { width: W, height: H } = size;
  const px = (lng, lat) => geoToPixel({ lng, lat }, bounds, size);

  // 岷江主干（西北→东南，流经都江堰、市区西侧）
  const minRiver = polyline(
    [
      { lng: 103.5, lat: 31.04 },
      { lng: 103.62, lat: 31.0 },
      { lng: 103.8, lat: 30.85 },
      { lng: 103.95, lat: 30.72 },
      { lng: 104.02, lat: 30.62 },
      { lng: 104.08, lat: 30.58 },
    ],
    bounds,
    size,
  );
  // 府南河（环绕市区）
  const fnRiver = polyline(
    [
      { lng: 104.0, lat: 30.72 },
      { lng: 104.05, lat: 30.68 },
      { lng: 104.09, lat: 30.65 },
      { lng: 104.1, lat: 30.6 },
    ],
    bounds,
    size,
  );

  // 西北山地多边形（青城山/都江堰一带）
  const mtnA = `0,0 ${px(103.85, 31.05).x.toFixed(0)},0 ${px(103.7, 30.78).x.toFixed(0)},${px(103.7, 30.78).y.toFixed(0)} ${px(103.45, 30.85).x.toFixed(0)},${px(103.45, 30.85).y.toFixed(0)} 0,${px(103.45, 30.9).y.toFixed(0)}`;
  const mtnB = `0,0 ${px(103.7, 31.05).x.toFixed(0)},0 ${px(103.6, 30.88).x.toFixed(0)},${px(103.6, 30.88).y.toFixed(0)} ${px(103.45, 30.95).x.toFixed(0)},${px(103.45, 30.95).y.toFixed(0)} 0,${px(103.45, 31.0).y.toFixed(0)}`;

  // 市区暖色块中心（东南，景点簇拥处）
  const cityC = px(104.06, 30.66);
  const cityW = px(104.18, 30.55).x - px(103.95, 30.78).x;
  const cityH = px(104.18, 30.55).y - px(103.95, 30.78).y;

  // 城市绿地（熊猫基地一带 + 市区公园）
  const panda = px(104.145, 30.7336);
  const park = px(104.04, 30.66);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3e6c8"/>
      <stop offset="1" stop-color="#e4d3a8"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.62" cy="0.62" r="0.7">
      <stop offset="0" stop-color="#fff6df" stop-opacity=".5"/>
      <stop offset="1" stop-color="#fff6df" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#land)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- 西北山地（青城山/都江堰一带） -->
  <polygon points="${mtnA}" fill="#cdbf94" opacity=".75"/>
  <polygon points="${mtnB}" fill="#b9aa7d" opacity=".6"/>

  <!-- 市区暖色块（东南） -->
  <rect x="${(cityC.x - cityW / 2).toFixed(0)}" y="${(cityC.y - cityH / 2).toFixed(0)}"
        width="${cityW.toFixed(0)}" height="${cityH.toFixed(0)}" rx="60"
        fill="#efd9b0" opacity=".55"/>

  <!-- 城市绿地 -->
  <circle cx="${park.x.toFixed(0)}" cy="${park.y.toFixed(0)}" r="90" fill="#bcd09a" opacity=".7"/>
  <circle cx="${panda.x.toFixed(0)}" cy="${panda.y.toFixed(0)}" r="70" fill="#a9c785" opacity=".7"/>

  <!-- 岷江主干 -->
  <polyline points="${minRiver}" fill="none" stroke="#9fc6d8" stroke-width="22"
            stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
  <!-- 府南河 -->
  <polyline points="${fnRiver}" fill="none" stroke="#9fc6d8" stroke-width="14"
            stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>

  <!-- 图廓标题 -->
  <text x="${(W - 40).toFixed(0)}" y="${(H - 36).toFixed(0)}" text-anchor="end"
        font-family="system-ui, PingFang SC, sans-serif" font-size="44"
        fill="#9c8a5e" opacity=".5">成都 · CHENGDU</text>
</svg>`;
}

async function main() {
  console.log('[gen-region-map] 生成风格化插画区域底图（方案 B）');
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const region of seedDataset.regions) {
    if (!region.geoBounds || !region.mapSize || !region.mapAsset) {
      console.warn(`  ! 跳过 ${region.name}：缺 geoBounds/mapSize/mapAsset`);
      continue;
    }
    const outPath = join(ASSET_DIR, region.mapAsset);
    if (!FORCE && (await exists(outPath))) {
      console.log(`  - skip  ${region.name}（已存在，--force 覆盖）`);
      skip++;
      continue;
    }

    // 比例校验（含纬度 cos 修正）
    const check = assertBoundsRatio(region.geoBounds, region.mapSize);
    console.log(
      `  · ${region.name} bbox 比例校验 ratio=${check.ratio.toFixed(3)} expected=${check.expected.toFixed(3)} 偏差=${(check.deviation * 100).toFixed(1)}% ${check.ok ? 'OK' : 'WARN'}`,
    );

    if (region.id !== 'region_chengdu') {
      console.warn(`  ! ${region.name} 暂无插画模板，跳过`);
      skip++;
      continue;
    }

    try {
      const svg = buildChengduSvg(region.geoBounds, region.mapSize);
      const svgPath = join(ASSET_DIR, region.mapAsset.replace(/\.png$/, '.svg'));
      await mkdir(dirname(svgPath), { recursive: true });
      await writeFile(svgPath, svg, 'utf8');
      // rsvg-convert SVG → PNG（尺寸 = mapSize）
      await execFileP('rsvg-convert', [
        '-w',
        String(region.mapSize.width),
        '-h',
        String(region.mapSize.height),
        '-o',
        outPath,
        svgPath,
      ]);
      console.log(`  ✓ ok    ${region.name} → ${region.mapAsset} (${region.mapSize.width}×${region.mapSize.height})`);
      ok++;
    } catch (e) {
      fail++;
      console.warn(`  ✗ fail  ${region.name}: ${e.message}`);
    }
  }

  console.log(`\n[gen-region-map] 完成：生成 ${ok}，跳过 ${skip}，失败 ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('[gen-region-map] 致命错误：', e);
  process.exit(1);
});
