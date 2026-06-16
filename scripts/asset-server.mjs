/**
 * 本地素材静态服务（模拟生产环境的对象存储 / CDN）
 *
 * 目的：素材是内容资产，不打包进前后端服务构建产物。
 * 本地用这个零依赖的静态服务托管 resources/assets/，
 * 前端通过 NEXT_PUBLIC_ASSET_BASE 指向它（默认 http://localhost:4001）。
 * 上云时把素材传到对象存储 / CDN，仅改 NEXT_PUBLIC_ASSET_BASE 即可，代码零改动。
 *
 * 用法：
 *   node scripts/asset-server.mjs            # 默认端口 4001，绑定 0.0.0.0
 *   ASSET_PORT=4100 node scripts/asset-server.mjs
 *   ASSET_HOST=127.0.0.1 node scripts/asset-server.mjs   # 仅本机可达
 */

import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = join(__dirname, '..', 'resources', 'assets');
const PORT = Number(process.env.ASSET_PORT ?? 4001);
const HOST = process.env.ASSET_HOST ?? process.env.HOST ?? '0.0.0.0';

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/** 按真实文件头判定图片类型（生成脚本按 .png 命名但实为 JPEG，需以字节为准） */
function sniffMime(buf, ext) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  return MIME[ext] ?? 'application/octet-stream';
}

const server = createServer(async (req, res) => {
  // CORS：允许前端跨端口读取
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (urlPath === '/' || urlPath === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'atlas-asset-server', dir: ASSET_DIR }));
      return;
    }

    // 防目录穿越：归一化后必须仍在 ASSET_DIR 内
    const safePath = normalize(join(ASSET_DIR, urlPath));
    if (!safePath.startsWith(ASSET_DIR)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(safePath).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', path: urlPath }));
      return;
    }

    const buf = await readFile(safePath);
    res.writeHead(200, {
      'Content-Type': sniffMime(buf, extname(safePath).toLowerCase()),
      'Content-Length': buf.length,
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Error', message: String(e) }));
  }
});

server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(
    `[asset-server] 素材服务已启动 http://${shown}:${PORT} (bind ${HOST}:${PORT})  ←  ${ASSET_DIR}`,
  );
});
