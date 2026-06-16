# resources/assets — 项目素材资产（不打包进服务）

本目录是**仓库级内容资产**，独立于 `frontend/` 与 `backend/` 工程，**不会进入任何服务的构建产物**。
本地由 `scripts/asset-server.mjs` 托管（默认 `http://localhost:4001`），模拟生产的对象存储 / CDN。

## 目录结构（命名与 `@atlas/shared` 种子字段一一对应）

```
resources/assets/
  regions/{regionId}/map.png        Region.mapAsset
  spots/{spotId}/cover.png          Spot.coverAsset（方图，列表/节点）
  spots/{spotId}/scene.png          Spot.sceneAsset（16:9，SpotScene 主视觉）
  rewards/{rewardId}.png            Reward.asset（非实景，占位兜底）
  icons/{type}.png                  Action.icon（非实景，占位兜底）
```

## 素材来源

- **景点 / 区域**：`scripts/gen-assets.mjs` 从 Wikipedia/Wikimedia 拉取真实照片。
  - `npm run assets:gen`（补缺）/ `./run.sh assets --force`（重生成）
- **rewards / icons**：非实景，图库无对应物，未生成，运行时前端占位兜底。

## 注意

- 不要把素材放到 `frontend/public/`（会被打进前端产物）。
- Wikimedia 素材多为 CC 许可，正式上线前需核对许可与署名或替换为可商用素材。
- 上云：整目录上传对象存储/CDN，改前端 `NEXT_PUBLIC_ASSET_BASE` 即可，代码零改动。
