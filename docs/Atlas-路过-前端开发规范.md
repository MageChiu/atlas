# Atlas - 路过 前端开发规范

> 适用对象：前端开发 Agent / 工程师
> 上位依据：`Atlas-路过-MVP-技术方案.md`、`Atlas-路过-前端技术设计.md`、`Atlas-路过-API协议说明.md`、`Atlas-路过-数据模型设计.md`、`tasks/02-前端.md`
> 契约依据：`@atlas/shared`（公共部分已冻结，类型/协议/枚举/Mock 的唯一事实来源）

本规范是约束性文档。出现实现分歧时，优先级：**`@atlas/shared` 契约 > 本规范 > 个人习惯**。

---

## 1. 技术栈（锁定，不得擅自替换）

| 维度 | 选型 |
| --- | --- |
| 框架 | React + Next.js（App Router） |
| 语言 | TypeScript（`strict: true`） |
| 场景渲染 | PixiJS |
| 动画 | GSAP |
| 状态管理 | Zustand |
| 数据请求 | TanStack Query |
| 样式 | Tailwind CSS |
| 共享契约 | `@atlas/shared` |

---

## 2. 分层架构（强制三层）

```
App Shell 层    —— 登录态 / 路由 / 页头页尾 / 全局弹窗 / 我的·图鉴·分享页
Scene Runtime 层 —— WorldScene / RegionScene / SpotScene / EventLayer（PixiJS）
Domain UI 层     —— Action 面板 / EventModal / RewardPopup / EncounterPanel / 结果页
```

铁律：
- **场景（Scene）与产品 UI（DOM）分层解耦**，不得互相直接 import 内部实现。
- 地图层级切换**只能**由 Scene Runtime + Camera 驱动，**禁止**用 `router.push` 做层级跳转。
- 景点/事件/动作的业务规则**不得写死在组件**，一律来自接口或 `@atlas/shared` Mock 配置。

---

## 3. 目录结构（统一）

```
frontend/src/
  app/                  Next.js 路由：/ /world /region/[id] /spot/[id] /collections /generated /share/[id]
  components/           通用展示组件（无业务）
  scenes/
    world/  region/  spot/  event/   各层 Pixi 场景与容器
  stores/               authStore / sceneStore / progressStore / actionStore / uiStore
  services/
    api/                请求层（按域：content / action / ai / me）
    mock/               基于 @atlas/shared seedDataset 的 Mock 适配
  hooks/                useWorld / useRegionDetail / useSpotDetail / useExecuteAction ...
  camera/               Camera 抽象与转场
  types/                仅前端局部类型（业务类型一律取自 @atlas/shared）
  utils/
  assets/
```

---

## 4. 类型与契约使用规范

- 所有跨端业务类型**必须** `import type { ... } from '@atlas/shared'`，**禁止**在前端重复声明 `Region/Spot/Action/...`。
- 接口路径**必须**使用 `ApiRoutes.*()`，禁止硬编码字符串路径。
- 响应一律按 `ApiResponse<T>` 处理；错误分支读取 `code: ErrorCode` 并做本地化提示。
- 枚举判断**必须**用 `@atlas/shared` 导出的枚举常量（如 `ActionType.CheckIn`），禁止裸字符串字面量。

```ts
import { ApiRoutes, ActionType } from '@atlas/shared';
import type { ApiResponse, SpotDetailData } from '@atlas/shared';
```

---

## 5. 数据请求层规范

- 统一通过 `services/api` 封装，底层 `fetch` 包一层 `request<T>()`，自动解包 `ApiResponse<T>`，错误抛出携带 `code`。
- **查询（Query）用 TanStack Query**，Mutation 用 `useMutation`。Query key 约定：
  - `['world']`、`['region', regionId]`、`['spot', spotId]`、`['spotActions', spotId]`、`['collections']`、`['generatedAssets']`、`['achievements']`
- **写操作必须携带 `requestId`**（幂等），用 `crypto.randomUUID()` 生成，对应 `IdempotentRequest`。
- Mock 切换由环境变量 `NEXT_PUBLIC_USE_MOCK` 控制，Mock 与真实接口**返回结构必须完全一致**（均来自 `@atlas/shared` 契约类型）。

| 维度 | Query / Mutation | 接口 |
| --- | --- | --- |
| world | `useWorld` | `GET /api/world` |
| region | `useRegionDetail(id)` | `GET /api/regions/{id}` |
| spot | `useSpotDetail(id)` | `GET /api/spots/{id}` |
| actions | `useSpotActions(id)` | `GET /api/spots/{id}/actions` |
| check-in | `useCheckIn` | `POST /api/spots/{id}/check-in` |
| execute | `useExecuteAction` | `POST /api/actions/{id}/execute` |
| upload | `useUploadImage` | `POST /api/uploads/image` |
| generate | `useSubmitGenerate` | `POST /api/ai/photo-generate` |
| task/result | `usePollTask(taskId)` | `GET /api/ai/tasks/{id}` `GET /api/ai/results/{id}` |

