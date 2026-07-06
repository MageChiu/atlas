# 04 - 区域图（DAG）下钻 · 前端任务（独立交付）

> 本文件可独立交付给**前端 Agent**，无需阅读其他任务文件即可执行。
> 背景：区域模型已从"扁平单层 Region"升级为**显式边列表的区域图（DAG）**：World 入口只显示顶层区域，
> Region 层既可能是"可继续下钻的容器（含子区域）"、也可能是"出景点的叶子"，两者可并存。
> 公共部分（`@atlas/shared`）已改完并构建通过。
>
> 约束遵循 `docs/Atlas-路过-前端开发规范.md` 与 `docs/Atlas-路过-协作开发规范.md`：
> 层级切换由 Scene/Camera 驱动（**禁止用 router.push 替代下钻**）、配置不写死、类型取自 `@atlas/shared`。

---

## 1. 背景：公共部分已就绪的契约（直接复用）

- `Region.children?: RegionChildRef[]`，`RegionChildRef = { refType:'region'|'spot'; refId; coord?; orderIndex? }`。
  父节点声明它直接包含的子节点（子 Region 与/或 Spot）。
- `RegionType` 扩展为 `continent/country/province/city/theme`。
- 契约 `RegionDetailData` 已新增 `childRegions`：
  ```ts
  interface RegionDetailData { region: Region; childRegions: Region[]; spots: Spot[]; progress?: UserRegionProgress }
  ```
- `SeedDataset.worldRootRegionIds: string[]`：World 入口直接展示的顶层区域（当前 `['region_asia']`）。

种子区域图（用于自测预期）：
```
World 入口 → region_asia(亚洲)
  region_asia   → 子区域 [region_china]
  region_china  → 子区域 [region_sichuan]
  region_sichuan→ 子区域 [region_chengdu(成都), region_qingcheng_dujiangyan_heritage(遗产路线)]
  region_chengdu→ 8 个景点
  region_qingcheng_dujiangyan_heritage → 景点 [都江堰, 青城山]（与成都共享）
```

---

## 2. 现状（要改的）

- [`mockApi.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/frontend/src/services/mock/mockApi.ts)：
  - `getWorld()` 返回 `{ regions: seedDataset.regions }`（**平铺所有区域**，错误）。
  - `getRegion()` 返回 `{ region, spots }`，`spots` 按 `s.regionId === regionId` 过滤，**缺 `childRegions`**、且跨区域挂载取不到。
- [`SceneStage.tsx`](file:///Users/zhaopeng.charles/code/magechiu/atlas/frontend/src/scenes/components/SceneStage.tsx)：
  - World 层渲染 `world.regions`；Region 层只渲染 `region.spots`（**不渲染子区域**）。
  - 点击下钻只有 World→Region→Spot 两步，**没有 Region→Region 的多级下钻**。
  - `handleNodeClick` 在 World 层一律 `enterRegion`，在 Region 层一律 `enterSpot`——无法区分"点到的是子区域还是景点"。
- [`sceneStore.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/frontend/src/stores/sceneStore.ts)：
  - `currentRegionId` 是单值，`backToWorld/backToRegion` 假设只有一层 region，**无法表达多级区域栈**。
- 后端真实接口（联调阶段）已按相同契约调整（见 `tasks/04-区域DAG-后端.md`），Mock 与真实结构需保持一致。

---

## 3. 任务

### TF04-1 Mock 对齐新契约（`services/mock/mockApi.ts`）
- [x] `getWorld()`：用 `seedDataset.worldRootRegionIds` 解析出顶层区域，返回 `{ regions: 顶层区域[] }`。
- [x] `getRegion(regionId)`：返回 `{ region, childRegions, spots, progress? }`：
  - `childRegions`：读 `region.children` 中 `refType==='region'` 的 refId，按 `orderIndex` 解析为 Region。
  - `spots`：读 `region.children` 中 `refType==='spot'` 的 refId，按 `orderIndex` 解析为 Spot；无 `children` 时回退 `s.regionId===regionId`。
- [x] 与真实接口结构完全一致（联调零字段改动）。

### TF04-2 区域层级栈（`stores/sceneStore.ts`）
- [x] 支持多级区域下钻：把 `currentRegionId: string|null` 升级为**区域栈** `regionStack: string[]`（或新增之，保留 `currentRegionId = 栈顶` 派生）。
- [x] `enterRegion(id)`：压栈并设 `currentLevel = Region`。
- [x] 回退：`backOneLevel()`——Region 层出栈一级（栈空则回 World）；Spot 层回到栈顶 Region。`backToWorld()` 清空栈。
- [x] 保持现有 `beginTransition/endTransition` 转场状态机不变。

### TF04-3 场景渲染：容器区域显示子区域 + 叶子区域显示景点（`SceneStage.tsx` + `mappers.ts`）
- [x] Region 层节点数据 = `childRegions.map(regionStateToNode)` ∪ `spots.map(s => spotStateToNode(s, region))`，两类可并存。
- [x] 节点需携带"类型"标记（region / spot），供点击分发与样式区分：
  - 建议给 `NodeDatum` 增一个 `kind?: 'region' | 'spot'`（前端局部类型，非契约），或用现有 id 前缀判断（不推荐，脆弱）。
- [x] `handleNodeClick` 改为按节点 `kind` 分发：
  - `kind==='region'` → `enterRegion(id)` + 进入相机动画（继续下钻，**不是** enterSpot）。
  - `kind==='spot'` → `enterSpot(id)` + 进入相机动画。
  - World 层点击仍 `enterRegion`。
- [x] `mappers.ts`：子区域节点定位——优先用该子区域在父 `children` 边里的 `coord`，否则沿用 `regionStateToNode` 的索引散布；景点定位维持现有经纬度投影逻辑（`spotStateToNode(spot, region)`）。
- [x] 底图（TF-1 既有逻辑）：仅当 `region.mapSize && region.geoBounds` 齐全时设底图（叶子城市如成都有，容器区域可无底图，走纯色背景，不崩溃）。

### TF04-4 面包屑/回退（`scenes/components/SceneHud.tsx`）
- [x] 面包屑反映区域栈：World › 亚洲 › 中国 › 四川 › 成都 ›（Spot）。
- [x] 回退按钮调用 `backOneLevel()`，逐级镜像相机回退动画（不是直接跳回 World）。

---

## 4. 执行顺序
1. TF04-1 Mock 对齐（数据先行，后续 UI 才有正确数据）
2. TF04-2 区域栈
3. TF04-3 渲染与点击分发
4. TF04-4 面包屑回退
5. 验收（第 5 章）

## 5. 验收
- [x] 进入 `/world` 只看到顶层"亚洲"，不再平铺所有区域。
- [x] 可逐级下钻：亚洲 → 中国 → 四川 → 成都，且在四川层能看到"成都"和"青城山-都江堰世界遗产路线"两个子区域入口。
- [x] 成都层出现 8 个景点（经纬度投影底图，沿用既有逻辑）；点击景点进入 Spot。
- [x] 进入遗产路线区域，能看到都江堰、青城山（与成都共享的同一实体）。
- [x] 逐级回退动画正确，面包屑层级正确；缺底图的容器区域不崩溃。
- [x] 前端 `npm run build:web` 通过；Mock 与真实接口结构一致。

> 涉及源文件：`services/mock/mockApi.ts`、`stores/sceneStore.ts`、`scenes/components/SceneStage.tsx`、`scenes/mappers.ts`、`scenes/components/SceneHud.tsx`、`scenes/runtime/SceneRuntime.ts`（NodeDatum 若加 kind）。
