# Atlas - 路过 素材资源临时方案

> 适用阶段：MVP / 联调前。目标是在没有 CDN / 对象存储的情况下，让前端可视化跑通，
> 并为后续切换正式素材存储留好接口。

---

## 1. 城市与层级

地图层级（依据技术方案四层抽象）当前落地为真实地理层级：

```
地球(World) → 亚洲 → 中国 → 四川 → 成都(Region) → 景点(Spot)
```

MVP 首个 Region 选用**成都**（`region_chengdu`，type=city，status=open）。

---

## 2. 成都景点序列（真实地点）

| 顺序 | 景点 | spotId | 状态 | Action 覆盖 |
| --- | --- | --- | --- | --- |
| 1 | 杜甫草堂 | `spot_dufu_thatched_cottage` | open | check_in / photo / random_event |
| 2 | 武侯祠 | `spot_wuhou_shrine` | open | check_in / random_event |
| 3 | 锦里古街 | `spot_jinli` | open | check_in / encounter / random_event |
| 4 | 宽窄巷子 | `spot_kuanzhai_alley` | open | check_in / photo |
| 5 | 成都大熊猫繁育研究基地 | `spot_panda_base` | open | check_in / photo / encounter |
| 6 | 春熙路 | `spot_chunxi_road` | open | check_in / random_event |
| 7 | 都江堰 | `spot_dujiangyan` | locked（打卡满 3 个景点解锁） | check_in |
| 8 | 青城山 | `spot_qingcheng_mountain` | locked（打卡满 4 个景点解锁） | check_in / encounter |

- 全部为真实成都地点；都江堰、青城山是“青城山-都江堰”世界文化遗产，设为后期解锁，体现地图探索递进。
- 4 类 Action（check_in / photo / encounter / random_event）在以上景点中均有覆盖。
- 数据源唯一：`shared/src/seed/dataset.ts` 的 `seedDataset`，前端 Mock 与后端 seed 共用。

---

## 3. 素材临时存放方案：仓库级 resources 目录 + 独立素材服务

**核心原则：素材是内容资产，不打包进前后端服务的构建产物。** 生产将采用云上部署，
景点素材应放对象存储 / CDN，而非进入服务镜像。本地据此模拟同一架构：

```
resources/assets/                 ← 仓库根，独立于 frontend / backend 工程
  regions/region_chengdu/map.png
  spots/{spotId}/cover.png        # 方图，节点/列表
  spots/{spotId}/scene.png        # 16:9，SpotScene 主视觉
  rewards/{rewardId}.png          # 非实景（徽章/卡牌），由前端占位兜底
  icons/{check_in|photo|encounter|random}.png  # 非实景图标，占位兜底
```

- 本地由零依赖的静态服务 `scripts/asset-server.mjs` 托管该目录（默认端口 `4001`，模拟 CDN）。
- 前端通过 `NEXT_PUBLIC_ASSET_BASE`（默认 `http://localhost:4001`）访问素材。
- **`frontend/public/` 下不再放素材**，确保 `next build` 产物不含任何景点素材。
- 上云：把 `resources/assets/` 上传到对象存储 / CDN，仅改 `NEXT_PUBLIC_ASSET_BASE` 一个变量，代码与种子数据零改动。

---

## 4. 素材来源：开放图库（真实景点照）

景点与区域的真实照片由 `scripts/gen-assets.mjs` 从 **Wikipedia / Wikimedia Commons** 拉取：

- 脚本读取 `@atlas/shared` 的 `seedDataset`，按 `spotId → 中文词条` 映射取词条主图，
  下载落地为 `spots/{spotId}/scene.png` 与 `cover.png`（同源真实照，前端按 `object-cover` 适配）。
- rewards 徽章卡牌、icons 动作图标**非实景**，图库无对应物，不生成，运行时占位兜底。
- 限流退避重试、缩略图宽度控制体积。

### 4.1 区域插画底图（方案 B，`scripts/gen-region-map.mjs`）

区域地图**不**用城市照片，而是用风格化插画底图，便于景点按经纬度投影打点对位：

- 脚本读取 `region.geoBounds` / `region.mapSize`，用 `@atlas/shared` 的 `geoToPixel`
  把山地、岷江/府南河、市区暖块、绿地等地物按真实经纬度投影到 SVG（坐标系 = mapSize），
  再用系统 `rsvg-convert` 转为 PNG，落地 `regions/{regionId}/map.png`（覆盖照片）。
- 生成前用 `assertBoundsRatio` 校验 bbox 比例与底图宽高比一致（成都偏差 0.1%）。
- 依赖：`rsvg-convert`（macOS：`brew install librsvg`）。
- 命令：`npm run assets:map`（生成缺失）/ `npm run assets:map -- --force`（覆盖）。
- 正式版可由设计/AI 出图替换同名 PNG（保持 mapSize 比例），代码与种子数据零改动。

> 注：之前尝试过的 `text_to_image` 接口在脚本环境恒返回同一张固定占位图，不可用于真实生成，故改用开放图库。

生成命令：

```bash
npm run assets:gen          # 仅补缺失
./run.sh assets --force     # 覆盖重新生成
```

许可：Wikimedia 多为 CC 许可，MVP 演示可用；**正式上线前需逐张核对许可与署名，或替换为自有/可商用素材。**

---

## 5. 解析与回退机制

前端 `src/utils/assets.ts` 统一解析，组件**不直接拼路径**：

1. `resolveSpotScene(spot)` / `resolveSpotCover(spot)` / `resolveReward(reward)`
   返回 `{ src, fallback }`：
   - `src`：种子相对路径（如 `spots/spot_jinli/scene.png`）拼 `NEXT_PUBLIC_ASSET_BASE` → 素材服务 URL。
   - `fallback`：文生图占位（按景点标题/奖励名生成）。
2. 组件 `<img src={src} onError={切到 fallback}>`：
   - **素材服务有图** → 显示真实照片。
   - **缺图（如 rewards/icons）** → 自动回退占位图，页面不空缺。

因此：**素材服务未起或缺图也能跑通；有素材时即生效，无需改代码。**

---

## 6. 本地运行

`./run.sh dev` 会自动：检测 `resources/assets` 缺失则生成 → 启动素材服务（4001）→ 启动前后端。
单独控制：

```bash
npm run assets:gen      # 生成素材
npm run assets:serve    # 仅启动素材服务
```

切换正式存储（上云）：把 `resources/assets/` 上传到对象存储 / CDN，将
`NEXT_PUBLIC_ASSET_BASE` 改为 CDN 基址（如 `https://cdn.example.com/atlas`）即可，
种子数据相对路径、组件代码均无需改动。

---

## 7. 约束

- 素材路径只来自 `seedDataset` 字段（`mapAsset` / `coverAsset` / `sceneAsset` / `asset` / `icon`），禁止在组件里写死。
- 占位图仅用于素材缺失兜底，不作为正式视觉。
- 真实素材需注意版权，正式上线前替换为可商用素材。