---

## 6. 状态管理规范（Zustand）

- 五个 store 职责单一，**禁止跨 store 直接写**对方状态，通过 action 方法调用。
- `sceneStore` 关键字段：`currentLevel`(SceneLevel) / `currentRegionId` / `currentSpotId` / `cameraState` / `transitionState`。
- `actionStore` 关键字段：`availableActions` / `executingActionId` / `lastActionResult` / `cooldownMap`。
- 服务端数据缓存归 **TanStack Query**，Zustand 只存**会话/交互态**，不重复缓存后端实体。

---

## 7. 场景与相机规范

- Camera 统一抽象（前端实现，参数从 `Region.cameraConfig` 读取，不写死）：
  `zoomTo(target)` / `panTo(target)` / `focusOn(target)` / `transitionTo(level)` / `resetView()`
- 进入动画与回退动画**互为镜像**；转场期间锁交互（`transitionState`）。
- Pixi 资源命名遵循公共部分约定：`regions/{id}/map.png`、`spots/{id}/{cover|scene}.png`、`rewards/{id}.png`。
- 场景销毁必须释放 Pixi 纹理/容器，避免内存泄漏。

---

## 8. Action / Event 承载规范

- Action 统一渲染入口，结构：`icon / title / subtitle? / status / handler`，**按 `ActionType` 分发**，新增类型只扩展分发表，不散落 if-else。
- 执行流程固定：`点击 → useExecuteAction(loading) → 接收 ExecuteActionData → 按字段分发渲染`
  - `event` → `EventModal` / `EncounterPanel`（按 `event.uiTemplate`）
  - `reward` → `RewardPopup`
  - `aiTask` → 进入 AI 轮询流程
- 事件 UI 模板映射集中维护（`uiTemplate` → 组件），禁止在业务组件内写死分支。

---

## 9. AI 链路规范

- 严格异步：上传 → 提交得到 `taskId` → 轮询 `tasks/{id}` 直至 `success/failed` → `results/{id}` 取结果。
- 轮询用 TanStack Query `refetchInterval`，命中 `success/failed` 后停止；设最大轮询时长与失败兜底 UI。
- 上传前做客户端校验（类型/大小，对应 `AITemplate.inputRequirements`），失败映射 `UPLOAD_INVALID`。

---

## 10. 错误处理规范

- 全局拦截 `ApiError`，按 `ErrorCode` 给用户文案；`RISK_BLOCKED` / `AI_TASK_FAILED` 需明确提示。
- 场景层错误不得白屏：提供重试与返回上一级入口。
- `ACTION_COOLDOWN` 由前端结合 `cooldownMap` 预防点击，后端返回时同步纠正。

---

## 11. 编码与提交规范

- 遵循根目录 ESLint / Prettier / editorconfig；提交前 `lint` + `tsc --noEmit` 必须通过。
- 组件文件 PascalCase，hooks `useXxx`，store `xxxStore`。
- 注释只解释“为什么”，不解释显而易见的“做什么”。
- **接口/类型若需变更，先改 `@atlas/shared` 并同步 `Atlas-路过-API协议说明.md`，再改前端**，禁止前端私自加字段。

---

## 12. 本地启动、端口与编译

统一在仓库根目录用 npm workspaces 命令，**禁止**把端口写死在 `package.json` 脚本里（用环境变量/参数）。

| 命令（根目录） | 作用 |
| --- | --- |
| `npm run dev:frontend` | 启动前端 web（开发），默认 `http://localhost:3000` |
| `npm run build:web` | 编译 web 产物（先构建 `@atlas/shared` 再 `next build`） |
| `npm run start:frontend` | 启动已编译前端（生产） |

端口与环境变量（复制 `.env.example` 到 `frontend/.env.local`）：

- `FRONTEND_PORT`：前端端口，默认 `3000`；亦可 `npm run dev:frontend -- -p 4000` 透传。
- `NEXT_PUBLIC_API_BASE_URL`：后端基址，端口须与后端 `PORT` 一致。
- `NEXT_PUBLIC_USE_MOCK`：`true` 走 Mock，联调时切 `false`。

约束：`next dev/start` 不再硬编码 `-p`，端口来源唯一为环境变量或 CLI 参数。

---

## 13. 交付与验收（对齐 tasks/02-前端.md）

- M2：World→Region→Spot 层级跑通（Mock 驱动）、统一转场。
- M3：Spot 内至少 2 类 Action 可执行并展示 Event/Reward。
- M4：上传→提交→轮询→结果展示链路跑通。
- M5：图鉴 / 生成记录 / 分享页可消费资产接口。
- 联调（M6）：Mock 平滑切真实接口，零字段改动即可联通。
