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

/** 经纬度数组 [[lng,lat],...] → 折线/多边形坐标串 */
function poly(pairs, bounds, size) {
  return polyline(
    pairs.map(([lng, lat]) => ({ lng, lat })),
    bounds,
    size,
  );
}

const SVG_DEFS = `<defs>
    <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3e6c8"/>
      <stop offset="1" stop-color="#e4d3a8"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0" stop-color="#fff6df" stop-opacity=".5"/>
      <stop offset="1" stop-color="#fff6df" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dceaf0"/>
      <stop offset="1" stop-color="#c4dde6"/>
    </linearGradient>
  </defs>`;

function svgOpen(W, H) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
}
function svgTitle(W, H, label) {
  return `<text x="${(W - 40).toFixed(0)}" y="${(H - 36).toFixed(0)}" text-anchor="end"
        font-family="system-ui, PingFang SC, sans-serif" font-size="44"
        fill="#9c8a5e" opacity=".5">${label}</text>`;
}

/** 地球世界底图（等距圆柱 Plate Carrée）：海洋底 + 暖色大陆轮廓 */
function buildEarthSvg(bounds, size) {
  const { width: W, height: H } = size;
  const continents = [
    // 非洲
    [[-15, 14], [12, 35], [33, 31], [44, 12], [51, 11], [42, -3], [27, -34], [15, -30], [9, 2], [-8, 5]],
    // 欧亚大陆
    [[-10, 36], [5, 44], [40, 46], [55, 42], [70, 38], [90, 30], [105, 25], [120, 30], [135, 50], [158, 62], [180, 68], [180, 78], [60, 80], [10, 70], [-10, 50]],
    // 北美洲
    [[-168, 65], [-150, 71], [-95, 72], [-60, 60], [-52, 47], [-72, 40], [-82, 25], [-100, 18], [-118, 30], [-128, 42], [-145, 60]],
    // 南美洲
    [[-80, 9], [-60, 10], [-35, -5], [-40, -23], [-55, -40], [-70, -54], [-73, -38], [-79, -15], [-82, -3]],
    // 澳大利亚
    [[114, -22], [130, -12], [143, -11], [153, -28], [148, -38], [133, -32], [118, -35]],
  ];
  const landPolys = continents
    .map(
      (c) =>
        `  <polygon points="${poly(c, bounds, size)}" fill="url(#land)" stroke="#cbb98a" stroke-width="3" opacity=".95"/>`,
    )
    .join('\n');
  return `${svgOpen(W, H)}
  ${SVG_DEFS}
  <rect width="${W}" height="${H}" fill="url(#ocean)"/>
${landPolys}
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${svgTitle(W, H, '地球 · EARTH')}
</svg>`;
}

/** 亚洲底图：陆地底 + 东南/西南海域 + 喜马拉雅山带 */
function buildAsiaSvg(bounds, size) {
  const { width: W, height: H } = size;
  const oceanSE = [[112, -12], [170, -12], [170, 42], [150, 32], [132, 18], [120, 4]];
  const oceanS = [[25, -12], [112, -12], [100, 6], [78, 4], [55, 10], [38, 12], [25, 16]];
  const himalaya = [[70, 36], [85, 34], [100, 32], [95, 28], [82, 29], [72, 32]];
  return `${svgOpen(W, H)}
  ${SVG_DEFS}
  <rect width="${W}" height="${H}" fill="url(#land)"/>
  <polygon points="${poly(oceanSE, bounds, size)}" fill="url(#ocean)" opacity=".95"/>
  <polygon points="${poly(oceanS, bounds, size)}" fill="url(#ocean)" opacity=".95"/>
  <polygon points="${poly(himalaya, bounds, size)}" fill="#cdbf94" opacity=".7"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${svgTitle(W, H, '亚洲 · ASIA')}
</svg>`;
}

/** 中国底图：陆地底 + 东南海域 + 西部高原 + 长江/黄河 */
function buildChinaSvg(bounds, size) {
  const { width: W, height: H } = size;
  const oceanSE = [[118, 18], [135, 18], [135, 42], [126, 38], [121, 30], [119, 22]];
  const plateauW = [[73, 40], [88, 42], [96, 34], [92, 28], [84, 28], [78, 31], [73, 34]];
  const yangtze = [[90, 33], [98, 31], [105, 30], [110, 30], [116, 31], [122, 32]];
  const yellow = [[96, 35], [102, 36], [106, 39], [110, 37], [114, 36], [119, 38]];
  return `${svgOpen(W, H)}
  ${SVG_DEFS}
  <rect width="${W}" height="${H}" fill="url(#land)"/>
  <polygon points="${poly(oceanSE, bounds, size)}" fill="url(#ocean)" opacity=".95"/>
  <polygon points="${poly(plateauW, bounds, size)}" fill="#cdbf94" opacity=".7"/>
  <polyline points="${poly(yangtze, bounds, size)}" fill="none" stroke="#9fc6d8" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
  <polyline points="${poly(yellow, bounds, size)}" fill="none" stroke="#bcae7d" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${svgTitle(W, H, '中国 · CHINA')}
</svg>`;
}

/** 四川底图：西部横断山地 + 成都平原暖块 + 岷江 */
function buildSichuanSvg(bounds, size) {
  const { width: W, height: H } = size;
  const px = (lng, lat) => geoToPixel({ lng, lat }, bounds, size);
  const mtnW = [[97, 34], [101, 34], [101.5, 30], [101, 27], [97, 26]];
  const mtnW2 = [[97, 34], [100, 34], [100, 29], [99, 26], [97, 26]];
  const basinNW = px(103.0, 31.6);
  const basinSE = px(106.0, 29.4);
  const minRiver = [[103.0, 33.6], [103.3, 32.2], [103.6, 31.0], [103.9, 30.4], [104.1, 29.6], [104.3, 28.8]];
  return `${svgOpen(W, H)}
  ${SVG_DEFS}
  <rect width="${W}" height="${H}" fill="url(#land)"/>
  <polygon points="${poly(mtnW, bounds, size)}" fill="#cdbf94" opacity=".75"/>
  <polygon points="${poly(mtnW2, bounds, size)}" fill="#b9aa7d" opacity=".6"/>
  <rect x="${basinNW.x.toFixed(0)}" y="${basinNW.y.toFixed(0)}"
        width="${(basinSE.x - basinNW.x).toFixed(0)}" height="${(basinSE.y - basinNW.y).toFixed(0)}" rx="80"
        fill="#efd9b0" opacity=".55"/>
  <polyline points="${poly(minRiver, bounds, size)}" fill="none" stroke="#9fc6d8" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${svgTitle(W, H, '四川 · SICHUAN')}
</svg>`;
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

/** regionId → SVG 模板构造器（无模板者跳过，由设计/AI 出图替换同名 PNG） */
const BUILDERS = {
  region_earth: buildEarthSvg,
  region_asia: buildAsiaSvg,
  region_china: buildChinaSvg,
  region_sichuan: buildSichuanSvg,
  region_chengdu: buildChengduSvg,
};

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

    const builder = BUILDERS[region.id];
    if (!builder) {
      console.warn(`  ! ${region.name} 暂无插画模板，跳过`);
      skip++;
      continue;
    }

    try {
      const svg = builder(region.geoBounds, region.mapSize);
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
