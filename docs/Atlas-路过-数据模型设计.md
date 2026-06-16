# Atlas - 路过 数据模型设计

## 1. 文档目标

本文档定义“路过（Atlas）”项目的一期核心数据模型，用于前后端、Agent 与后续配置扩展统一理解。

---

## 2. 模型设计原则

1. 所有内容实体必须可配置
2. 地图、景点、动作、事件分层建模
3. 用户进度与内容配置分表管理
4. AI 任务与主业务解耦
5. 数据结构优先支持扩展，而不是一次性写死

---

## 3. 内容模型

### 3.1 Region

> **区域图（DAG），非树。** 区域是可递归下钻的节点；包含关系由**父节点的 `children` 边列表**声明，
> 而不是子节点持 `parentId`。因此同一个子节点（Region 或 Spot）可被多个父区域引用 →
> 支持多父挂载 / 跨区域归属（例如一座山同时属于某城市与某世界遗产路线），子实体只存一份，约束为无环。
> `type` 不强制对应行政区划，可混用行政层级（continent/country/province/city）与非行政分组（theme，如主题路线）。

```ts
interface RegionChildRef {
  refType: 'region' | 'spot'
  refId: string
  coord?: { x: number; y: number }   // 在父区域底图上的展示坐标（可选）
  orderIndex?: number
}

interface Region {
  id: string
  name: string
  type: 'world' | 'continent' | 'country' | 'province' | 'city' | 'theme'
  status: 'open' | 'coming_soon' | 'hidden'
  mapAsset: string
  cameraConfig: Record<string, any>
  entryAnimation?: string
  unlockRules?: Record<string, any>
  // 区域图 DAG：直接包含的子节点边列表（子 Region 与/或 Spot 混合，两者可并存）
  // 有子 Region → 可继续下钻的容器；有 Spot → 可进入景点的叶子
  children?: RegionChildRef[]
  // 区域中心/代表点经纬度（WGS84）：用于在父区域底图上投影定位本区域节点
  geo?: { lng: number; lat: number }
  // 方案 B：地图底图覆盖的经纬度范围与底图像素尺寸（子节点/景点按经纬度投影定位）
  geoBounds?: { west: number; east: number; south: number; north: number }
  mapSize?: { width: number; height: number }
}
```

> World 入口直接展示的顶层区域由种子数据集的 `worldRootRegionIds: string[]` 指定（DAG 的根集合）。
> 当前根为 `region_earth`（`type: 'world'`，等距圆柱世界底图），每层区域均配 `geo`/`geoBounds`/`mapSize`，
> 子节点用自身 `geo` 投影到父底图实现地理定位（复用投影函数 `geoToPixel`）。

### 3.2 Spot

```ts
interface Spot {
  id: string
  regionId: string   // 主归属区域（"老家"，用于资产/进度归属）；跨区域展示挂载由各父 Region.children 边表达
  name: string
  title: string
  description?: string
  coord: { x: number; y: number }
  geo?: { lng: number; lat: number }   // 方案 B：真实经纬度（WGS84），优先用于投影定位
  coverAsset?: string
  sceneAsset?: string
  tags?: string[]
  status: 'open' | 'locked' | 'hidden'
  orderIndex?: number
  unlockCondition?: Record<string, any>
}
```

### 3.3 Action

```ts
interface Action {
  id: string
  spotId: string
  type: 'check_in' | 'photo' | 'encounter' | 'random_event'
  name: string
  icon?: string
  displayOrder?: number
  unlockCondition?: Record<string, any>
  cooldown?: number
  triggerMode?: 'manual' | 'auto'
  bindEventPool?: string
  bindAiTemplate?: string
  rewardStrategy?: string
}
```

### 3.4 Event

```ts
interface Event {
  id: string
  type: string
  title: string
  description?: string
  triggerCondition?: Record<string, any>
  weight?: number
  onceOnly?: boolean
  uiTemplate?: string
  choices?: Array<Record<string, any>>
  resultPayload?: Record<string, any>
  rewardPayload?: Record<string, any>
}
```

### 3.5 Reward

```ts
interface Reward {
  id: string
  type: 'badge' | 'item' | 'card' | 'photo' | 'frame'
  name: string
  rarity?: string
  asset?: string
  grantRule?: Record<string, any>
}
```

### 3.6 AITemplate

```ts
interface AITemplate {
  id: string
  templateType: 'photo' | 'encounter' | 'postcard'
  name: string
  scenePrompt?: string
  stylePrompt?: string
  negativePrompt?: string
  inputRequirements?: Record<string, any>
  outputSchema?: Record<string, any>
  safetyRule?: Record<string, any>
}
```

---

## 4. 用户状态模型

### 4.1 UserRegionProgress

```ts
interface UserRegionProgress {
  userId: string
  regionId: string
  unlocked: boolean
  exploredSpotCount: number
  completionRate: number
  updatedAt: string
}
```

### 4.2 UserSpotProgress

```ts
interface UserSpotProgress {
  userId: string
  spotId: string
  unlocked: boolean
  firstVisitedAt?: string
  visitCount: number
  actionCount: number
  updatedAt: string
}
```

### 4.3 UserActionRecord

```ts
interface UserActionRecord {
  id: string
  userId: string
  actionId: string
  spotId: string
  resultType?: string
  eventId?: string
  createdAt: string
}
```

### 4.4 UserReward

```ts
interface UserReward {
  id: string
  userId: string
  rewardId: string
  sourceType: string
  sourceId: string
  grantedAt: string
}
```

### 4.5 UserGeneratedAsset

```ts
interface UserGeneratedAsset {
  id: string
  userId: string
  taskId: string
  assetType: 'photo' | 'postcard'
  assetUrl: string
  createdAt: string
}
```

---

## 5. AI 任务模型

### 5.1 UploadedImage

```ts
interface UploadedImage {
  id: string
  userId: string
  fileUrl: string
  mimeType: string
  status: 'uploaded' | 'blocked' | 'expired'
  createdAt: string
}
```

### 5.2 AITask

```ts
interface AITask {
  id: string
  userId: string
  templateId: string
  inputImageId?: string
  taskType: 'photo_generate' | 'encounter_generate'
  status: 'pending' | 'running' | 'success' | 'failed'
  createdAt: string
  updatedAt: string
}
```

### 5.3 AITaskResult

```ts
interface AITaskResult {
  id: string
  taskId: string
  outputUrl?: string
  outputMeta?: Record<string, any>
  errorMessage?: string
  createdAt: string
}
```

---

## 6. 关系说明

- 区域图（DAG）：一个 Region 通过 `children` 边直接包含多个子 Region 和/或多个 Spot
- 同一个 Region / Spot 可被多个父 Region 的 `children` 引用（多父挂载，无环）
- 一个 Spot 包含多个 Action
- 一个 Action 可绑定一个 Event Pool
- 一个 Event Pool 包含多个 Event
- 一个 Action 可绑定一个 AI Template
- 用户对 Region / Spot / Action / Reward 均有独立状态记录

---

## 7. 建模约束

- 所有主键统一用字符串 ID
- 所有状态值使用枚举
- 所有扩展字段保留 JSON 能力
- 配置实体与用户实体分离
- 不将用户状态冗余写入配置表

---

## 8. 交付结果

本模型作为：

- 后端建表依据
- 前端类型定义依据
- Agent 自动生成代码的数据结构依据
