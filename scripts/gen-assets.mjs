/**
 * 素材生成脚本（从开放图库 Wikipedia/Wikimedia 拉取真实景点照片）
 *
 * 真实地标照片来源：Wikipedia REST summary API 的 originalimage，
 * 图片托管在 Wikimedia Commons（多为 CC 许可，MVP 演示可用，正式上线需逐张核对许可与署名）。
 *
 * 落地到仓库根 resources/assets/（不进任何服务构建包）。
 * 资源路径严格对应 seed 字段：spots/{spotId}/{scene,cover}.png、regions/{regionId}/map.png。
 * scene 与 cover 同源（同一张真实照片），前端按 object-cover 裁切适配方图/宽图。
 *
 * 非实景素材（rewards 徽章卡、icons 动作图标）图库没有对应物，
 * 不在此脚本生成，运行时由前端占位兜底。
 *
 * 用法：
 *   node scripts/gen-assets.mjs            # 仅生成缺失
 *   node scripts/gen-assets.mjs --force    # 覆盖重新生成
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedDataset } from '@atlas/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ASSET_DIR = join(ROOT, 'resources', 'assets');
const WIKI_SUMMARY = 'https://zh.wikipedia.org/api/rest_v1/page/summary/';
const UA = 'AtlasBot/0.1 (MVP asset fetcher)';

const FORCE = process.argv.slice(2).includes('--force');

/** spotId → Wikipedia 中文词条标题（真实地标，用精确词条避免消歧义页） */
const SPOT_WIKI = {
  spot_dufu_thatched_cottage: '杜甫草堂',
  spot_wuhou_shrine: '成都武侯祠',
  spot_jinli: '锦里',
  spot_kuanzhai_alley: '宽窄巷子',
  spot_panda_base: '成都大熊猫繁育研究基地',
  spot_chunxi_road: '春熙路',
  spot_dujiangyan: '都江堰',
  spot_qingcheng_mountain: '青城山',
};

/** 缩略图目标宽度（控制体积，避免下载数 MB 原图） */
const THUMB_WIDTH = 1280;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** regionId → Wikipedia 词条（区域地图缺真实地图素材时，用城市实景兜底） */
const REGION_WIKI = {
  region_chengdu: '成都市',
};

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** 取词条主图 URL（优先按目标宽度取缩略图，控制体积） */
async function fetchWikiImage(title) {
  const res = await fetch(WIKI_SUMMARY + encodeURIComponent(title), {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`summary HTTP ${res.status}`);
  const json = await res.json();
  if (json.type === 'disambiguation') throw new Error('消歧义页，请用精确词条');
  // thumbnail.source 形如 .../thumb/x/xx/Name.jpg/330px-Name.jpg，把宽度替换为目标值
  const thumb = json.thumbnail?.source;
  if (thumb) {
    const widened = thumb.replace(/\/\d+px-([^/]+)$/, `/${THUMB_WIDTH}px-$1`);
    return widened;
  }
  const orig = json.originalimage?.source;
  if (orig) return orig;
  throw new Error('词条无主图');
}

/** 下载图片到指定相对路径（429 限流时退避重试） */
async function download(url, relPath, attempt = 0) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (res.status === 429 && attempt < 4) {
    const wait = 1500 * (attempt + 1);
    await sleep(wait);
    return download(url, relPath, attempt + 1);
  }
  if (!res.ok) throw new Error(`image HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2048) throw new Error(`too small (${buf.length} bytes)`);
  const outPath = join(ASSET_DIR, relPath);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buf);
  return buf.length;
}

/** 解析一个实体的真实照片，写入其 scene/cover（或区域 map） */
async function processEntity(label, title, relPaths) {
  const targets = FORCE ? relPaths : [];
  if (!FORCE) {
    for (const rp of relPaths) if (!(await exists(join(ASSET_DIR, rp)))) targets.push(rp);
  }
  if (targets.length === 0) {
    console.log(`  - skip  ${label}（已存在）`);
    return { ok: 0, skip: relPaths.length };
  }
  const imgUrl = await fetchWikiImage(title);
  let bytes = 0;
  for (const rp of targets) bytes = await download(imgUrl, rp);
  console.log(`  ✓ ok    ${label} ← 《${title}》 (${(bytes / 1024).toFixed(0)}KB) → ${targets.join(', ')}`);
  return { ok: targets.length, skip: relPaths.length - targets.length };
}

async function main() {
  console.log(`[gen-assets] 来源：Wikipedia 真实景点照；输出：${ASSET_DIR}`);
  console.log(`[gen-assets] force=${FORCE}\n`);

  let ok = 0;
  let skip = 0;
  let fail = 0;

  // 区域：用城市实景兜底 map
  for (const r of seedDataset.regions) {
    const title = REGION_WIKI[r.id];
    if (!title || !r.mapAsset) continue;
    try {
      const res = await processEntity(`region ${r.name}`, title, [r.mapAsset]);
      ok += res.ok;
      skip += res.skip;
    } catch (e) {
      fail++;
      console.warn(`  ✗ fail  region ${r.name}: ${e.message}`);
    }
  }

  // 景点：scene + cover 同源真实照
  for (const s of seedDataset.spots) {
    const title = SPOT_WIKI[s.id];
    if (!title) {
      console.warn(`  ! 未配置词条映射：${s.id}（${s.title}），跳过`);
      continue;
    }
    const relPaths = [s.sceneAsset, s.coverAsset].filter(Boolean);
    try {
      const res = await processEntity(s.title, title, relPaths);
      ok += res.ok;
      skip += res.skip;
    } catch (e) {
      fail++;
      console.warn(`  ✗ fail  ${s.title}: ${e.message}`);
    }
    await sleep(800); // 节流，规避 Wikimedia 限流
  }

  console.log(`\n[gen-assets] 完成：生成 ${ok}，跳过 ${skip}，失败 ${fail}`);
  console.log('[gen-assets] 注：rewards 卡牌徽章与 icons 动作图标非实景，由前端占位兜底。');
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('[gen-assets] 致命错误：', e);
  process.exit(1);
});
