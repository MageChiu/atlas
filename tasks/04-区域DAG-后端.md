# 04 - 区域图（DAG）下钻 · 后端任务（独立交付）

> 本文件可独立交付给**后端 Agent**，无需阅读其他任务文件即可执行。
> 背景：区域模型已从"扁平单层 Region"升级为**显式边列表的区域图（DAG）**。公共部分（`@atlas/shared`）已改完并构建通过，
> 本任务是让后端两个内容接口按新契约**正确拆分返回**子区域与景点。
>
> 约束遵循 `docs/Atlas-路过-后端开发规范.md` 与 `docs/Atlas-路过-协作开发规范.md`：返回类型取自 `@atlas/shared`，不另立结构；契约以 shared 为唯一事实来源。

---

## 1. 背景：公共部分已就绪的契约（直接复用，勿重复定义）

`@atlas/shared` 已变更（已 `npm run build:shared` 通过）：

- 新枚举 `RegionChildType = { Region:'region', Spot:'spot' }`；`RegionType` 扩展为 `continent/country/province/city/theme`。
- `Region` 新增 `children?: RegionChildRef[]`：
  ```ts
  interface RegionChildRef { refType: 'region' | 'spot'; refId: string; coord?: {x,y}; orderIndex?: number }
  ```
  - 含义：**父节点声明它直接包含哪些子节点**（子 Region 与/或 Spot 混合）。
  - 同一个 `refId` 可被多个父 Region 引用 → 多父挂载、跨区域归属（DAG，无环）。
- `Spot.regionId` 语义收敛为**主归属**（资产/进度归属），**不再代表唯一展示父级**；展示挂载一律走 `Region.children` 边。
- `SeedDataset` 新增 `worldRootRegionIds: string[]`：World 入口直接展示的顶层区域 id（DAG 根集合，当前为 `['region_asia']`）。
- 契约类型 `RegionDetailData` 已新增 `childRegions` 字段：
  ```ts
  interface RegionDetailData { region: Region; childRegions: Region[]; spots: Spot[]; progress?: UserRegionProgress }
  ```

种子现状（`shared/src/seed/dataset.ts`）：
```
worldRootRegionIds = ['region_asia']
region_asia(continent)   → children: [region_china]
region_china(country)    → children: [region_sichuan]
region_sichuan(province) → children: [region_chengdu, region_qingcheng_dujiangyan_heritage]
region_chengdu(city)     → children: [8 个 spot...含 spot_dujiangyan, spot_qingcheng_mountain]
region_qingcheng_dujiangyan_heritage(theme) → children: [spot_dujiangyan, spot_qingcheng_mountain]  // 多父
```

---

## 2. 现状（要改的）

- [`backend/src/store/config.repository.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/src/store/config.repository.ts)：
  - `listSpotsByRegion(regionId)` 按 `spot.regionId === regionId` 过滤。**问题**：跨区域挂载（如遗产路线 region 引用成都的景点）取不到；且未利用 `children` 边/顺序。
  - 无 `worldRootRegionIds`、无"取子区域"能力。
- [`backend/src/content/content.service.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/src/content/content.service.ts)：
  - `getWorld` 返回**所有**非隐藏 region（会把亚洲/中国/四川/成都/遗产路线全平铺到世界层）。**问题**：应只返回顶层根集合。
  - `getRegionDetail` 只返回 `{ region, spots, progress }`，**缺 `childRegions`**，且 `spots` 来源同样是错的过滤方式。

---

## 3. 任务

### TB04-1 ConfigRepository 增加按边解析的能力
- [x] 暴露顶层根集合：`listWorldRootRegions(): Region[]`，依据 `seedDataset.worldRootRegionIds` 取（保序，过滤掉 `status===hidden`）。
- [x] 新增 `listChildRegions(regionId): Region[]`：读父 `region.children` 中 `refType==='region'` 的 `refId`，按 `orderIndex` 排序解析为 Region（跳过解析不到的，过滤 hidden）。
- [x] 新增 `listChildSpots(regionId): Spot[]`：读父 `region.children` 中 `refType==='spot'` 的 `refId`，按 `orderIndex` 排序解析为 Spot（跳过解析不到的）。
- [x] 兼容回退：若某 region 没有 `children`（旧数据），`listChildSpots` 回退到原 `spot.regionId === regionId` 过滤逻辑，保证不破坏既有行为。
- [x] 保留/调整原 `listSpotsByRegion`：内部改为调用 `listChildSpots`，并标注 `@deprecated`。

### TB04-2 ContentService 按 DAG 返回
- [x] `getWorld`：改用 `listWorldRootRegions()`，只返回顶层区域；`regionProgress` 对这批 region 计算。
- [x] `getRegionDetail`：返回 `{ region, childRegions: listChildRegions(id), spots: listChildSpots(id), progress }`。
  - 容器区域（亚洲/中国/四川）：`childRegions` 非空、`spots` 多为空。
  - 叶子区域（成都/遗产路线）：`childRegions` 空、`spots` 非空。
  - 两者可并存（实现上不要互斥，原样返回各自结果）。

### TB04-3 验证
- [x] `npm run build:backend` 通过（注意 `RegionDetailData` 新增必填 `childRegions`，旧返回点会编译报错，需补齐）。
- [x] 更新 `backend/scripts/smoke.mjs` 的 world/region 断言（DAG 根集合 + 沿 childRegions 下钻 + 多父挂载），启动后端实测全部通过（39/39）：
  ```
  curl -s .../api/world            | jq '.data.regions | map(.id)'   # ['region_asia'] ✅
  curl -s .../api/regions/region_sichuan | jq '{child:(.data.childRegions|map(.id)), spots:(.data.spots|map(.id))}'
      # child=['region_chengdu','region_qingcheng_dujiangyan_heritage'], spots=[] ✅
  curl -s .../api/regions/region_qingcheng_dujiangyan_heritage | jq '.data.spots | map(.id)'
      # ['spot_dujiangyan','spot_qingcheng_mountain']（与成都共享，多父挂载）✅
  ```

---

## 4. 验收
- [x] `/api/world` 只返回顶层根集合（`region_asia`），不再平铺所有区域。
- [x] `/api/regions/{id}` 返回 `childRegions` 与 `spots`，容器区域可下钻、叶子区域出景点。
- [x] 遗产路线 region 能取到与成都共享的 `spot_dujiangyan`/`spot_qingcheng_mountain`（多父挂载生效）。
- [x] 未新增脱离 `@atlas/shared` 的返回结构；`npm run build:backend` 通过。

> 注：本任务不改 `/api/spots/{id}` 与 Action 链路；`Spot.regionId` 仍用于资产/进度归属，无需改动其语义。
