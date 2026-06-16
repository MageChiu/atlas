# @atlas/shared — 公共部分

前后端共享的**单一事实来源**：类型、API 协议契约、枚举/错误码、Mock 种子数据。
前端与后端均通过 `import { ... } from '@atlas/shared'` 引用，杜绝接口漂移与实现分叉。

## 目录结构

```
shared/src/
  enums.ts            状态枚举（SceneLevel/Region/Spot/Action/AITask...）
  errors.ts           统一错误码 ErrorCode + 默认文案
  models/             C2 数据模型
    content.ts        Region / Spot / Action / GameEvent / EventPool / Reward / AITemplate
    user.ts           UserRegionProgress / UserSpotProgress / UserActionRecord / UserReward / UserGeneratedAsset
    ai.ts             UploadedImage / AITask / AITaskResult
  contracts/          C3 API 协议契约
    common.ts         ApiResponse 包络 + IdempotentRequest
    routes.ts         ApiRoutes 路由常量
    content.ts        world / region / spot / actions 响应类型
    action.ts         check-in / execute-action 请求与响应类型
    ai.ts             upload / photo-generate / task / result 类型
    me.ts             collections / generated-assets / achievements 类型
  seed/               C5 Mock 种子数据
    types.ts          SeedDataset 容器类型
    dataset.ts        seedDataset：1 Region + 6 Spot + Actions + Event/Reward/AITemplate
  index.ts            统一导出入口
```

## 使用

```ts
import { ApiRoutes, ErrorCode, seedDataset } from '@atlas/shared';
import type { ApiResponse, SpotDetailData, ExecuteActionData } from '@atlas/shared';
```

- 前端：用 `seedDataset` 构建 Mock 服务，用契约类型约束请求层。
- 后端：用 `seedDataset` 做 DB seed，用契约类型约束 Controller 返回。

构建：`npm run build -w @atlas/shared`

---

## C6 - 地图层级约定

四层抽象（`SceneLevel`），切换统一由前端 Scene / Camera 机制管理，不用页面跳转替代：

```
World  ──进入Region──▶  Region  ──进入Spot──▶  Spot  ──执行Action──▶  Event Layer
  ◀────返回────────────         ◀────返回───────        ◀──结果展示完毕回到Spot──
```

| 层级 | 对应接口 | 说明 |
| --- | --- | --- |
| World | `GET /api/world` | 世界概貌 + 开放区域 |
| Region | `GET /api/regions/{id}` | 区域内 Spot 节点与进度 |
| Spot | `GET /api/spots/{id}` + `/actions` | 景点主视觉 + 可执行 Action |
| Event Layer | （execute 返回的 event） | 承接 Action 结果，展示后回到 Spot |

## C6 - Action 执行状态流转

```
点击 Action
   │  POST /api/actions/{id}/execute (携带 requestId 幂等)
   ▼
loading（执行中）
   │
   ▼
后端标准流程：登录校验 → Action 校验 → 开放/解锁校验 → 前置/冷却校验
            → 写行为记录 → 选事件 → 发奖励/建 AI 任务
   │
   ▼
统一返回 ExecuteActionData { actionId, event, reward, aiTask, progress }
   ├─ event   → EventModal / EncounterPanel 展示
   ├─ reward  → RewardPopup 展示
   └─ aiTask  → 进入 AI 任务异步流转（见下）
```

失败时返回 `ApiError { success:false, code, message }`，code 取自 `ErrorCode`
（如 `ACTION_COOLDOWN` / `ACTION_NOT_AVAILABLE` / `SPOT_NOT_UNLOCKED`）。

## C6 - AI 任务异步流转

```
上传图片  POST /api/uploads/image  ──▶  imageId
   │
   ▼
提交任务  POST /api/ai/photo-generate  ──▶  taskId, status=pending
   │
   ▼   （后端推入队列，Worker 消费）
pending ──▶ running ──▶ success / failed
   │
   ▼   前端轮询
GET /api/ai/tasks/{id}      查询状态
GET /api/ai/results/{id}    success 后取结果（outputUrl）→ 结果页展示 / 回写生成记录
```

所有 AI 任务必须异步化；任务状态枚举见 `AITaskStatus`。

---

## 公共部分出口标准（已满足，基线冻结）

- [x] 共享类型（C2）：内容 / 用户 / AI 任务模型完整
- [x] API 协议契约（C3）：含通用包络、路由常量、各域请求/响应类型
- [x] 错误码与状态枚举（C4）：集中定义、前后端共用
- [x] Mock 种子数据（C5）：1 Region + 6 Spot + 全 4 类 Action + Event/Reward/AITemplate
- [x] 状态流转与层级约定（C6）：本文件
- [x] `tsc` 构建通过

> 满足以上，**解锁** 前端（`tasks/02-前端.md`）与后端（`tasks/01-后端.md`）并行开发。
